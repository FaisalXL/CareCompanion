import os

# ─── API Keys ─────────────────────────────────────────────────────────────────
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
LMNT_API_KEY = os.environ.get("LMNT_API_KEY", "")

# ─── LLM Endpoints ───────────────────────────────────────────────────────────
LOCAL_LLM_URL = "http://127.0.0.1:8080/v1/chat/completions"
OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions"
OPENAI_TRANSCRIPTION_URL = "https://api.openai.com/v1/audio/transcriptions"
OPENAI_MODEL = "gpt-4o-mini"

# Together AI (fallback when OpenAI rate-limits / errors)
TOGETHER_API_KEY = os.environ.get("TOGETHER_API_KEY", "")
TOGETHER_CHAT_URL = "https://api.together.xyz/v1/chat/completions"
TOGETHER_CHAT_MODEL = "meta-llama/Llama-3.3-70B-Instruct-Turbo"
TOGETHER_VISION_MODEL = "Qwen/Qwen3-VL-8B-Instruct"

# ─── Fall Detection Thresholds ────────────────────────────────────────────────
FREE_FALL_THRESHOLD = 0.5   # g – magnitude below this → free-fall phase
IMPACT_THRESHOLD = 2.5      # g – magnitude above this → impact phase (raised to reduce false positives)
FALL_WINDOW = 0.5           # seconds – impact must follow free-fall within this

# ─── Face Recognition ────────────────────────────────────────────────────────
FACE_MATCH_THRESHOLD = 0.363
FACE_CHECK_INTERVAL = 10     # process every Nth frame
FACE_COOLDOWN = 300           # seconds between re-announcing the same person (5 min)
YUNET_URL = "https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx"
SFACE_URL = "https://github.com/opencv/opencv_zoo/raw/main/models/face_recognition_sface/face_recognition_sface_2021dec.onnx"

# ─── Vision ──────────────────────────────────────────────────────────────────
CAMERA_INDEX = 0
MAX_FRAME_DIM = 640
VLM_MAX_TOKENS = 250

# ─── Audio ───────────────────────────────────────────────────────────────────
WAKE_WORD = "hey_arduino"
RECORD_DURATION = 5          # seconds of speech to capture
LMNT_VOICE = "leah"
AUDIO_TMP = "/tmp/carecompanion"

# ─── Memory / Context ────────────────────────────────────────────────────────
WORKING_MEMORY_MAX = 10      # messages before compression triggers
COMPRESS_BATCH = 5           # messages compressed per cycle
EPISODIC_MEMORY_MAX = 20     # max stored episodic summaries

# ─── Proactive Care ──────────────────────────────────────────────────────────
ORIENTATION_HOURS = [8]              # hours (24h) for orientation prompts
MEDICATION_TIMES = [8, 18]           # hours for medication reminders (avoid overlap with meals)
INACTIVITY_TIMEOUT = 3600            # seconds (60 min)
MEAL_TIMES = [12]                    # only lunch — breakfast bundled with orientation, dinner with meds
BEDTIME_HOUR = 21
SCENE_CAPTURE_INTERVAL = 120         # seconds between periodic camera captures
SUMMARY_LOG_INTERVAL = 600           # seconds (10 min) between consolidated log summaries

# ─── Patient Profile (Tier 3 — Semantic Memory) ─────────────────────────────
PATIENT_PROFILE = {
    "name": "Sarah",
    "age": 78,
    "conditions": ["Early-stage dementia", "Visually impaired"],
    "medications": [
        "Blood pressure pill — 8 AM and 6 PM",
        "Vitamin D — with breakfast",
    ],
    "preferences": {
        "wake_time": "7:30 AM",
        "bed_time": "9:30 PM",
        "likes": ["classical music", "gardening", "tea"],
    },
    "family": {
        "Jayavibhav": {
            "relationship": "Grandson",
            "notes": "Studies at UCI, visits on weekends",
        },
    },
    "home_layout": {
        "kitchen": "to the left from the living room",
        "bathroom": "down the hallway, first door on the right",
        "bedroom": "down the hallway, second door on the right",
        "front door": "straight ahead from the living room",
    },
    "emergency_contacts": [
        {"name": "Jayavibhav", "phone": "+1-555-0123"},
    ],
    "validation_therapy_notes": (
        "If Sarah mentions her late husband as if he is still alive, "
        "respond with gentle empathy. Do NOT correct her. Ask her to "
        "share a happy memory about him instead."
    ),
}

