"""
Structured event logging system.

Every notable event (fall, face match, user query, agent response, tool call,
alert, network switch …) is captured as a typed JSON record and persisted to
a local JSONL file.  The monitoring family-app can pull these via the WebUI
REST endpoints exposed in main.py.
"""

import json
import os
import threading
import time
from collections import deque
from datetime import datetime, timezone


class EventLogger:

    def __init__(self, log_dir="/tmp/carecompanion", max_buffer=1000):
        self._events = deque(maxlen=max_buffer)
        self._lock = threading.Lock()
        self._system_state_fn = None

        os.makedirs(log_dir, exist_ok=True)
        self._log_path = os.path.join(log_dir, "events.jsonl")
        self._alert_path = os.path.join(log_dir, "alerts.jsonl")

    # ── configuration ─────────────────────────────────────────────────────

    def set_system_state_provider(self, fn):
        """Register a callable that returns a dict of current system state."""
        self._system_state_fn = fn

    # ── core logging ──────────────────────────────────────────────────────

    def log(self, event_type: str, data: dict, severity: str = "info"):
        """Append a structured event and persist it."""
        entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "event_type": event_type,
            "severity": severity,
            "data": data,
        }

        if self._system_state_fn:
            try:
                entry["system_state"] = self._system_state_fn()
            except Exception:
                pass

        with self._lock:
            self._events.append(entry)
            self._append_file(self._log_path, entry)
            if severity in ("warning", "critical"):
                self._append_file(self._alert_path, entry)

        return entry

    # ── queries ───────────────────────────────────────────────────────────

    def get_recent(self, count: int = 50, event_type: str = None,
                   severity: str = None):
        with self._lock:
            items = list(self._events)
        if event_type:
            items = [e for e in items if e["event_type"] == event_type]
        if severity:
            items = [e for e in items if e["severity"] == severity]
        return items[-count:]

    def get_alerts(self, count: int = 20):
        with self._lock:
            items = list(self._events)
        return [
            e for e in items if e["severity"] in ("warning", "critical")
        ][-count:]

    def export_summary(self):
        """Compact overview for the monitoring dashboard."""
        with self._lock:
            items = list(self._events)
        type_counts = {}
        for e in items:
            t = e["event_type"]
            type_counts[t] = type_counts.get(t, 0) + 1
        alerts = [e for e in items if e["severity"] in ("warning", "critical")]
        return {
            "total_events": len(items),
            "event_types": type_counts,
            "recent_alerts": alerts[-5:],
            "last_event": items[-1] if items else None,
        }

    def get_events_since(self, since_ts: float) -> list[dict]:
        """Return all events logged after a UNIX timestamp."""
        with self._lock:
            return [e for e in self._events if
                    datetime.fromisoformat(e["timestamp"]).timestamp() > since_ts]

    def export_consolidated(self, window_sec: int = 600) -> dict:
        """Rich 10-min summary meant for the family monitoring app."""
        cutoff = time.time() - window_sec
        with self._lock:
            recent = [e for e in self._events if
                      datetime.fromisoformat(e["timestamp"]).timestamp() > cutoff]

        type_counts = {}
        for e in recent:
            t = e["event_type"]
            type_counts[t] = type_counts.get(t, 0) + 1

        alerts = [e for e in recent if e["severity"] in ("warning", "critical")]
        interactions = [e for e in recent if e["event_type"] in
                        ("user_query", "agent_response", "wake_word")]
        scene_descs = [e["data"].get("description", "") for e in recent
                       if e["event_type"] == "scene_capture"]
        faces_seen = list({e["data"].get("name", "?") for e in recent
                          if e["event_type"] == "face_recognized"})

        return {
            "window_start": datetime.fromtimestamp(cutoff, tz=timezone.utc).isoformat(),
            "window_end": datetime.now(timezone.utc).isoformat(),
            "total_events": len(recent),
            "event_types": type_counts,
            "alerts": alerts,
            "interactions_count": len(interactions),
            "faces_seen": faces_seen,
            "scene_summaries": scene_descs[-3:],
            "system_state": self._system_state_fn() if self._system_state_fn else {},
        }

    # ── persistence helpers ───────────────────────────────────────────────

    @staticmethod
    def _append_file(path: str, entry: dict):
        try:
            with open(path, "a") as fh:
                fh.write(json.dumps(entry) + "\n")
        except Exception:
            pass
