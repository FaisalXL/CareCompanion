"""
Three-tier memory system with automatic context compression.

Tier 1 — Working Memory   : last N raw messages (exact wording preserved)
Tier 2 — Episodic Memory  : LLM-compressed summaries of older conversation
Tier 3 — Semantic Profile : static patient profile, always present in context

An ObservationBuffer tracks real-time environmental state (people nearby,
recent sensor events, activity level) and is injected into every prompt.
"""

import threading
import time

from config import (
    EPISODIC_MEMORY_MAX,
    COMPRESS_BATCH,
    PATIENT_PROFILE,
    SYSTEM_PROMPT,
    WORKING_MEMORY_MAX,
)


class ObservationBuffer:
    """Real-time environmental awareness injected into the system prompt."""

    def __init__(self):
        self.people_present: dict = {}
        self.recent_events: list = []
        self.last_activity: float = time.time()
        self._lock = threading.Lock()

    def update_person(self, name: str, relationship: str = ""):
        with self._lock:
            self.people_present[name] = {
                "last_seen": time.time(),
                "relationship": relationship,
            }

    def add_event(self, text: str):
        with self._lock:
            self.recent_events.append({"text": text, "time": time.time()})
            if len(self.recent_events) > 15:
                self.recent_events = self.recent_events[-15:]

    def record_activity(self):
        self.last_activity = time.time()

    def to_string(self) -> str:
        with self._lock:
            lines: list[str] = []
            now = time.time()

            present = []
            for name, info in self.people_present.items():
                if now - info["last_seen"] < 300:
                    ago = int(now - info["last_seen"])
                    rel = f" ({info['relationship']})" if info["relationship"] else ""
                    present.append(f"{name}{rel} — {ago}s ago")
            lines.append(
                f"  People nearby: {', '.join(present)}" if present
                else "  No recognized people nearby."
            )

            recent = [e for e in self.recent_events if now - e["time"] < 600]
            if recent:
                lines.append(
                    "  Recent events: "
                    + "; ".join(e["text"] for e in recent[-5:])
                )

            inactivity_sec = int(now - self.last_activity)
            if inactivity_sec > 300:
                lines.append(
                    f"  User inactive for {inactivity_sec // 60} min."
                )

            lines.append(f"  Current time: {time.strftime('%I:%M %p, %A %B %d')}")
            return "\n".join(lines)


class MemoryManager:

    def __init__(self, llm_router=None):
        self.profile = PATIENT_PROFILE
        self.episodic_memory: list[dict] = []
        self.working_memory: list[dict] = []
        self.observations = ObservationBuffer()
        self._llm = llm_router
        self._lock = threading.Lock()

    def set_llm_router(self, router):
        self._llm = router

    # ── message management ────────────────────────────────────────────────

    def add_message(self, role: str, content: str):
        with self._lock:
            self.working_memory.append({
                "role": role,
                "content": content,
                "timestamp": time.time(),
            })
            if len(self.working_memory) > WORKING_MEMORY_MAX:
                self._compress()

    def add_observation(self, text: str):
        self.observations.add_event(text)

    def inject_system_context(self, context: str):
        """One-off system message (sensor alerts, face events, etc.)."""
        with self._lock:
            self.working_memory.append({
                "role": "system",
                "content": context,
                "timestamp": time.time(),
            })

    # ── context building ──────────────────────────────────────────────────

    def build_context(self, compact: bool = False) -> list[dict]:
        with self._lock:
            sys_prompt = self._build_system_prompt(compact)
            msgs = [{"role": "system", "content": sys_prompt}]

            window = self.working_memory[-3:] if compact else self.working_memory
            for m in window:
                msgs.append({"role": m["role"], "content": m["content"]})
            return msgs

    # ── compression ───────────────────────────────────────────────────────

    def _compress(self):
        batch = self.working_memory[:COMPRESS_BATCH]
        self.working_memory = self.working_memory[COMPRESS_BATCH:]

        conv = "\n".join(
            f"{m['role'].upper()}: {m['content']}" for m in batch
        )
        prompt = (
            "Summarize this conversation segment in 2-3 concise sentences. "
            "Preserve key facts, decisions, and emotional state:\n\n" + conv
        )

        try:
            if self._llm:
                summary = self._llm.complete_simple(prompt, prefer_local=True)
            else:
                summary = f"({len(batch)} messages about: {batch[-1]['content'][:80]}…)"
        except Exception:
            summary = f"({len(batch)} messages exchanged)"

        self.episodic_memory.append({
            "summary": summary,
            "timestamp": time.time(),
            "message_count": len(batch),
        })
        if len(self.episodic_memory) > EPISODIC_MEMORY_MAX:
            self.episodic_memory = self.episodic_memory[-EPISODIC_MEMORY_MAX:]

    # ── system prompt assembly ────────────────────────────────────────────

    def _build_system_prompt(self, compact: bool = False) -> str:
        p = self.profile

        family_parts = []
        for name, info in p.get("family", {}).items():
            if isinstance(info, dict):
                family_parts.append(f"{name} ({info.get('relationship', '?')})")
            else:
                family_parts.append(f"{name}: {info}")
        family_str = ", ".join(family_parts) or "none listed"

        conditions_str = ", ".join(p.get("conditions", [])) or "none listed"

        meds = p.get("medications", [])
        medications_str = "; ".join(meds) if meds else "none listed"

        home_str = "; ".join(
            f"{room} → {d}" for room, d in p.get("home_layout", {}).items()
        )

        if self.episodic_memory:
            if compact:
                episodic_str = self.episodic_memory[-1]["summary"]
            else:
                episodic_str = "\n".join(
                    f"  - {ep['summary']}" for ep in self.episodic_memory[-5:]
                )
        else:
            episodic_str = "  (no prior conversation history)"

        obs_str = self.observations.to_string()

        return SYSTEM_PROMPT.format(
            name=p.get("name", "User"),
            age=p.get("age", "unknown"),
            conditions=conditions_str,
            medications=medications_str,
            family=family_str,
            home_layout=home_str,
            validation_notes=p.get(
                "validation_therapy_notes",
                "Use validation therapy — gently redirect rather than correct.",
            ),
            episodic_context=episodic_str,
            observations=obs_str,
        )

    # ── export for monitoring app ─────────────────────────────────────────

    def export_state(self) -> dict:
        return {
            "episodic_memories": self.episodic_memory,
            "working_memory_size": len(self.working_memory),
            "observations": self.observations.to_string(),
            "profile_name": self.profile.get("name"),
        }
