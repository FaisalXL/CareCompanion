"""
CareCompanion — main entry point.

Wires together every subsystem (fall detection, face recognition, vision,
audio, dual-LLM, agentic brain, proactive scheduler) and runs the Arduino
App Bricks event loop.

Subsystem overview:
  • FallDetector      → accelerometer data via Bridge
  • FaceEngine        → OpenCV face recognition with profiles
  • VisionProcessor   → camera + VLM (SmolVLM / OpenAI) for scene/OCR/find
  • AudioManager      → LMNT TTS + Whisper STT
  • LLMRouter         → cloud (OpenAI) ↔ local (llama.cpp) smart routing
  • MemoryManager     → 3-tier context system with auto-compression
  • EventLogger       → structured JSON logging for family monitoring app
  • ProactiveCare     → time-based orientation, medication, inactivity alerts
  • CareAgent         → agentic brain — tool-calling loop orchestrating all above
"""

import base64
import os
import sys
import time
import threading

# Ensure sibling modules are importable
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from arduino.app_utils import App, Logger, Bridge
from arduino.app_bricks.keyword_spotting import KeywordSpotting
from arduino.app_bricks.web_ui import WebUI

from config import (
    FACE_CHECK_INTERVAL,
    PATIENT_PROFILE,
    SCENE_CAPTURE_INTERVAL,
    SUMMARY_LOG_INTERVAL,
    WAKE_WORD,
)
from event_logger import EventLogger
from memory import MemoryManager
from fall_detector import FallDetector
from face_engine import FaceEngine
from vision import VisionProcessor
from audio import AudioManager
from llm_router import LLMRouter
from agent import CareAgent
from proactive import ProactiveCare

logger = Logger("carecompanion")

# ═════════════════════════════════════════════════════════════════════════════
# 1. INITIALISE SUBSYSTEMS
# ═════════════════════════════════════════════════════════════════════════════

logger.info("Initialising CareCompanion subsystems…")

event_log   = EventLogger()
memory      = MemoryManager()
llm         = LLMRouter()
audio       = AudioManager()
vision      = VisionProcessor(llm_router=llm)
faces       = FaceEngine(faces_dir=os.path.join(os.path.dirname(__file__), "..", "faces"))
proactive   = ProactiveCare()
agent       = CareAgent(llm, memory, audio, vision, faces, event_log, proactive,
                        save_capture_fn=None)  # wired after save_capture is defined

# Wire late dependencies (memory needs llm for compression)
memory.set_llm_router(llm)

# Provide system-state snapshot to the logger
event_log.set_system_state_provider(lambda: {
    "llm_active": llm.active_llm,
    "network_online": llm.is_online(),
    "local_llm": llm.is_local_available(),
    "working_memory": len(memory.working_memory),
    "episodic_memories": len(memory.episodic_memory),
})

event_log.log("system_start", {
    "patient": PATIENT_PROFILE.get("name"),
    "faces_loaded": len(faces.get_all_profiles()),
    "llm_status": llm.get_status(),
})

logger.info(f"Patient: {PATIENT_PROFILE.get('name')}  |  "
            f"Faces loaded: {len(faces.get_all_profiles())}  |  "
            f"LLM: {llm.get_status()}")

# ── image capture storage ─────────────────────────────────────────────────
import cv2 as _cv2

_CAPTURES_DIR = "/tmp/carecompanion/captures"
os.makedirs(_CAPTURES_DIR, exist_ok=True)

def save_capture(frame, tag: str = "scene") -> str:
    """Save a camera frame to disk, return the image_id."""
    image_id = f"{tag}_{int(time.time() * 1000)}"
    path = os.path.join(_CAPTURES_DIR, f"{image_id}.jpg")
    _cv2.imwrite(path, frame, [_cv2.IMWRITE_JPEG_QUALITY, 70])
    return image_id

def get_capture_b64(image_id: str) -> str | None:
    """Read a saved capture and return it as base64 JPEG."""
    path = os.path.join(_CAPTURES_DIR, f"{image_id}.jpg")
    if not os.path.exists(path):
        return None
    with open(path, "rb") as f:
        return base64.b64encode(f.read()).decode("ascii")

agent._save_capture = save_capture

# ═════════════════════════════════════════════════════════════════════════════
# 2. FALL DETECTION (Bridge ← sketch accelerometer)
# ═════════════════════════════════════════════════════════════════════════════

def _on_fall(data: dict):
    logger.warning(f"FALL DETECTED — {data}")
    agent.enqueue({"type": "fall_detected", "data": data})

def _on_jolt(data: dict):
    logger.debug(f"Jolt (ignored) — {data}")

