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
