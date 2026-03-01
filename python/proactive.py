"""
Proactive care scheduler.

Fires time-based events (orientation, medication, meals, bedtime, inactivity)
so the agent can speak to the patient without being asked.  Also supports
dynamic reminders set by the agent during conversation.
"""

import threading
import time

from config import (
    BEDTIME_HOUR,
    INACTIVITY_TIMEOUT,
    MEAL_TIMES,
    MEDICATION_TIMES,
    ORIENTATION_HOURS,
    PATIENT_PROFILE,
)


class ProactiveCare:

    def __init__(self):
        self._reminders: list[dict] = []
        self._lock = threading.Lock()
        self._fired_today: set = set()
        self._last_day = -1
        self._last_inactivity_check = time.time()
        self._last_proactive_emit = 0.0

    def add_reminder(self, message: str, trigger_time: float):
        with self._lock:
            self._reminders.append({
                "message": message,
                "trigger": trigger_time,
            })

    def check(self, last_activity_time: float) -> list[dict]:
        """Called from the main loop.  Returns at most ONE triggered event."""
        now = time.time()

        if now - self._last_proactive_emit < 180:
            return []

        lt = time.localtime(now)
        hour = lt.tm_hour
        minute = lt.tm_min
        day = lt.tm_yday

        if day != self._last_day:
            self._fired_today.clear()
            self._last_day = day

        triggered: list[dict] = []

        # ── Morning orientation ───────────────────────────────────────────
        for oh in ORIENTATION_HOURS:
            key = f"orientation_{oh}"
            if hour == oh and minute < 10 and key not in self._fired_today:
                self._fired_today.add(key)
                name = PATIENT_PROFILE.get("name", "there")
                day_name = time.strftime("%A")
                date_str = time.strftime("%B %d")
                triggered.append({
                    "type": "proactive_reminder",
                    "message": (
                        f"Good morning, {name}. Today is {day_name}, {date_str}. "
                        "Help the patient start their day — mention any "
                        "scheduled activities or medications."
                    ),
                })

        # ── Medication reminders ──────────────────────────────────────────
        for mt in MEDICATION_TIMES:
            key = f"medication_{mt}"
            if hour == mt and minute < 10 and key not in self._fired_today:
                self._fired_today.add(key)
                meds = PATIENT_PROFILE.get("medications", [])
                meds_str = "; ".join(meds) if meds else "their medication"
                triggered.append({
                    "type": "proactive_reminder",
                    "message": (
                        f"It is {hour}:00 — time for medication. "
                        f"Medications: {meds_str}. "
                        "Gently remind the patient."
                    ),
                })

        # ── Meal reminders ────────────────────────────────────────────────
        meal_names = {8: "breakfast", 12: "lunch", 18: "dinner"}
        for mt in MEAL_TIMES:
            key = f"meal_{mt}"
            meal = meal_names.get(mt, "a meal")
            if hour == mt and 10 <= minute < 20 and key not in self._fired_today:
                self._fired_today.add(key)
                triggered.append({
                    "type": "proactive_reminder",
                    "message": (
                        f"It's time for {meal}. Suggest the patient "
                        "heads to the kitchen."
                    ),
                })

        # ── Bedtime ───────────────────────────────────────────────────────
        key = "bedtime"
        if hour == BEDTIME_HOUR and minute < 10 and key not in self._fired_today:
            self._fired_today.add(key)
            triggered.append({
                "type": "proactive_reminder",
                "message": (
                    "It's getting late. Gently suggest the patient "
                    "starts getting ready for bed."
                ),
            })

        # ── Time awareness (every 4 hours during daytime) ─────────────────
        if 10 <= hour <= 20 and hour % 4 == 0 and minute < 5:
            key = f"time_check_{hour}"
            if key not in self._fired_today:
                self._fired_today.add(key)
                name = PATIENT_PROFILE.get("name", "there")
                triggered.append({
                    "type": "proactive_reminder",
                    "message": (
                        f"It is now {time.strftime('%I:%M %p')}. "
                        f"Provide a gentle time-of-day orientation for {name}. "
                        "If you know what they've been doing, acknowledge it. "
                        "If they seem stuck or confused, offer helpful suggestions."
                    ),
                })

        # ── Afternoon check-in ────────────────────────────────────────────
        key = "afternoon_checkin"
        if hour == 14 and minute < 10 and key not in self._fired_today:
            self._fired_today.add(key)
            triggered.append({
                "type": "proactive_reminder",
                "message": (
                    "It's mid-afternoon. Check in on the patient's wellbeing. "
                    "Ask how they're feeling, if they need water, or would "
                    "like to do something enjoyable."
                ),
            })

        # ── Inactivity alert ──────────────────────────────────────────────
        if (now - last_activity_time > INACTIVITY_TIMEOUT
                and now - self._last_inactivity_check > INACTIVITY_TIMEOUT):
            self._last_inactivity_check = now
            triggered.append({
                "type": "inactivity_alert",
                "message": (
                    "The user has been inactive for over "
                    f"{INACTIVITY_TIMEOUT // 60} minutes. Check in on them — "
                    "they may need help or have fallen asleep in an unusual spot."
                ),
            })

        # ── Dynamic reminders ─────────────────────────────────────────────
        with self._lock:
            still_pending = []
            for rem in self._reminders:
                if now >= rem["trigger"]:
                    triggered.append({
                        "type": "proactive_reminder",
                        "message": f"Reminder: {rem['message']}",
                    })
                else:
                    still_pending.append(rem)
            self._reminders = still_pending

        if triggered:
            self._last_proactive_emit = now
            return triggered[:1]
        return []