fall_det = FallDetector(on_fall=_on_fall, on_jolt=_on_jolt)

def _bridge_accel(x: float, y: float, z: float):
    """Called from the sketch via Bridge.notify('record_sensor_movement')."""
    fall_det.process_sample(x, y, z)
    memory.observations.record_activity()

try:
    Bridge.provide("record_sensor_movement", _bridge_accel)
    logger.info("Bridge provider 'record_sensor_movement' registered")
except RuntimeError:
    logger.debug("'record_sensor_movement' already registered")

# ═════════════════════════════════════════════════════════════════════════════
# 3. WAKE-WORD → RECORD → TRANSCRIBE → AGENT
# ═════════════════════════════════════════════════════════════════════════════

spotter = KeywordSpotting()
_keyword_active = False

def _do_interaction():
    """Handle the full voice interaction on a separate thread.
    The spotter keeps running on B100 mic — we record from Headset mic."""
    global _keyword_active

    try:
        try:
            logger.info("[KW] 2/5 speaking acknowledgment…")
            audio.speak("I'm here.")
            logger.info("[KW] 2/5 acknowledgment done")
        except Exception as exc:
            logger.warning(f"[KW] 2/5 acknowledgment failed: {exc}")

        logger.info("[KW] 3/5 recording from Headset mic…")
        text = audio.record_and_transcribe()
        logger.info(f"[KW] 4/5 transcription: '{text}'")

        if text:
            agent._handle_user_query(text)
            logger.info("[KW] 5/5 agent finished")
        else:
            logger.warning("[KW] 4/5 empty transcription")
            try:
                audio.speak("Sorry, I didn't catch that. Try again?")
            except Exception:
                pass

    except Exception as exc:
        logger.error(f"[KW] error: {exc}")
        import traceback
        traceback.print_exc()
    finally:
        _keyword_active = False

def _on_keyword():
    global _keyword_active
    if _keyword_active:
        return
    _keyword_active = True
    logger.info("[KW] 1/5 wake word detected")
    event_log.log("wake_word", {"keyword": WAKE_WORD})
    # Run on a separate thread — spotter keeps running, no stop/start needed
    threading.Thread(target=_do_interaction, daemon=True).start()

spotter.on_detect(WAKE_WORD, _on_keyword)
logger.info(f"Wake word '{WAKE_WORD}' spotter ready")

# ═════════════════════════════════════════════════════════════════════════════
# 4. WEB UI — REST endpoints for the family monitoring app
# ═════════════════════════════════════════════════════════════════════════════

ui = WebUI()

ui.expose_api("GET", "/api/events",
              lambda: event_log.get_recent(100))

ui.expose_api("GET", "/api/alerts",
              lambda: event_log.get_alerts(50))

ui.expose_api("GET", "/api/summary",
              lambda: event_log.export_summary())

ui.expose_api("GET", "/api/memory",
              lambda: memory.export_state())

ui.expose_api("GET", "/api/status",
              lambda: {
                  "patient": PATIENT_PROFILE.get("name"),
                  "age": PATIENT_PROFILE.get("age"),
                  "conditions": PATIENT_PROFILE.get("conditions", []),
                  "medications": PATIENT_PROFILE.get("medications", []),
                  "notes": PATIENT_PROFILE.get("notes", []),
                  "llm": llm.get_status(),
                  "faces": faces.get_all_profiles(),
                  "uptime_sec": int(time.time() - _start_time),
              })

ui.expose_api("GET", "/api/profiles",
              lambda: faces.get_all_profiles())

def _get_face_images():
    """Return all face profile images as base64 for the frontend."""
    result = {}
    for p in faces.get_all_profiles():
        name = p["name"]
        if p.get("has_image"):
            b64 = faces.get_face_image_b64(name)
            if b64:
                result[name] = b64
    return result

ui.expose_api("GET", "/api/face-images", _get_face_images)

def _get_capture(image_id: str = ""):
    """Return a captured image as base64, or list recent captures."""
    if image_id:
        b64 = get_capture_b64(image_id)
        if b64:
            return {"image_id": image_id, "b64": b64}
        return {"error": "Image not found"}
    recent_files = sorted(os.listdir(_CAPTURES_DIR), reverse=True)[:20]
    ids = [f.replace(".jpg", "") for f in recent_files if f.endswith(".jpg")]
    return {"captures": ids}

ui.expose_api("GET", "/api/captures", _get_capture)

ui.expose_api("GET", "/api/consolidated",
              lambda: event_log.export_consolidated())

ui.expose_api("GET", "/api/scene",
              lambda: _get_live_scene())

