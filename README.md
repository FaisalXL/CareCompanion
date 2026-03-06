# CareCompanion — Device Software

AI-powered wearable assistant for dementia patients, the visually impaired, and the elderly. Runs on the **Arduino Uno Q** (Linux MPU + MCU) with a camera, accelerometer, speaker, and microphone.

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                     CareAgent (brain)                    │
│         OpenAI function-calling tool loop                │
├──────────┬───────────┬───────────┬───────────────────────┤
│ LLMRouter│ AudioMgr  │ VisionProc│ MemoryManager         │
│ OpenAI → │ LMNT TTS  │ Camera    │ Working (10 msgs)     │
│ Together │ Whisper STT│ SmolVLM  │ Episodic (compressed) │
│ → Local  │ Speaker   │ OpenCV    │ Semantic (profile)    │
├──────────┴───────────┴───────────┴───────────────────────┤
│  FallDetector  │  FaceEngine  │ ProactiveCare │ EventLog │
│  Accelerometer │  YuNet+SFace │ Meds/Meals/   │ JSONL +  │
│  via Bridge    │  Multi-profile│ Orientation  │ REST API │
└──────────────────────────────────────────────────────────┘
```

## Subsystems

| File | Purpose |
|------|---------|
| `main.py` | Entry point — wires all subsystems, REST API endpoints, main loop |
| `agent.py` | Agentic brain — event dispatch, LLM tool-calling loop, speech throttling |
| `llm_router.py` | Triple-LLM router: OpenAI → Together AI → local SmolVLM (llama.cpp) |
| `memory.py` | 3-tier memory: working memory, episodic compression, semantic profile |
| `audio.py` | LMNT TTS + OpenAI Whisper STT, Arduino Speaker peripheral playback |
| `vision.py` | Camera capture, VLM scene description, object finding, OCR, safety analysis |
| `face_engine.py` | Multi-profile face recognition (YuNet detection + SFace recognition) |
| `fall_detector.py` | Accelerometer-based fall detection (free-fall → impact pattern) |
| `proactive.py` | Time-based proactive care: medication, meal, orientation, bedtime reminders |
| `event_logger.py` | Structured JSONL event logging with severity levels and alert tracking |
| `config.py` | Centralized configuration — API keys, thresholds, patient profile, prompts |

## Key Features

- **Agentic LLM**: The agent receives events (falls, faces, voice queries) and uses OpenAI function calling to decide which tools to invoke (speak, describe scene, find object, read text, send alert, navigate room, set reminder)
- **Triple-LLM Fallback**: OpenAI (primary) → Together AI (rate-limit fallback) → local SmolVLM (offline)
- **Face Recognition**: Family members register profiles; device greets them by name and relationship
- **Fall Detection**: Two-phase detection (free-fall + impact), automatic voice check-in, listens for patient response, escalates to family app if distressed or unresponsive
- **Proactive Care**: Time-aware reminders for medications, meals, orientation, bedtime — with speech throttling to avoid overwhelming the patient
- **3-Tier Memory**: Working memory (exact wording), episodic memory (LLM-compressed summaries), semantic profile (static patient info) — all injected into the system prompt
- **Image Capture**: Periodic scene captures saved to disk, vision tool captures logged with `image_id` for frontend display
- **Family Communication**: `POST /api/speak` endpoint receives messages from the family app and speaks them aloud to the patient

## REST API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/status` | Patient info, LLM status, uptime, medications, faces |
| GET | `/api/events` | All logged events (last 1000) |
| GET | `/api/alerts` | Warning/critical severity events |
| GET | `/api/consolidated` | Rich 10-minute summary for the monitoring app |
| GET | `/api/profiles` | All registered face profiles |
| GET | `/api/face-images` | Base64-encoded face profile images |
| GET | `/api/captures` | Captured camera images (by `image_id` or list recent) |
| GET | `/api/scene` | On-demand live camera capture + AI description |
| GET | `/api/memory` | Current memory state export |
| GET | `/api/summary` | Event summary with type counts |
| POST | `/api/speak` | Family sends a message to be spoken to the patient |
| POST | `/api/chat` | Direct LLM chat (debug) — choose provider |
| POST | `/api/profile` | Sync patient profile from the family app |
| POST | `/api/medications` | Sync medications (merges with existing) |
| POST | `/api/faces` | Sync face profiles from the family app |
| POST | `/api/notes` | Sync family notes |

## Hardware Requirements

- Arduino Uno Q (Linux MPU + MCU)
- USB camera module
- Accelerometer (connected via MCU sketch)
- Speaker (USB headset or onboard)
- Microphone (B100 for wake word, USB headset for recording)

## Setup

1. **Install dependencies** on the Arduino:
   ```bash
   pip install -r python/requirements.txt
   ```

2. **Download face detection models** (auto-downloaded on first run):
   - YuNet face detection
   - SFace face recognition

3. **Start the local LLM** (optional, for offline fallback):
   ```bash
   llama-server \
     -m /home/arduino/mymodels/SmolVLM-500M-Instruct-Q8_0.gguf \
     --mmproj /home/arduino/mymodels/mmproj-SmolVLM-500M-Instruct-f16.gguf \
     -c 8192 &
   ```

4. **Deploy and run**:
   ```bash
   # Upload via Arduino IDE or CLI, then the app starts automatically
   # The WebUI is available at http://<device-ip>:7000
   ```

5. **Add face profiles**: Place reference images in the `faces/` directory and update `faces/profiles.json`.

## Configuration

Edit `python/config.py` to customize:
- Patient profile (name, age, conditions, medications, family, home layout)
- Fall detection sensitivity thresholds
- Proactive care schedule (medication times, meal times)
- LLM model selection and API keys
- Speech cooldown and face recognition intervals

## File Structure

```
finalapp/
├── app.yaml                # Arduino app manifest
├── sketch/
│   ├── sketch.ino          # MCU sketch (accelerometer → Bridge)
│   └── sketch.yaml         # Sketch config
├── faces/
│   └── profiles.json       # Registered face profiles
└── python/
    ├── main.py             # Entry point + REST API
    ├── agent.py            # Agentic brain
    ├── llm_router.py       # Triple-LLM router
    ├── memory.py           # 3-tier memory system
    ├── audio.py            # TTS + STT
    ├── vision.py           # Camera + VLM
    ├── face_engine.py      # Face recognition
    ├── fall_detector.py    # Fall detection
    ├── proactive.py        # Proactive care scheduler
    ├── event_logger.py     # Structured logging
    ├── config.py           # Configuration
    └── requirements.txt    # Python dependencies
```

