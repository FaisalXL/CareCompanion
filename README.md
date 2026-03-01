<<<<<<< HEAD
# irvinehacks-project

### 1. Free Up Disk Space
```bash
# Check filesystem usage and largest directories
df -h
du -sh /* 2>/dev/null | sort -rh | head -20

# Move large directories from root (/) to the larger /home partition
mv /root/go /home/arduino/go
mv /root/llamacpp /home/arduino/llamacpp

# Clean up system cache and logs to free immediate space
apt clean
journalctl --vacuum-size=10M
```

### 2. Configure Environment Paths
```bash
# Add moved binaries (go, yzma, llama.cpp) to system PATH
echo 'export PATH=$PATH:/home/arduino/llamacpp' >> ~/.bashrc
echo 'export PATH=$PATH:/home/arduino/go/bin' >> ~/.bashrc
echo 'export GOPATH=/home/arduino/go' >> ~/.bashrc
source ~/.bashrc
```

### 3. Download the Vision-Language Model (SmolVLM 500M)
```bash
# Download the main GGUF model via yzma
yzma model get -u https://huggingface.co/ggml-org/SmolVLM-500M-Instruct-GGUF/resolve/main/SmolVLM-500M-Instruct-Q8_0.gguf

# Download the required multimodal projector (mmproj) for vision processing
yzma model get -u https://huggingface.co/ggml-org/SmolVLM-500M-Instruct-GGUF/resolve/main/mmproj-SmolVLM-500M-Instruct-f16.gguf
```

### 4. Test Model with a Static Image
```bash
# Download a test image
curl -o /tmp/test.jpg https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Cat03.jpg/1200px-Cat03.jpg

# Run the model via CLI (using 4 threads for performance)
llama-cli -m /home/arduino/mymodels/SmolVLM-500M-Instruct-Q8_0.gguf \
  --mmproj /home/arduino/mymodels/mmproj-SmolVLM-500M-Instruct-f16.gguf \
  --image /tmp/test.jpg \
  -p "Describe this image." -n 200 -t 4
```

### 5. Camera Integration (Finding the active video node)
```bash
# List available video devices
ls -l /dev/video*

# Test nodes until one successfully captures a frame
ffmpeg -f v4l2 -i /dev/video1 -vframes 1 -q:v 2 /tmp/frame.jpg
ffmpeg -f v4l2 -i /dev/video2 -vframes 1 -q:v 2 /tmp/frame.jpg
```

### 6. Run VLM as a Background API Server (Optional)
```bash
# Start the llama.cpp server with vision support in the background
llama-server -m /home/arduino/mymodels/SmolVLM-500M-Instruct-Q8_0.gguf \
  --mmproj /home/arduino/mymodels/mmproj-SmolVLM-500M-Instruct-f16.gguf \
  -c 8192 > /tmp/llama.log 2>&1 &

# Convert an image to Base64 and send a POST request to the local API
base64 -w0 /tmp/test.jpg > /tmp/img.b64
echo '{"messages":[{"role":"user","content":[{"type":"image_url","image_url":{"url":"data:image/jpeg;base64,'$(cat /tmp/img.b64)'"}},{"type":"text","text":"Describe this image."}]}]}' > /tmp/req.json

curl http://127.0.0.1:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d @/tmp/req.json
```


Running LLM/VLM on Arduino Uno Q
=======

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

