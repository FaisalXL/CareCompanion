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
# CareCompanion — Family Monitoring App

React Native (Expo) mobile app for family members to monitor a loved one wearing the CareCompanion device. Real-time status, activity timeline, camera view, two-way communication, and emergency alerts.

## Screenshots

| Home | Timeline | Profile | LLM Chat |
|------|----------|---------|----------|
| Live status, quick actions, recent activity | Chronological event log with conversations | Patient info, medications, loved ones sync | Hidden debug console for on-device LLM |

## Features

### Home Dashboard
- **Live patient status** — shows current state (resting, active, eating, confused, emergency) with animated ambient orb
- **Recent activity feed** — last 6 events from the device in compact cards
- **Quick actions**:
  - **Send Message** — type a message or tap a preset; it gets spoken aloud to the patient via TTS
  - **Live Camera** — on-demand camera capture showing what the device sees + AI scene description
  - **Meds & Profile** — quick link to profile management
- **Real-time stats** — mood, last meal, activity level
- **Alert banner** — dismissable notifications for warnings (technical errors filtered out)
- **Emergency modal** — full-screen alert for critical events (falls, distress)

### Activity Timeline
- Chronological event log from the device
- Event types: falls, face recognition, voice conversations, scene captures, safety warnings, medication reminders, family alerts
- **Conversation grouping** — voice interactions grouped into tappable cards with full chat bubbles (Patient / CareCompanion)
- **Inline camera images** — scene captures and vision tool outputs displayed with the event
- Live/Offline indicator with event and alert counts

### Patient Profile
- Edit patient info: name, age, blood type, conditions, emergency contact
- **Medications** — add/remove medications, auto-synced to the device on change
- **Loved Ones** — add family members with photos (via image picker), synced to device face recognition
- **Notes** — family notes (quirks, allergies, preferences, medical) synced to device context
- **Bidirectional sync** — profile data pulled from device on load, pushed on changes

### Emergency System
- Critical alerts (falls, patient distress) trigger a full-screen emergency modal
- Options: Call Emergency, Dispatch Help, Dismiss
- Non-critical warnings shown as dismissable banner on home screen

### Hidden LLM Chat (Debug)
- **Long-press the shield icon** on the home screen (hold ~1 second)
- Direct chat with the on-device LLM
- Provider selector: Auto / Local LLM / Together AI / OpenAI
- Each response tagged with which provider handled it

## Tech Stack

- **React Native** 0.83 + **Expo** 55 + **expo-router** (file-based routing)
- **NativeWind** (Tailwind CSS for React Native)
- **react-native-reanimated** for smooth animations
- **lucide-react-native** for icons
- **expo-image-picker** for loved one photos
- **expo-linear-gradient** for ambient state gradients

## Project Structure

```
irvinehacks-project/
├── app/
│   ├── _layout.tsx              # Root layout (Stack, EmergencyContext)
│   ├── dev-chat.tsx             # Hidden LLM chat page
│   └── (tabs)/
│       ├── _layout.tsx          # Tab bar (Home, Activity, Profile)
│       ├── index.tsx            # Home dashboard
│       ├── timeline.tsx         # Activity timeline
│       └── profile.tsx          # Patient profile management
├── src/
│   ├── config.ts                # Device URL, polling intervals
│   ├── types/index.ts           # TypeScript interfaces
│   ├── constants/theme.ts       # Colors, shadows, typography, state themes
│   ├── data/
│   │   ├── api.ts               # Real API calls to the device
│   │   ├── mockContext.ts       # Fallback mock data
│   │   └── mockProfile.ts      # Default patient profile
│   ├── hooks/
│   │   └── useDevicePolling.ts  # Polling hooks (context, timeline, alerts)
│   └── components/
│       ├── AmbientOrb.tsx       # Animated state orb
│       ├── ConversationModal.tsx # Chat bubble modal (with image support)
│       ├── EmergencyModal.tsx   # Full-screen emergency alert
│       ├── TimelineItem.tsx     # Timeline entry card (with inline images)
│       ├── MedicationCard.tsx   # Medication display card
│       ├── LovedOneCard.tsx     # Loved one card with photo
│       ├── SyncButton.tsx       # Sync status button
│       ├── InputModal.tsx       # Generic text input modal
│       └── StatusCard.tsx       # Stat display card
└── proxy.js                     # CORS proxy for web development
```

## Setup

### Prerequisites
- Node.js 18+
- Expo CLI (`npx expo`)
- CareCompanion device on the same network

### Install

```bash
cd irvinehacks-project
npm install
```

### Configure Device IP

Edit `src/config.ts` and set your device's IP address:

```typescript
const DEVICE_IP = "192.168.3.254";  // ← your Arduino Uno Q IP
```

### Run on Phone (Recommended)

```bash
npx expo start
```

Scan the QR code with **Expo Go** on your phone. The app connects directly to the device (no CORS issues).

### Run on Web (Development)

Start the CORS proxy in one terminal:

```bash
node proxy.js
```

Then start Expo with web:

```bash
npx expo start --web
```

The app automatically routes through `localhost:7001` (proxy) on web, and directly to the device IP on native.

## API Integration

The app communicates with the CareCompanion device via REST API on port 7000:

| Direction | Endpoints | Purpose |
|-----------|-----------|---------|
| **Pull** (GET) | `/api/status`, `/api/events`, `/api/alerts`, `/api/consolidated` | Live monitoring data |
| **Pull** (GET) | `/api/profiles`, `/api/face-images`, `/api/captures`, `/api/scene` | Faces, camera images |
| **Push** (POST) | `/api/profile`, `/api/medications`, `/api/faces`, `/api/notes` | Sync patient data to device |
| **Action** (POST) | `/api/speak` | Send a voice message to the patient |
| **Debug** (POST) | `/api/chat` | Direct LLM chat |

### Polling Intervals

| Data | Interval | Hook |
|------|----------|------|
| Patient context + stats | 5 seconds | `useDeviceContext()` |
| Timeline events | 10 seconds | `useDeviceTimeline()` |
| Alerts | 3 seconds | `useDeviceAlerts()` |

## Color Palette

| Color | Hex | Usage |
|-------|-----|-------|
| Cream | `#FAF8F3` | Background |
| Sage | `#7DAE8B` | Primary, active state, success |
| Blue | `#6BA8CC` | Links, user messages, face events |
| Amber | `#CC9E6A` | Active state, camera, warnings |
| Coral | `#D4736F` | Alerts, errors, emergency |
| Lavender | `#A998C4` | Confused state, reminders |

## Patient States

| State | Gradient | Trigger |
|-------|----------|---------|
| Resting | Green-teal | Default / no activity |
| Active | Warm amber | Movement, conversation |
| Eating | Soft green | Mealtime events |
| Confused | Purple | Safety warnings, confusion |
| Emergency | Red | Falls, critical alerts |
>>>>>>> frontend
