import type { PatientProfile, Medication, LovedOne, PatientNote } from "../types";

interface ApiResponse<T = null> {
  success: boolean;
  message: string;
  data?: T;
  deviceId: string;
  timestamp: string;
}

const DEVICE_ID = "ARD-UNO-R4-0042";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeResponse<T>(
  success: boolean,
  message: string,
  data?: T
): ApiResponse<T> {
  return {
    success,
    message,
    data,
    deviceId: DEVICE_ID,
    timestamp: new Date().toLocaleTimeString(),
  };
}

export async function syncPatientProfile(
  profile: PatientProfile
): Promise<ApiResponse> {
  await delay(1500);
  console.log("[Mock API] POST /device/profile", {
    name: profile.name,
    age: profile.age,
    conditions: profile.conditions,
  });
  return makeResponse(
    true,
    `Patient profile for "${profile.name}" synced to device ${DEVICE_ID}`
  );
}

export async function syncMedications(
  medications: Medication[]
): Promise<ApiResponse<{ scheduledAlerts: number }>> {
  await delay(1800);
  console.log(
    "[Mock API] POST /device/medications",
    medications.map((m) => `${m.name} ${m.dosage}`)
  );
  return makeResponse(
    true,
    `${medications.length} medication(s) synced. Device will alert at scheduled times.`,
    { scheduledAlerts: medications.length }
  );
}

export async function uploadLovedOneFace(
  lovedOne: LovedOne
): Promise<ApiResponse<{ faceEmbeddingId: string }>> {
  await delay(2200);
  const embeddingId = `emb_${lovedOne.id}_${Date.now()}`;
  console.log("[Mock API] POST /device/faces", {
    name: lovedOne.name,
    relationship: lovedOne.relationship,
    hasImage: !!lovedOne.imageUri,
    embeddingId,
  });
  return makeResponse(
    true,
    `Face data for "${lovedOne.name}" uploaded. Device can now recognize them.`,
    { faceEmbeddingId: embeddingId }
  );
}

export async function syncAllFaces(
  lovedOnes: LovedOne[]
): Promise<ApiResponse<{ syncedCount: number; skippedCount: number }>> {
  await delay(2500);
  const withImages = lovedOnes.filter((l) => l.imageUri);
  const skipped = lovedOnes.filter((l) => !l.imageUri);
  console.log("[Mock API] POST /device/faces/bulk", {
    total: lovedOnes.length,
    withImages: withImages.length,
    skipped: skipped.length,
  });
  return makeResponse(
    true,
    `${withImages.length} face(s) synced, ${skipped.length} skipped (no photo).`,
    { syncedCount: withImages.length, skippedCount: skipped.length }
  );
}

export async function syncNotes(
  notes: PatientNote[]
): Promise<ApiResponse> {
  await delay(1200);
  console.log(
    "[Mock API] POST /device/notes",
    notes.map((n) => n.text.slice(0, 40))
  );
  return makeResponse(
    true,
    `${notes.length} note(s) synced. Device context updated.`
  );
}

export async function syncEverything(
  profile: PatientProfile
): Promise<ApiResponse<{ totalItems: number }>> {
  await delay(3000);
  const total =
    1 +
    profile.medications.length +
    profile.lovedOnes.length +
    profile.notes.length;
  console.log("[Mock API] POST /device/sync-all", { totalItems: total });
  return makeResponse(
    true,
    `Full sync complete. ${total} items pushed to device ${DEVICE_ID}.`,
    { totalItems: total }
  );
}
