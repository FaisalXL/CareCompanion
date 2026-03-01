"""
Triple-LLM router — OpenAI → Together AI → local SmolVLM.

Routing strategy:
  • OpenAI   (primary)  — GPT-4o-mini with function calling
  • Together (fallback) — Llama-3.3-70B for chat, Qwen3-VL-8B for vision
  • Local    (offline)  — SmolVLM via llama.cpp on port 8080
"""

import threading
import time

import requests

from config import (
    LOCAL_LLM_URL,
    OPENAI_API_KEY,
    OPENAI_CHAT_URL,
    OPENAI_MODEL,
    TOGETHER_API_KEY,
    TOGETHER_CHAT_MODEL,
    TOGETHER_CHAT_URL,
    TOGETHER_VISION_MODEL,
    VLM_MAX_TOKENS,
)


def _extract_response(data: dict) -> dict:
    """Parse an OpenAI-compatible chat response into {content, tool_calls?}."""
    if "error" in data:
        raise RuntimeError(f"API error: {data['error']}")
    if "choices" not in data or not data["choices"]:
        raise RuntimeError(f"Unexpected response: {data}")
    msg = data["choices"][0]["message"]
    result = {"content": msg.get("content", "")}
    if msg.get("tool_calls"):
        result["tool_calls"] = msg["tool_calls"]
    return result


