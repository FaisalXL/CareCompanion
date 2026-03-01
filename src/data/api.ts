import { DEVICE_URL } from "../config";
import type {
  PatientProfile,
  Medication,
  LovedOne,
  PatientNote,
  PatientState,
  ContextEntry,
  ConversationTurn,
  CurrentContext,
  QuickStat,
} from "../types";

// ── helpers ──────────────────────────────────────────────────────────────────

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${DEVICE_URL}${path}`, { method: "GET" });
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json();
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${DEVICE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} failed: ${res.status}`);
  return res.json();
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch {
    return iso;
  }
}

// ── derive patient state from backend events ─────────────────────────────────

function deriveState(events: any[], alerts: any[]): PatientState {
  const recentAlerts = alerts.filter(
    (a: any) => Date.now() - new Date(a.timestamp).getTime() < 60_000
  );
  if (recentAlerts.some((a: any) => a.event_type === "fall_detected"))
    return "emergency";
  if (recentAlerts.some((a: any) => a.event_type === "safety_warning"))
    return "confused";

  const recent = events.slice(-5);
  const types = recent.map((e: any) => e.event_type);

  if (types.includes("fall_detected")) return "emergency";

  const scenes = recent
    .filter((e: any) => e.event_type === "scene_capture")
    .map((e: any) => (e.data?.description ?? "").toLowerCase());
  const lastScene = scenes[scenes.length - 1] ?? "";

  if (lastScene.match(/eat|meal|food|kitchen.*table|drink/)) return "eating";
  if (lastScene.match(/walk|mov|stand|active|garden/)) return "active";
  if (lastScene.match(/confus|lost|disoriented|wander/)) return "confused";

  if (types.includes("wake_word") || types.includes("user_query"))
    return "active";

  return "resting";
}

function deriveSummary(
  state: PatientState,
  name: string,
): string {
  const labels: Record<PatientState, string> = {
    resting: `${name} is resting comfortably`,
    active: `${name} is active and moving`,
    eating: `${name} is having a meal`,
    confused: `${name} may need attention`,
    emergency: `${name} may need immediate help`,
  };
  return labels[state];
}

function deriveDetail(
  state: PatientState,
  sceneDesc: string,
  recentEvents: any[]
): string {
  const lastInteraction = recentEvents
    .filter((e: any) => e.event_type === "user_query" || e.event_type === "agent_response")
    .pop();

  if (state === "emergency") return "A fall or critical event was detected recently.";

  if (lastInteraction) {
    const text = lastInteraction.data?.text ?? "";
    if (text) return `Last conversation: "${text.slice(0, 80)}"`;
  }

  if (sceneDesc) {
    const clean = sceneDesc.replace(/^this is /i, "").slice(0, 90);
    return `Surroundings: ${clean}`;
  }

  return "All is well — no recent concerns.";
}

// ── GET: live monitoring ─────────────────────────────────────────────────────

export async function fetchCurrentContext(): Promise<CurrentContext> {
  const [status, consolidated, alerts] = await Promise.all([
    get<any>("/api/status"),
    get<any>("/api/consolidated"),
    get<any>("/api/alerts"),
  ]);

  const events: any[] = consolidated.event_types
    ? Object.entries(consolidated.event_types).map(([k, v]) => ({
        event_type: k,
        count: v,
      }))
    : [];

  const recentEvents = await get<any[]>("/api/events");

  const state = deriveState(recentEvents, alerts);

  const patientName = status.patient ?? "Patient";
  const lastScene =
    consolidated.scene_summaries?.[consolidated.scene_summaries.length - 1] ??
    "";

  return {
    state,
    summary: deriveSummary(state, patientName),
    detail: deriveDetail(state, lastScene, recentEvents),
    patientName,
    lastUpdated: formatTime(consolidated.window_end ?? new Date().toISOString()),
  };
}

export async function fetchQuickStats(): Promise<QuickStat[]> {
  const consolidated = await get<any>("/api/consolidated");
  const memory = await get<any>("/api/memory");

  const faces = consolidated.faces_seen ?? [];
  const interactions = consolidated.interactions_count ?? 0;
  const alerts = (consolidated.alerts ?? []).length;

  return [
    {
      label: "Visitors",
      value: faces.length > 0 ? faces.join(", ") : "None",
      iconName: "heart",
      color: "#E07470",
    },
    {
      label: "Chats",
      value: String(interactions),
      iconName: "activity",
      color: "#7EB8D8",
    },
    {
      label: "Alerts",
      value: String(alerts),
      iconName: "utensils",
      color: alerts > 0 ? "#E07470" : "#8FB89A",
    },
  ];
}

