export type PatientState =
  | "resting"
  | "active"
  | "eating"
  | "confused"
  | "emergency";

export interface ContextEntry {
  id: string;
  timestamp: string;
  state: PatientState;
  summary: string;
  detail: string;
  conversation?: ConversationTurn[];
  imageId?: string;
}

export interface ConversationTurn {
  role: "user" | "assistant" | "system";
  text: string;
  timestamp: string;
}

export interface CurrentContext {
  state: PatientState;
  summary: string;
  detail: string;
  patientName: string;
  lastUpdated: string;
}

export interface StateTheme {
  colors: [string, string, string];
  gradient: string[];
  label: string;
  iconName: string;
  pulseSpeed: number;
}

export interface QuickStat {
  label: string;
  value: string;
  iconName: string;
  color: string;
}

export interface Medication {
  id: string;
  name: string;
  dosage: string;
  schedule: string;
  notes?: string;
}

export interface LovedOne {
  id: string;
  name: string;
  relationship: string;
  imageUri: string | null;
}

export interface PatientNote {
  id: string;
  text: string;
  category: "quirk" | "allergy" | "preference" | "medical";
}

export interface PatientProfile {
  name: string;
  age: number;
  bloodType: string;
  conditions: string[];
  emergencyContact: {
    name: string;
    relationship: string;
    phone: string;
  };
  medications: Medication[];
  lovedOnes: LovedOne[];
  notes: PatientNote[];
}

export type SyncStatus = "idle" | "syncing" | "success" | "error";