class LLMRouter:

    def __init__(self):
        self._online = True
        self._local_ok = False
        self._last_net_check = 0
        self._lock = threading.Lock()
        self.active_llm = "initialising"
        self._openai_blocked_until = 0  # UNIX ts — skip OpenAI until this time
        self._check_network()
        self._check_local()

    # ── status ────────────────────────────────────────────────────────────

    def _check_network(self):
        try:
            requests.head("https://api.openai.com", timeout=3)
            self._online = True
        except Exception:
            self._online = False
        self._last_net_check = time.time()

    def _check_local(self):
        try:
            requests.get(
                LOCAL_LLM_URL.replace("/chat/completions", "/models"), timeout=2,
            )
            self._local_ok = True
        except Exception:
            self._local_ok = False

    def is_online(self) -> bool:
        if time.time() - self._last_net_check > 30:
            self._check_network()
        return self._online

    def is_local_available(self) -> bool:
        return self._local_ok

    def get_status(self) -> dict:
        return {
            "llm_active": self.active_llm,
            "network_online": self._online,
            "local_llm_available": self._local_ok,
        }

    # ── chat completion (with tool support) ───────────────────────────────

    def _openai_available(self) -> bool:
        return self.is_online() and time.time() >= self._openai_blocked_until

    def _handle_openai_rate_limit(self, exc: Exception):
        """If the error is a rate limit, block OpenAI for 25s."""
        msg = str(exc)
        if "rate_limit" in msg.lower() or "rate limit" in msg.lower():
            self._openai_blocked_until = time.time() + 25
            print("[llm_router] OpenAI rate-limited — backing off 25s")

    def complete(self, messages: list[dict], tools: list | None = None,
                 prefer_cloud: bool = False) -> dict:
        """Try OpenAI → Together → local. Returns {content, tool_calls?}."""
        errors = []

        # 1. OpenAI (if not rate-limited)
        if self._openai_available():
            try:
                return self._call_openai(messages, tools)
            except Exception as exc:
                self._handle_openai_rate_limit(exc)
                errors.append(f"OpenAI: {exc}")
                print(f"[llm_router] OpenAI failed: {exc}")

        # 2. Together AI
        if self.is_online():
            try:
                return self._call_together(messages, tools)
            except Exception as exc:
                errors.append(f"Together: {exc}")
                print(f"[llm_router] Together failed: {exc}")

        # 3. Local LLM (text only, no tools)
        if self._local_ok:
            try:
                return self._call_local(messages)
            except Exception as exc:
                errors.append(f"Local: {exc}")
                print(f"[llm_router] Local failed: {exc}")

        print(f"[llm_router] ALL providers failed: {errors}")
        return {"content": "I'm having trouble connecting right now. Please try again in a moment."}

    # ── simple text completion ────────────────────────────────────────────

    def complete_simple(self, prompt: str, prefer_local: bool = False) -> str:
        messages = [{"role": "user", "content": prompt}]

        if prefer_local and self._local_ok:
            try:
                return self._call_local(messages).get("content", "")
            except Exception:
                pass

        # Together first (cheaper), then OpenAI if not rate-limited
        if self.is_online():
            try:
                return self._call_together_simple(messages)
            except Exception:
                pass

        if self._openai_available():
            try:
                return self._call_openai_simple(messages)
            except Exception as exc:
                self._handle_openai_rate_limit(exc)

        if self._local_ok:
            try:
                return self._call_local(messages).get("content", "")
            except Exception:
                pass

        return "(summarisation unavailable)"

    # ── vision completion ─────────────────────────────────────────────────

    def complete_vision(self, image_b64: str, prompt: str) -> str:
        messages = [{
            "role": "user",
            "content": [
                {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_b64}"}},
                {"type": "text", "text": prompt},
            ],
        }]

        # 1. Local VLM
        if self._local_ok:
            try:
                resp = requests.post(
                    LOCAL_LLM_URL,
                    json={"messages": messages, "max_tokens": VLM_MAX_TOKENS},
                    timeout=30,
                )
                self.active_llm = "local-vlm"
                return _extract_response(resp.json()).get("content", "")
            except Exception as exc:
                print(f"[llm_router] local VLM error: {exc}")

        # 2. OpenAI Vision (if not rate-limited)
        if self._openai_available():
            try:
                resp = requests.post(
                    OPENAI_CHAT_URL,
                    headers={"Authorization": f"Bearer {OPENAI_API_KEY}"},
                    json={
                        "model": OPENAI_MODEL,
                        "messages": messages,
                        "max_tokens": VLM_MAX_TOKENS,
                    },
                    timeout=20,
                )
                self.active_llm = "openai-vision"
                return _extract_response(resp.json()).get("content", "")
            except Exception as exc:
                self._handle_openai_rate_limit(exc)
                print(f"[llm_router] OpenAI vision error: {exc}")

        # 3. Together Vision (Qwen3-VL-8B)
        if self.is_online():
            try:
                resp = requests.post(
                    TOGETHER_CHAT_URL,
                    headers={"Authorization": f"Bearer {TOGETHER_API_KEY}"},
                    json={
                        "model": TOGETHER_VISION_MODEL,
                        "messages": messages,
                        "max_tokens": VLM_MAX_TOKENS,
                    },
                    timeout=25,
                )
                self.active_llm = "together-vision"
                return _extract_response(resp.json()).get("content", "")
            except Exception as exc:
                print(f"[llm_router] Together vision error: {exc}")

        return "(vision unavailable — all providers failed)"

    # ── internal: OpenAI ──────────────────────────────────────────────────

    def _call_openai(self, messages: list[dict],
                     tools: list | None = None) -> dict:
        payload = {"model": OPENAI_MODEL, "messages": messages, "max_tokens": 300}
        if tools:
            payload["tools"] = tools
            payload["tool_choice"] = "auto"

        resp = requests.post(
            OPENAI_CHAT_URL,
            headers={"Authorization": f"Bearer {OPENAI_API_KEY}"},
            json=payload, timeout=15,
        )
        self.active_llm = "openai"
        return _extract_response(resp.json())

    def _call_openai_simple(self, messages: list[dict]) -> str:
        r = self._call_openai(messages)
        return r.get("content", "")

    # ── internal: Together AI ─────────────────────────────────────────────

    def _call_together(self, messages: list[dict],
                       tools: list | None = None) -> dict:
        # Strip multimodal content (Together chat model is text-only)
        clean = self._strip_images(messages)
        payload = {"model": TOGETHER_CHAT_MODEL, "messages": clean, "max_tokens": 300}
        if tools:
            payload["tools"] = tools
            payload["tool_choice"] = "auto"

        resp = requests.post(
            TOGETHER_CHAT_URL,
            headers={"Authorization": f"Bearer {TOGETHER_API_KEY}"},
            json=payload, timeout=20,
        )
        self.active_llm = "together"
        return _extract_response(resp.json())

    def _call_together_simple(self, messages: list[dict]) -> str:
        clean = self._strip_images(messages)
        payload = {"model": TOGETHER_CHAT_MODEL, "messages": clean, "max_tokens": 200}
        resp = requests.post(
            TOGETHER_CHAT_URL,
            headers={"Authorization": f"Bearer {TOGETHER_API_KEY}"},
            json=payload, timeout=20,
        )
        self.active_llm = "together"
        return _extract_response(resp.json()).get("content", "")

    # ── internal: local llama.cpp ─────────────────────────────────────────

    def _call_local(self, messages: list[dict]) -> dict:
        clean = self._strip_images(messages)
        resp = requests.post(
            LOCAL_LLM_URL,
            json={"messages": clean, "max_tokens": 200},
            timeout=30,
        )
        self.active_llm = "local"
        return _extract_response(resp.json())

    # ── helpers ───────────────────────────────────────────────────────────

    @staticmethod
    def _strip_images(messages: list[dict]) -> list[dict]:
        """Remove image content from messages for text-only models."""
        clean = []
        for m in messages:
            if isinstance(m.get("content"), list):
                parts = [
                    p["text"] for p in m["content"]
                    if isinstance(p, dict) and p.get("type") == "text"
                ]
                clean.append({"role": m["role"], "content": " ".join(parts)})
            else:
                clean.append(m)
        return clean
