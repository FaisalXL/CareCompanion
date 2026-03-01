import { Platform } from "react-native";

const DEVICE_IP = "192.168.3.254";

// On web, route through local CORS proxy (port 7001)
// On native (phone), hit the device directly (no CORS restrictions)
export const DEVICE_URL =
  Platform.OS === "web"
    ? `http://localhost:7001`
    : `http://${DEVICE_IP}:7000`;

// Polling intervals (ms)
export const POLL_CONTEXT_MS = 5_000;
export const POLL_TIMELINE_MS = 10_000;