def _get_live_scene():
    """On-demand scene capture for the monitoring app."""
    try:
        frame = vision.capture_frame()
        if frame is not None:
            image_id = save_capture(frame, "live")
            desc = vision.describe_scene(frame)
            b64 = get_capture_b64(image_id)
            return {
                "description": desc,
                "timestamp": time.time(),
                "image_id": image_id,
                "b64": b64,
            }
    except Exception as exc:
        return {"error": str(exc)}
    return {"description": "Camera unavailable"}

# ── POST endpoints for family app sync ────────────────────────────────────

def _handle_profile_sync(data: dict):
    """Receive patient profile updates from the family app."""
    try:
        if data.get("name"):
            PATIENT_PROFILE["name"] = data["name"]
        if data.get("age"):
            PATIENT_PROFILE["age"] = data["age"]
        if data.get("conditions"):
            PATIENT_PROFILE["conditions"] = data["conditions"]
        if data.get("emergency_contact"):
            PATIENT_PROFILE["emergency_contact"] = data["emergency_contact"]
        if data.get("blood_type"):
            PATIENT_PROFILE["blood_type"] = data["blood_type"]
        memory.inject_system_context(
            f"[PROFILE UPDATE] Patient: {PATIENT_PROFILE.get('name')}, "
            f"Age: {PATIENT_PROFILE.get('age')}, "
            f"Conditions: {', '.join(PATIENT_PROFILE.get('conditions', []))}"
        )
        event_log.log("profile_synced", {"name": data.get("name")})
        return {"success": True, "message": f"Profile for {data.get('name', '?')} synced to device"}
    except Exception as exc:
        return {"success": False, "message": str(exc)}

def _handle_medications_sync(data: dict):
    """Receive medication list from the family app and merge with existing."""
    try:
        meds = data.get("medications", [])
        incoming = [
            f"{m.get('name', '?')} {m.get('dosage', '')} ({m.get('schedule', '')})"
            for m in meds
        ]
        existing = PATIENT_PROFILE.get("medications", [])
        existing_lower = {s.lower() for s in existing}
        merged = list(existing)
        for m in incoming:
            if m.lower() not in existing_lower:
                merged.append(m)
                existing_lower.add(m.lower())
        PATIENT_PROFILE["medications"] = merged
        memory.inject_system_context(
            f"[PROFILE UPDATE] Medications updated: {'; '.join(merged)}"
        )
        event_log.log("medications_synced", {"count": len(merged), "medications": merged})
        return {"success": True, "message": f"{len(merged)} medication(s) on device"}
    except Exception as exc:
        return {"success": False, "message": str(exc)}

def _handle_faces_sync(data: dict):
    """Receive face profiles from the family app."""
    try:
        face_list = data.get("faces", [])
        synced = 0
        names = []
        for f in face_list:
            name = f.get("name", "")
            rel = f.get("relationship", "")
            if name:
                faces.add_profile_runtime(name, rel)
                synced += 1
                names.append(name)
        # Update patient profile family map
        for f in face_list:
            name = f.get("name", "")
            rel = f.get("relationship", "")
            if name and rel:
                PATIENT_PROFILE.setdefault("family", {})[name] = {
                    "relationship": rel
                }
        memory.inject_system_context(
            f"[PROFILE UPDATE] Known people: {', '.join(names)}"
        )
        event_log.log("faces_synced", {"count": synced, "names": names})
        return {"success": True, "message": f"{synced} face(s) synced to device"}
    except Exception as exc:
        return {"success": False, "message": str(exc)}

def _handle_notes_sync(data: dict):
    """Receive patient notes from the family app."""
    try:
        notes = data.get("notes", [])
        note_texts = [n.get("text", "") for n in notes if n.get("text")]
        PATIENT_PROFILE["notes"] = note_texts
        # Inject into memory context
        if note_texts:
            memory.inject_system_context(
                "[PROFILE UPDATE] Family notes: " + "; ".join(note_texts[:5])
            )
        event_log.log("notes_synced", {"count": len(note_texts)})
        return {"success": True, "message": f"{len(note_texts)} note(s) synced"}
    except Exception as exc:
        return {"success": False, "message": str(exc)}

def _handle_family_speak(data: dict):
    """Family sends a message to be spoken to the patient."""
    try:
        text = data.get("message", "").strip()
        if not text:
            return {"success": False, "message": "Empty message"}
        spoken = f"Message from your family: {text}"
        audio.speak(spoken)
        memory.inject_system_context(
            f"[FAMILY MESSAGE] Family sent a message to the patient: '{text}'"
        )
        event_log.log("family_message", {
            "text": text, "direction": "to_patient",
        })
        return {"success": True, "message": "Message delivered"}
    except Exception as exc:
        return {"success": False, "message": str(exc)}