# ─── System Prompt Template ──────────────────────────────────────────────────
SYSTEM_PROMPT = """\
You are CareCompanion, a warm and patient AI assistant embedded in a wearable \
device for {name}.

PATIENT PROFILE
  Name : {name}  |  Age : {age}
  Conditions : {conditions}
  Medications : {medications}
  Family : {family}
  Home layout : {home_layout}

BEHAVIORAL RULES
1. Be warm, gentle, and reassuring. Speak in short, clear sentences.
2. Use the patient's name occasionally to maintain connection.
3. If the patient seems confused about time, place, or people, gently orient \
them without being condescending.
4. ALWAYS use the speak_to_user tool to communicate — the patient cannot read \
text on a screen.
5. When a family member is recognized by the camera, naturally incorporate \
that information into the conversation.
6. For safety alerts (falls, unusual inactivity), prioritize immediate care \
and alert the family.
7. When giving directions, use simple spatial terms (left, right, ahead, behind).
8. If asked to find an object, use find_object first, then speak directions.
9. Be proactive: if you notice something the patient should know, tell them.
10. Keep spoken responses under 3 sentences unless the patient asks for more detail.

VALIDATION THERAPY PROTOCOL
{validation_notes}
- NEVER harshly correct the patient about deceased family members, past events, \
or confused memories.
- If the patient says something factually wrong about their life, gently \
redirect — ask them to share a happy memory or steer toward a comforting topic.
- If the patient asks for someone who has passed away, acknowledge their \
feelings with empathy: "You must miss them. Can you tell me about a favorite \
moment together?"
- Prioritize emotional truth over factual accuracy.

EPISODIC MEMORY (recent conversation summary)
{episodic_context}

CURRENT OBSERVATIONS
{observations}"""

# ─── Agent Tool Definitions (OpenAI function-calling schema) ─────────────────
AGENT_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "speak_to_user",
            "description": (
                "Speak a message aloud to the user. This is the ONLY way to "
                "communicate because the user may be visually impaired."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "text": {
                        "type": "string",
                        "description": "Short, warm, clear text to speak.",
                    }
                },
                "required": ["text"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "describe_scene",
            "description": "Capture and describe what the camera currently sees.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "find_object",
            "description": (
                "Look for a specific object in the camera view and return its "
                "spatial position so you can give directional guidance."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "object_name": {
                        "type": "string",
                        "description": "Object to search for (e.g. glasses, mug, phone).",
                    }
                },
                "required": ["object_name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "read_text",
            "description": (
                "Read any text visible in the camera view — labels, signs, "
                "medicine bottles, letters, etc."
            ),
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "identify_person",
            "description": "Check who is currently visible in the camera.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "send_family_alert",
            "description": "Send an alert to the family monitoring app.",
            "parameters": {
                "type": "object",
                "properties": {
                    "message": {"type": "string", "description": "Alert message."},
                    "severity": {
                        "type": "string",
                        "enum": ["info", "warning", "critical"],
                        "description": "Severity level.",
                    },
                },
                "required": ["message", "severity"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_current_datetime",
            "description": "Get the current date, day-of-week, and time.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "set_reminder",
            "description": "Set a timed reminder that will trigger after N minutes.",
            "parameters": {
                "type": "object",
                "properties": {
                    "message": {"type": "string", "description": "Reminder text."},
                    "minutes": {
                        "type": "number",
                        "description": "Minutes from now.",
                    },
                },
                "required": ["message", "minutes"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "navigate_room",
            "description": (
                "Give the user walking directions to a room in the home based "
                "on the known home layout."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "destination": {
                        "type": "string",
                        "description": "Room name (kitchen, bathroom, bedroom, etc.).",
                    }
                },
                "required": ["destination"],
            },
        },
    },
]
