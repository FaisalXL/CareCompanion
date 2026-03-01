"""
CareAgent — the agentic brain of the CareCompanion system.

Receives events from every subsystem (fall detector, face engine, wake word,
proactive scheduler) and drives the full tool-calling loop via OpenAI
function calling.  The local LLM is used as a text-only fallback when the
cloud is unreachable.
"""

import json
import queue
import threading
import time

from config import AGENT_TOOLS, PATIENT_PROFILE


class CareAgent:

    def __init__(self, llm_router, memory, audio, vision, face_engine,
                 event_logger, proactive, save_capture_fn=None):
        self.llm = llm_router
        self.memory = memory
        self.audio = audio
        self.vision = vision
        self.faces = face_engine
        self.logger = event_logger
        self.proactive = proactive
        self._save_capture = save_capture_fn

        self.event_queue: queue.Queue = queue.Queue()
        self._busy = False
        self._lock = threading.Lock()
        self._last_spoke = 0          # timestamp of last speech
        self._speech_cooldown = 120   # min seconds between non-critical speech

    # ── public: enqueue an event from any thread ──────────────────────────

    def enqueue(self, event: dict):
        """Thread-safe way to push an event for processing."""
        self.event_queue.put(event)

    # ── main loop tick (called from App.run user_loop) ────────────────────

    def tick(self):
        """Process one pending event per tick.  Non-blocking."""
        if self._busy:
            return
        try:
            event = self.event_queue.get_nowait()
        except queue.Empty:
            return
        self._dispatch(event)

    # ── event dispatch ────────────────────────────────────────────────────

    def _recently_spoke(self) -> bool:
        return (time.time() - self._last_spoke) < self._speech_cooldown

    def _dispatch(self, event: dict):
        etype = event.get("type", "")

        if etype == "fall_detected":
            self._handle_critical(
                "[CRITICAL ALERT] The fall detection sensor has triggered. "
                f"Impact data: {event.get('data', {})}. "
                "Immediately check on the user, ask if they are okay, and "
                "send an alert to the family.",
                event,
            )

        elif etype == "face_recognized":
            person = event.get("person", {})
            name = person.get("name", "someone")
            rel = person.get("relationship", "")
            notes = person.get("notes", "")
            self.memory.observations.update_person(name, rel)
            # Always log, but only speak if we haven't spoken recently
            self.logger.log("face_recognized", person)
            if not self._recently_spoke():
                ctx = (
                    f"[OBSERVATION] {name}, the patient's {rel}, just appeared "
                    f"in the camera frame. Notes: {notes}. "
                    "Greet them briefly and warmly — one short sentence."
                )
                self._handle_event(ctx, event)
            else:
                self.memory.inject_system_context(
                    f"[OBSERVATION] {name} ({rel}) is nearby."
                )

        elif etype == "user_query":
            self._handle_user_query(event.get("text", ""))

        elif etype == "proactive_reminder":
            if self._recently_spoke():
                self.memory.inject_system_context(
                    f"[CONTEXT] {event.get('message', '')}"
                )
                return
            self._handle_event(
                f"[PROACTIVE] {event.get('message', '')}",
                event,
            )

        elif etype == "safety_check":
            detail = event.get("data", {}).get("detail", "")
            self.memory.inject_system_context(f"[SAFETY] {detail}")
            self.logger.log("safety_check", event.get("data", {}))
            # Only speak for actual hazards, not routine checks
            if any(w in detail.lower() for w in ("danger", "hazard", "fall", "obstacle", "risk")):
                if not self._recently_spoke():
                    self._handle_event(
                        f"[SAFETY WARNING] {detail}. Warn the user briefly.",
                        event,
                    )

        elif etype == "inactivity_alert":
            if self._recently_spoke():
                return
            self._handle_event(
                "[OBSERVATION] The user has been inactive for a long time. "
                "Gently check in on them.",
                event,
            )

        elif etype == "deferred":
            ctx = event.get("context", "")
            if ctx:
                self._handle_event(ctx, event)

        else:
            self.logger.log("unknown_event", event)

    # ── handlers ──────────────────────────────────────────────────────────

    def _handle_critical(self, context: str, raw_event: dict):
        self.logger.log("critical_event", raw_event.get("data", {}), "critical")
        # Always send an immediate alert to the family app
        self.logger.log("family_alert", {
            "message": f"Fall detected — checking on patient",
            "severity": "critical",
            "data": raw_event.get("data", {}),
        }, "critical")
        self.memory.inject_system_context(context)
        msgs = self.memory.build_context(compact=False)
        self._run_agent_loop(msgs, prefer_cloud=True)
        # After speaking, listen for the user's response
        self._listen_after_fall()

    def _handle_event(self, context: str, raw_event: dict):
        if self._busy:
            self.event_queue.put({"type": "deferred", "context": context})
            return
        self.logger.log(raw_event.get("type", "event"), raw_event.get("data", raw_event))
        self.memory.inject_system_context(context)
        msgs = self.memory.build_context()
        self._run_agent_loop(msgs)

    def _listen_after_fall(self):
        """After asking 'are you okay?', record and evaluate the response."""
        try:
            time.sleep(0.5)
            text = self.audio.record_and_transcribe(duration=5)
            if not text or not text.strip():
                # No response — escalate
                self.logger.log("family_alert", {
                    "message": "URGENT: Patient did not respond after fall detection",
                    "severity": "critical",
                }, "critical")
                self.audio.speak(
                    "I didn't hear you. I'm alerting your family just in case."
                )
                self._last_spoke = time.time()
                return

            self.memory.add_message("user", text)
            self.logger.log("user_query", {"text": text, "context": "fall_response"})

            distress = any(w in text.lower() for w in
                           ["help", "hurt", "pain", "no", "can't", "not okay",
                            "bad", "stuck", "fell", "bleeding", "broken"])
            if distress:
                self.logger.log("family_alert", {
                    "message": f"URGENT: Patient says '{text}' after fall",
                    "severity": "critical",
                }, "critical")

            self.memory.inject_system_context(
                f"[FALL FOLLOW-UP] Patient responded: '{text}'. "
                + ("They seem to need help — use send_family_alert with severity critical. "
                   if distress else
                   "They seem okay — reassure them gently. ")
            )
            msgs = self.memory.build_context()
            self._run_agent_loop(msgs, prefer_cloud=True)

        except Exception as exc:
            print(f"[agent] fall follow-up error: {exc}")

    def _handle_user_query(self, text: str):
        self.memory.add_message("user", text)
        self.memory.observations.record_activity()
        self.logger.log("user_query", {"text": text})
        msgs = self.memory.build_context()
        self._run_agent_loop(msgs)

    # ── agentic tool-calling loop ─────────────────────────────────────────

    def _run_agent_loop(self, messages: list[dict],
                        prefer_cloud: bool = False):
        with self._lock:
            self._busy = True

        try:
            response = self.llm.complete(
                messages, tools=AGENT_TOOLS, prefer_cloud=prefer_cloud,
            )

            iterations, max_iter = 0, 8

            while response.get("tool_calls") and iterations < max_iter:
                for tc in response["tool_calls"]:
                    fn = tc["function"]["name"]
                    try:
                        args = json.loads(tc["function"]["arguments"])
                    except (json.JSONDecodeError, KeyError):
                        args = {}

                    result = self._execute_tool(fn, args)

                    messages.append({
                        "role": "assistant",
                        "tool_calls": [tc],
                        "content": None,
                    })
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tc["id"],
                        "content": str(result),
                    })

                response = self.llm.complete(
                    messages, tools=AGENT_TOOLS, prefer_cloud=prefer_cloud,
                )
                iterations += 1

            final_text = response.get("content", "")
            if final_text:
                self.memory.add_message("assistant", final_text)
                self.logger.log("agent_final", {"text": final_text})
                # If no tool calls were made at all, speak the text directly
                # (happens when fallback LLM doesn't support function calling)
                if iterations == 0 and not response.get("tool_calls"):
                    self.audio.speak(final_text)
                    self._last_spoke = time.time()

        except Exception as exc:
            self.logger.log("agent_error", {"error": str(exc)}, "warning")
            try:
                self.audio.speak(
                    "I'm sorry, I had a small hiccup. Let me try that again."
                )
            except Exception:
                pass

        finally:
            with self._lock:
                self._busy = False

    # ── tool execution ────────────────────────────────────────────────────

    def _execute_tool(self, name: str, args: dict) -> str:
        self.logger.log("tool_exec", {"tool": name, "args": args})

        try:
            if name == "speak_to_user":
                self.audio.speak(args.get("text", ""))
                self._last_spoke = time.time()
                return "Audio played successfully."

            if name == "describe_scene":
                frame = self.vision.capture_frame()
                if frame is None:
                    return "Camera is currently unavailable."
                image_id = None
                if self._save_capture and frame is not None:
                    image_id = self._save_capture(frame, "describe")
                desc = self.vision.describe_scene(frame)
                self.logger.log("vision_capture", {
                    "tool": name, "description": desc,
                    **({"image_id": image_id} if image_id else {}),
                })
                return desc

            if name == "find_object":
                frame = self.vision.capture_frame()
                if frame is None:
                    return "Camera is currently unavailable."
                image_id = None
                if self._save_capture and frame is not None:
                    image_id = self._save_capture(frame, "find")
                result = self.vision.find_object(frame, args.get("object_name", ""))
                self.logger.log("vision_capture", {
                    "tool": name, "query": args.get("object_name", ""),
                    "result": result,
                    **({"image_id": image_id} if image_id else {}),
                })
                return result

            if name == "read_text":
                frame = self.vision.capture_frame()
                if frame is None:
                    return "Camera is currently unavailable."
                image_id = None
                if self._save_capture and frame is not None:
                    image_id = self._save_capture(frame, "ocr")
                text = self.vision.read_text(frame)
                self.logger.log("vision_capture", {
                    "tool": name, "text": text,
                    **({"image_id": image_id} if image_id else {}),
                })
                return text

            if name == "identify_person":
                frame = self.vision.capture_frame()
                if frame is None:
                    return "Camera is currently unavailable."
                people = self.faces.recognize(frame)
                if people:
                    parts = [
                        f"{p['name']} ({p['relationship']}, confidence {p['confidence']})"
                        for p in people
                    ]
                    return "People identified: " + ", ".join(parts)
                return "No recognized people are currently visible."

            if name == "send_family_alert":
                severity = args.get("severity", "info")
                msg = args.get("message", "")
                self.logger.log("family_alert", {
                    "message": msg,
                    "severity": severity,
                }, severity)
                return f"Alert sent to family: {msg}"

            if name == "get_current_datetime":
                return time.strftime(
                    "It is %A, %B %d, %Y.  The time is %I:%M %p."
                )

            if name == "set_reminder":
                minutes = args.get("minutes", 5)
                msg = args.get("message", "Reminder")
                trigger = time.time() + minutes * 60
                self.proactive.add_reminder(msg, trigger)
                return f"Reminder set for {minutes} minutes from now."

            if name == "navigate_room":
                dest = args.get("destination", "").lower()
                layout = PATIENT_PROFILE.get("home_layout", {})
                if dest in layout:
                    return f"To get to the {dest}: {layout[dest]}."
                close = [r for r in layout if dest in r]
                if close:
                    return f"To get to the {close[0]}: {layout[close[0]]}."
                return (
                    f"I don't have directions to '{dest}'. "
                    f"Known rooms: {', '.join(layout.keys())}."
                )

            return f"Unknown tool: {name}"

        except Exception as exc:
            self.logger.log("tool_error", {"tool": name, "error": str(exc)}, "warning")
            return f"Tool '{name}' encountered an error: {exc}"