function extractText(data: any): string {
  if (!data) return "";
  if (typeof data === "string") return data;
  if (data.text && typeof data.text === "string") return data.text;
  if (data.message && typeof data.message === "string") return data.message;
  if (data.description && typeof data.description === "string") return data.description;
  return "";
}

const HIDDEN_TYPES = new Set([
  "tool_exec",
  "consolidated_summary",
  "agent_final",
  "unknown_event",
  "profile_synced",
  "medications_synced",
  "faces_synced",
  "notes_synced",
  "critical_event",
]);

const CONVERSATION_TYPES = new Set([
  "wake_word",
  "user_query",
  "agent_response",
  "agent_final",
  "tool_exec",
  "vision_capture",
]);

export async function fetchTimeline(): Promise<ContextEntry[]> {
  const events = await get<any[]>("/api/events");
  const chronological = events.slice();
  const reversed = chronological.slice().reverse();
  const result: ContextEntry[] = [];
  const usedIndices = new Set<number>();

  for (let ri = 0; ri < reversed.length; ri++) {
    const origIdx = chronological.length - 1 - ri;
    if (usedIndices.has(origIdx)) continue;

    const e = reversed[ri];
    if (HIDDEN_TYPES.has(e.event_type)) continue;

    const data = e.data ?? {};
    let state: PatientState = "resting";
    let summary = "";
    let detail = "";
    let conversation: ConversationTurn[] | undefined;

    switch (e.event_type) {
      case "fall_detected":
        state = "emergency";
        summary = "Fall detected";
        detail = `Impact: ${data.magnitude?.toFixed?.(1) ?? "?"}g`;
        break;

      case "face_recognized":
        state = "active";
        summary = `${data.name ?? "Someone"} spotted`;
        detail = data.relationship
          ? `${data.relationship} — confidence ${((data.confidence ?? 0) * 1).toFixed(2)}`
          : `Confidence: ${((data.confidence ?? 0) * 1).toFixed(2)}`;
        break;

      case "wake_word": {
        state = "active";
        const turns: ConversationTurn[] = [];
        let convImageId: string | undefined;
        for (let ci = origIdx; ci < chronological.length; ci++) {
          const ce = chronological[ci];
          if (ci !== origIdx && !CONVERSATION_TYPES.has(ce.event_type)) break;
          usedIndices.add(ci);

          const cd = ce.data ?? {};
          if (ce.event_type === "user_query") {
            turns.push({ role: "user", text: extractText(cd), timestamp: formatTime(ce.timestamp) });
          } else if (ce.event_type === "agent_response" || ce.event_type === "agent_final") {
            const txt = extractText(cd);
            if (txt) turns.push({ role: "assistant", text: txt, timestamp: formatTime(ce.timestamp) });
          } else if (ce.event_type === "tool_exec" && cd.tool === "speak_to_user") {
            const spoken = cd.args?.text ?? "";
            if (spoken) turns.push({ role: "assistant", text: spoken, timestamp: formatTime(ce.timestamp) });
          } else if (ce.event_type === "vision_capture" && cd.image_id) {
            convImageId = cd.image_id;
          }
        }

        const userMsg = turns.find((t) => t.role === "user");
        summary = "Voice conversation";
        detail = userMsg ? `"${userMsg.text}"` : "Interaction started";
        conversation = turns.length > 0 ? turns : undefined;
        if (convImageId) data.image_id = convImageId;
        break;
      }

      case "user_query":
        state = "active";
        summary = "Voice query";
        detail = `"${extractText(data)}"`;
        break;

      case "scene_capture":
        summary = "Environment check";
        detail = extractText(data) || "Scene captured";
        break;

      case "vision_capture":
        state = "active";
        summary =
          data.tool === "find_object"
            ? `Looking for: ${data.query ?? "object"}`
            : data.tool === "read_text"
            ? "Reading text"
            : "Camera view";
        detail = extractText(data) || data.result || "Image captured";
        break;

      case "safety_warning":
        state = "confused";
        summary = "Safety concern";
        detail = extractText(data) || "Potential hazard detected";
        break;

      case "family_alert":
        state = "emergency";
        summary = "Family alert";
        detail = extractText(data);
        break;

      case "proactive_reminder":
        summary = "Care reminder";
        detail = extractText(data) || "Scheduled check-in";
        break;

      case "inactivity_alert":
        state = "confused";
        summary = "Inactivity detected";
        detail = "No movement for an extended period";
        break;

      default:
        summary = e.event_type.replace(/_/g, " ");
        detail = extractText(data) || "";
        break;
    }

    if (!summary) continue;

    result.push({
      id: `${ri}-${e.timestamp}`,
      timestamp: formatTime(e.timestamp),
      state,
      summary: summary.charAt(0).toUpperCase() + summary.slice(1),
      detail,
      conversation,
      imageId: data.image_id ?? undefined,
    });

    if (result.length >= 40) break;
  }

  return result;
}