def _handle_llm_chat(data: dict):
    """Direct chat with the on-device LLM for testing."""
    try:
        text = data.get("message", "").strip()
        provider = data.get("provider", "auto")
        if not text:
            return {"reply": "", "provider": "none"}

        messages = [{"role": "user", "content": text}]

        if provider == "local":
            result = llm._call_local(messages)
            return {"reply": result.get("content", ""), "provider": "local"}
        elif provider == "together":
            result = llm._call_together(messages)
            return {"reply": result.get("content", ""), "provider": "together"}
        elif provider == "openai":
            result = llm._call_openai(messages)
            return {"reply": result.get("content", ""), "provider": "openai"}
        else:
            result = llm.complete(messages)
            return {"reply": result.get("content", ""), "provider": llm.active_llm}
    except Exception as exc:
        return {"reply": f"Error: {exc}", "provider": "error"}

ui.expose_api("POST", "/api/chat", _handle_llm_chat)
ui.expose_api("POST", "/api/speak", _handle_family_speak)
ui.expose_api("POST", "/api/profile", _handle_profile_sync)
ui.expose_api("POST", "/api/medications", _handle_medications_sync)
ui.expose_api("POST", "/api/faces", _handle_faces_sync)
ui.expose_api("POST", "/api/notes", _handle_notes_sync)

logger.info("WebUI REST API endpoints registered on port 7000")

# ═════════════════════════════════════════════════════════════════════════════
# 5. MAIN LOOP — face recognition + proactive checks + agent tick
# ═════════════════════════════════════════════════════════════════════════════

_start_time     = time.time()
_frame_count    = 0
_last_proactive = time.time()
_last_scene     = time.time()
_last_summary   = time.time()
_PROACTIVE_INTERVAL = 120

def main_loop():
    global _frame_count, _last_proactive, _last_scene, _last_summary
    now = time.time()

    # ── Face recognition (every N frames) ─────────────────────────────────
    _frame_count += 1
    if _frame_count % FACE_CHECK_INTERVAL == 0:
        frame = vision.capture_frame()
        if frame is not None:
            people = faces.recognize(frame)
            for person in people:
                logger.info(f"Face match: {person['name']} ({person['confidence']})")
                event_log.log("face_recognized", person)
                agent.enqueue({"type": "face_recognized", "person": person})

    # ── Periodic scene capture (every 60 s) ───────────────────────────────
    if now - _last_scene >= SCENE_CAPTURE_INTERVAL:
        _last_scene = now
        try:
            frame = vision.capture_frame()
            if frame is not None:
                image_id = save_capture(frame, "scene")
                desc = vision.describe_scene(frame)
                memory.add_observation(f"Scene: {desc}")
                event_log.log("scene_capture", {
                    "description": desc, "image_id": image_id,
                })

                safety = vision.analyze_for_safety(frame)
                if safety and "no hazard" not in safety.lower():
                    event_log.log("safety_warning", {
                        "detail": safety, "image_id": image_id,
                    }, "warning")
                    agent.enqueue({"type": "safety_check", "data": {"detail": safety}})
        except Exception as exc:
            logger.debug(f"Scene capture error: {exc}")

    # ── Consolidated summary log (every 10 min) ──────────────────────────
    if now - _last_summary >= SUMMARY_LOG_INTERVAL:
        _last_summary = now
        try:
            summary_data = {
                "uptime_sec": int(now - _start_time),
                "memory": memory.export_state(),
                "event_summary": event_log.export_summary(),
                "llm_status": llm.get_status(),
            }
            event_log.log("consolidated_summary", summary_data)
            logger.info("[SUMMARY] 10-min consolidated log written")
        except Exception:
            pass

    # ── Proactive care (every 30 s) ───────────────────────────────────────
    if now - _last_proactive >= _PROACTIVE_INTERVAL:
        _last_proactive = now
        events = proactive.check(memory.observations.last_activity)
        for evt in events:
            logger.info(f"Proactive: {evt.get('message', '')[:60]}…")
            agent.enqueue(evt)

    # ── Agent tick (process one queued event) ─────────────────────────────
    agent.tick()


logger.info("═" * 50)
logger.info("  CareCompanion is running.")
logger.info(f"  Patient : {PATIENT_PROFILE.get('name')}")
logger.info(f"  Say '{WAKE_WORD}' to interact.")
logger.info("═" * 50)

App.run(user_loop=main_loop)