export async function fetchAlerts(): Promise<any[]> {
  return get("/api/alerts");
}

export async function fetchDeviceProfile(): Promise<Partial<PatientProfile> | null> {
  try {
    const [status, profiles, faceImages] = await Promise.all([
      get<any>("/api/status"),
      get<any[]>("/api/profiles"),
      get<Record<string, string>>("/api/face-images").catch(() => ({})),
    ]);

    const lovedOnes: LovedOne[] = (profiles ?? []).map((p: any, i: number) => {
      const b64 = faceImages[p.name];
      return {
        id: `device-${i}`,
        name: p.name ?? "",
        relationship: p.relationship ?? "",
        imageUri: b64 ? `data:image/jpeg;base64,${b64}` : null,
      };
    });

    const deviceMeds: Medication[] = (status.medications ?? []).map(
      (raw: string, i: number) => {
        const parts = raw.split("—").map((s: string) => s.trim());
        return {
          id: `device-med-${i}`,
          name: parts[0] ?? raw,
          dosage: "",
          schedule: parts[1] ?? "",
        };
      }
    );

    return {
      name: status.patient ?? "",
      age: status.age,
      conditions: status.conditions,
      lovedOnes,
      medications: deviceMeds,
    };
  } catch {
    return null;
  }
}

// ── POST: sync to device ────────────────────────────────────────────────────

interface SyncResponse {
  success: boolean;
  message: string;
}

export async function syncPatientProfile(
  profile: PatientProfile
): Promise<SyncResponse> {
  return post("/api/profile", {
    name: profile.name,
    age: profile.age,
    conditions: profile.conditions,
    emergency_contact: profile.emergencyContact,
    blood_type: profile.bloodType,
  });
}

export async function syncMedications(
  medications: Medication[]
): Promise<SyncResponse> {
  return post("/api/medications", { medications });
}

export async function syncAllFaces(
  lovedOnes: LovedOne[]
): Promise<SyncResponse> {
  const faces = lovedOnes.map((l) => ({
    name: l.name,
    relationship: l.relationship,
    image_uri: l.imageUri,
  }));
  return post("/api/faces", { faces });
}

export async function syncNotes(
  notes: PatientNote[]
): Promise<SyncResponse> {
  return post("/api/notes", { notes });
}

// ── Family communication ────────────────────────────────────────────────────

export async function sendFamilyMessage(
  message: string
): Promise<SyncResponse> {
  return post("/api/speak", { message });
}

export interface LiveScene {
  description: string;
  b64?: string;
  image_id?: string;
  timestamp?: number;
  error?: string;
}

export async function fetchLiveScene(): Promise<LiveScene> {
  return get("/api/scene");
}

// ── LLM chat (debug) ────────────────────────────────────────────────────────

export interface ChatResponse {
  reply: string;
  provider: string;
}

export async function chatWithLLM(
  message: string,
  provider: "auto" | "local" | "together" | "openai" = "auto"
): Promise<ChatResponse> {
  return post("/api/chat", { message, provider });
}

export async function syncEverything(
  profile: PatientProfile
): Promise<SyncResponse> {
  const results = await Promise.allSettled([
    syncPatientProfile(profile),
    syncMedications(profile.medications),
    syncAllFaces(profile.lovedOnes),
    syncNotes(profile.notes),
  ]);
  const failed = results.filter((r) => r.status === "rejected").length;
  if (failed > 0) {
    return {
      success: false,
      message: `${failed} sync(s) failed. ${results.length - failed} succeeded.`,
    };
  }
  return {
    success: true,
    message: `Full sync complete. All data pushed to device.`,
  };
}
