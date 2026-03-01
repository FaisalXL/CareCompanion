import React, { useCallback, useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInUp } from "react-native-reanimated";
import * as ImagePicker from "expo-image-picker";
import {
  User,
  Plus,
  Heart,
  FileText,
  Wifi,
  AlertTriangle,
  Sparkles,
  ShieldCheck,
  Pencil,
} from "lucide-react-native";
import { MedicationCard } from "../../src/components/MedicationCard";
import { LovedOneCard } from "../../src/components/LovedOneCard";
import { SyncButton } from "../../src/components/SyncButton";
import { InputModal } from "../../src/components/InputModal";
import { mockPatientProfile } from "../../src/data/mockProfile";
import {
  syncMedications,
  syncAllFaces,
  syncNotes,
  syncEverything,
  fetchDeviceProfile,
} from "../../src/data/api";
import { colors, shadows, typography } from "../../src/constants/theme";
import type {
  Medication,
  LovedOne,
  PatientNote,
  PatientProfile,
  SyncStatus,
} from "../../src/types";

const NOTE_CATEGORY_COLORS: Record<PatientNote["category"], string> = {
  quirk: colors.amber,
  allergy: colors.coral,
  preference: colors.blue,
  medical: colors.sage,
};

const NOTE_CATEGORY_LABELS: Record<PatientNote["category"], string> = {
  quirk: "Quirk",
  allergy: "Allergy",
  preference: "Preference",
  medical: "Medical",
};

type ModalFlow =
  | null
  | { type: "med-name" }
  | { type: "med-dosage"; name: string }
  | { type: "med-schedule"; name: string; dosage: string }
  | { type: "loved-name" }
  | { type: "loved-rel"; name: string }
  | { type: "note" }
  | { type: "edit-name" }
  | { type: "edit-age" }
  | { type: "edit-blood" }
  | { type: "edit-conditions" }
  | { type: "edit-emergency-name" }
  | { type: "edit-emergency-rel" ; name: string }
  | { type: "edit-emergency-phone"; name: string; relationship: string };

export default function ProfileScreen() {
  const [profile, setProfile] = useState<PatientProfile>(mockPatientProfile);
  const [modalFlow, setModalFlow] = useState<ModalFlow>(null);
  const [deviceConnected, setDeviceConnected] = useState(false);

  const [medSync, setMedSync] = useState<SyncStatus>("idle");
  const [medMessage, setMedMessage] = useState("");
  const [faceSync, setFaceSync] = useState<SyncStatus>("idle");
  const [faceMessage, setFaceMessage] = useState("");
  const [noteSync, setNoteSync] = useState<SyncStatus>("idle");
  const [noteMessage, setNoteMessage] = useState("");
  const [fullSync, setFullSync] = useState<SyncStatus>("idle");
  const [fullMessage, setFullMessage] = useState("");

  useEffect(() => {
    (async () => {
      const dp = await fetchDeviceProfile();
      if (dp) {
        setDeviceConnected(true);
        setProfile((prev) => {
          const merged = { ...prev };
          if (dp.name) merged.name = dp.name;
          if (dp.age) merged.age = dp.age;
          if (dp.conditions && dp.conditions.length > 0)
            merged.conditions = dp.conditions;

          if (dp.medications && dp.medications.length > 0) {
            const localNames = new Set(
              prev.medications.map((m) => m.name.toLowerCase())
            );
            const newFromDevice = dp.medications.filter(
              (dm) => !localNames.has(dm.name.toLowerCase())
            );
            merged.medications = [...prev.medications, ...newFromDevice];
          }

          if (dp.lovedOnes && dp.lovedOnes.length > 0) {
            const deviceNames = new Set(dp.lovedOnes.map((d) => d.name.toLowerCase()));
            const kept = prev.lovedOnes.filter(
              (p) => !deviceNames.has(p.name.toLowerCase())
            );
            merged.lovedOnes = [
              ...dp.lovedOnes.map((dl) => {
                const existing = prev.lovedOnes.find(
                  (p) => p.name.toLowerCase() === dl.name.toLowerCase()
                );
                return {
                  ...dl,
                  imageUri: dl.imageUri || existing?.imageUri || null,
                };
              }),
              ...kept,
            ];
          }
          return merged;
        });
      }
    })();
  }, []);

  const medsRef = React.useRef(profile.medications);
  useEffect(() => {
    if (medsRef.current === profile.medications) return;
    medsRef.current = profile.medications;
    syncMedications(profile.medications).catch(() => {});
  }, [profile.medications]);

  const closeModal = () => setModalFlow(null);

  const handleModalSubmit = useCallback(
    (value: string) => {
      if (!modalFlow) return;

      switch (modalFlow.type) {
        case "med-name":
          setModalFlow({ type: "med-dosage", name: value });
          break;
        case "med-dosage":
          setModalFlow({
            type: "med-schedule",
            name: modalFlow.name,
            dosage: value,
          });
          break;
        case "med-schedule": {
          const newMed: Medication = {
            id: `med-${Date.now()}`,
            name: modalFlow.name,
            dosage: modalFlow.dosage,
            schedule: value,
          };
          setProfile((p) => ({
            ...p,
            medications: [...p.medications, newMed],
          }));
          setModalFlow(null);
          break;
        }
        case "loved-name":
          setModalFlow({ type: "loved-rel", name: value });
          break;
        case "loved-rel": {
          const newPerson: LovedOne = {
            id: `face-${Date.now()}`,
            name: modalFlow.name,
            relationship: value,
            imageUri: null,
          };
          setProfile((p) => ({
            ...p,
            lovedOnes: [...p.lovedOnes, newPerson],
          }));
          setModalFlow(null);
          break;
        }
        case "note": {
          const newNote: PatientNote = {
            id: `note-${Date.now()}`,
            text: value,
            category: "quirk",
          };
          setProfile((p) => ({
            ...p,
            notes: [...p.notes, newNote],
          }));
          setModalFlow(null);
          break;
        }
        case "edit-name":
          setProfile((p) => ({ ...p, name: value }));
          setModalFlow(null);
          break;
        case "edit-age": {
          const parsed = parseInt(value, 10);
          if (!isNaN(parsed)) {
            setProfile((p) => ({ ...p, age: parsed }));
          }
          setModalFlow(null);
          break;
        }
        case "edit-blood":
          setProfile((p) => ({ ...p, bloodType: value }));
          setModalFlow(null);
          break;
        case "edit-conditions":
          setProfile((p) => ({
            ...p,
            conditions: value.split(",").map((c) => c.trim()).filter(Boolean),
          }));
          setModalFlow(null);
          break;
        case "edit-emergency-name":
          setModalFlow({ type: "edit-emergency-rel", name: value });
          break;
        case "edit-emergency-rel":
          setModalFlow({
            type: "edit-emergency-phone",
            name: modalFlow.name,
            relationship: value,
          });
          break;
        case "edit-emergency-phone":
          setProfile((p) => ({
            ...p,
            emergencyContact: {
              name: modalFlow.name,
              relationship: modalFlow.relationship,
              phone: value,
            },
          }));
          setModalFlow(null);
          break;
      }
    },
    [modalFlow]
  );

  const removeMedication = useCallback((id: string) => {
    setProfile((p) => ({
      ...p,
      medications: p.medications.filter((m) => m.id !== id),
    }));
  }, []);

  const removeLovedOne = useCallback((id: string) => {
    setProfile((p) => ({
      ...p,
      lovedOnes: p.lovedOnes.filter((l) => l.id !== id),
    }));
  }, []);

  const pickImage = useCallback(async (id: string) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setProfile((p) => ({
        ...p,
        lovedOnes: p.lovedOnes.map((l) =>
          l.id === id ? { ...l, imageUri: result.assets[0].uri } : l
        ),
      }));
    }
  }, []);

  const removeNote = useCallback((id: string) => {
    setProfile((p) => ({
      ...p,
      notes: p.notes.filter((n) => n.id !== id),
    }));
  }, []);

  const handleSyncMeds = useCallback(async () => {
    setMedSync("syncing");
    try {
      const res = await syncMedications(profile.medications);
      setMedMessage(res.message);
      setMedSync(res.success ? "success" : "error");
    } catch (e: any) {
      setMedMessage(e.message ?? "Failed to sync medications");
      setMedSync("error");
    }
    setTimeout(() => setMedSync("idle"), 3000);
  }, [profile.medications]);

  const handleSyncFaces = useCallback(async () => {
    setFaceSync("syncing");
    try {
      const res = await syncAllFaces(profile.lovedOnes);
      setFaceMessage(res.message);
      setFaceSync(res.success ? "success" : "error");
    } catch (e: any) {
      setFaceMessage(e.message ?? "Failed to sync faces");
      setFaceSync("error");
    }
    setTimeout(() => setFaceSync("idle"), 3000);
  }, [profile.lovedOnes]);

  const handleSyncNotes = useCallback(async () => {
    setNoteSync("syncing");
    try {
      const res = await syncNotes(profile.notes);
      setNoteMessage(res.message);
      setNoteSync(res.success ? "success" : "error");
    } catch (e: any) {
      setNoteMessage(e.message ?? "Failed to sync notes");
      setNoteSync("error");
    }
    setTimeout(() => setNoteSync("idle"), 3000);
  }, [profile.notes]);

  const handleSyncAll = useCallback(async () => {
    setFullSync("syncing");
    try {
      const res = await syncEverything(profile);
      setFullMessage(res.message);
      setFullSync(res.success ? "success" : "error");
    } catch (e: any) {
      setFullMessage(e.message ?? "Full sync failed");
      setFullSync("error");
    }
    setTimeout(() => setFullSync("idle"), 4000);
  }, [profile]);

  const modalConfig = getModalConfig(modalFlow);

  return (
    <View style={styles.container}>
      <SafeAreaView edges={["top"]} style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <Animated.View
            entering={FadeInUp.duration(500)}
            style={styles.header}
          >
            <View>
              <Text style={styles.title}>Patient Profile</Text>
              <Text style={styles.subtitle}>
                Manage care details for the device
              </Text>
            </View>
          </Animated.View>

          {/* Patient Info Card */}
          <Animated.View
            entering={FadeInUp.delay(100).duration(500)}
            style={styles.section}
          >
            <View style={styles.infoCard}>
              <View style={styles.avatarRow}>
                <View style={styles.avatar}>
                  <User color={colors.white} size={32} />
                </View>
                <View style={styles.avatarInfo}>
                  <Pressable
                    onPress={() => setModalFlow({ type: "edit-name" })}
                    style={styles.editableRow}
                  >
                    <Text style={styles.patientName}>{profile.name}</Text>
                    <Pencil color={colors.textMuted} size={14} />
                  </Pressable>
                  <View style={styles.metaRow}>
                    <Pressable
                      onPress={() => setModalFlow({ type: "edit-age" })}
                      style={styles.editableChip}
                    >
                      <Text style={styles.chipText}>{"Age " + profile.age}</Text>
                      <Pencil color={colors.textMuted} size={10} />
                    </Pressable>
                    <Pressable
                      onPress={() => setModalFlow({ type: "edit-blood" })}
                      style={styles.editableChip}
                    >
                      <Text style={styles.chipText}>{profile.bloodType}</Text>
                      <Pencil color={colors.textMuted} size={10} />
                    </Pressable>
                  </View>
                </View>
              </View>

              <Pressable
                onPress={() => setModalFlow({ type: "edit-conditions" })}
                style={styles.conditionsRow}
              >
                <Heart color={colors.coral} size={14} />
                <Text style={styles.conditionsText}>
                  {profile.conditions.join(", ")}
                </Text>
                <Pencil color={colors.textMuted} size={14} />
              </Pressable>

              <Pressable
                onPress={() => setModalFlow({ type: "edit-emergency-name" })}
                style={styles.emergencyRow}
              >
                <AlertTriangle color={colors.amber} size={14} />
                <Text style={styles.emergencyText}>
                  {"Emergency: " +
                    profile.emergencyContact.name +
                    " (" +
                    profile.emergencyContact.relationship +
                    ") — " +
                    profile.emergencyContact.phone}
                </Text>
                <Pencil color={colors.textMuted} size={14} />
              </Pressable>
            </View>
          </Animated.View>

          {/* Medications */}
          <Animated.View
            entering={FadeInUp.delay(200).duration(500)}
            style={styles.section}
          >
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <FileText color={colors.sage} size={20} />
                <Text style={styles.sectionTitle}>Medications</Text>
              </View>
              <Pressable
                onPress={() => setModalFlow({ type: "med-name" })}
                style={styles.addButton}
                accessibilityLabel="Add medication"
              >
                <Plus color={colors.sage} size={20} />
              </Pressable>
            </View>

            {profile.medications.map((med) => (
              <MedicationCard
                key={med.id}
                medication={med}
                onRemove={removeMedication}
              />
            ))}

            <SyncButton
              label="Sync Medications to Device"
              status={medSync}
              lastMessage={medMessage}
              onPress={handleSyncMeds}
            />
          </Animated.View>

          {/* Loved Ones / Faces */}
          <Animated.View
            entering={FadeInUp.delay(300).duration(500)}
            style={styles.section}
          >
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Sparkles color={colors.blue} size={20} />
                <Text style={styles.sectionTitle}>Recognized Faces</Text>
              </View>
              <Pressable
                onPress={() => setModalFlow({ type: "loved-name" })}
                style={styles.addButton}
                accessibilityLabel="Add loved one"
              >
                <Plus color={colors.sage} size={20} />
              </Pressable>
            </View>

            <Text style={styles.sectionHint}>
              Tap a photo to upload a face. The device camera will use these to
              identify visitors.
            </Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.facesRow}
            >
              {profile.lovedOnes.map((person) => (
                <LovedOneCard
                  key={person.id}
                  lovedOne={person}
                  onPickImage={pickImage}
                  onRemove={removeLovedOne}
                />
              ))}
            </ScrollView>

            <SyncButton
              label="Sync Faces to Device"
              status={faceSync}
              lastMessage={faceMessage}
              onPress={handleSyncFaces}
            />
          </Animated.View>

          {/* Notes & Quirks */}
          <Animated.View
            entering={FadeInUp.delay(400).duration(500)}
            style={styles.section}
          >
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <ShieldCheck color={colors.amber} size={20} />
                <Text style={styles.sectionTitle}>Notes & Quirks</Text>
              </View>
              <Pressable
                onPress={() => setModalFlow({ type: "note" })}
                style={styles.addButton}
                accessibilityLabel="Add note"
              >
                <Plus color={colors.sage} size={20} />
              </Pressable>
            </View>

            {profile.notes.map((note) => (
              <Pressable
                key={note.id}
                onLongPress={() => removeNote(note.id)}
                style={styles.noteCard}
              >
                <View
                  style={[
                    styles.noteBadge,
                    {
                      backgroundColor:
                        NOTE_CATEGORY_COLORS[note.category] + "20",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.noteBadgeText,
                      { color: NOTE_CATEGORY_COLORS[note.category] },
                    ]}
                  >
                    {NOTE_CATEGORY_LABELS[note.category]}
                  </Text>
                </View>
                <Text style={styles.noteText}>{note.text}</Text>
              </Pressable>
            ))}

            <Text style={styles.sectionHint}>
              Long press a note to remove it
            </Text>

            <SyncButton
              label="Sync Notes to Device"
              status={noteSync}
              lastMessage={noteMessage}
              onPress={handleSyncNotes}
            />
          </Animated.View>

          {/* Full Sync */}
          <Animated.View
            entering={FadeInUp.delay(500).duration(500)}
            style={[styles.section, styles.fullSyncSection]}
          >
            <View style={styles.deviceInfo}>
              <Wifi color={deviceConnected ? colors.sage : colors.coral} size={20} />
              <Text style={[styles.deviceText, !deviceConnected && { color: colors.coral }]}>
                {deviceConnected
                  ? "CareCompanion · Connected"
                  : "CareCompanion · Offline"}
              </Text>
            </View>
            <SyncButton
              label="Sync Everything to Device"
              status={fullSync}
              lastMessage={fullMessage}
              onPress={handleSyncAll}
            />
          </Animated.View>
        </ScrollView>
      </SafeAreaView>

      {/* Input Modal */}
      {modalConfig ? (
        <InputModal
          visible
          title={modalConfig.title}
          placeholder={modalConfig.placeholder}
          defaultValue={modalConfig.defaultValue}
          submitLabel={modalConfig.submitLabel}
          onSubmit={handleModalSubmit}
          onCancel={closeModal}
        />
      ) : null}
    </View>
  );
}

function getModalConfig(flow: ModalFlow) {
  if (!flow) return null;
  switch (flow.type) {
    case "med-name":
      return {
        title: "Add Medication",
        placeholder: "Medication name",
        defaultValue: "",
        submitLabel: "Next",
      };
    case "med-dosage":
      return {
        title: "Dosage for " + flow.name,
        placeholder: "e.g. 10mg",
        defaultValue: "",
        submitLabel: "Next",
      };
    case "med-schedule":
      return {
        title: "Schedule for " + flow.name,
        placeholder: "e.g. 8:00 AM daily",
        defaultValue: "",
        submitLabel: "Add",
      };
    case "loved-name":
      return {
        title: "Add Loved One",
        placeholder: "Their name",
        defaultValue: "",
        submitLabel: "Next",
      };
    case "loved-rel":
      return {
        title: "Relationship to patient",
        placeholder: "e.g. Son, Daughter, Doctor",
        defaultValue: "",
        submitLabel: "Add",
      };
    case "note":
      return {
        title: "Add Note or Quirk",
        placeholder: "Describe the quirk, allergy, or preference",
        defaultValue: "",
        submitLabel: "Add",
      };
    case "edit-name":
      return {
        title: "Edit Patient Name",
        placeholder: "Full name",
        defaultValue: "",
        submitLabel: "Save",
      };
    case "edit-age":
      return {
        title: "Edit Age",
        placeholder: "Age in years",
        defaultValue: "",
        submitLabel: "Save",
      };
    case "edit-blood":
      return {
        title: "Edit Blood Type",
        placeholder: "e.g. A+, O-, AB+",
        defaultValue: "",
        submitLabel: "Save",
      };
    case "edit-conditions":
      return {
        title: "Edit Conditions",
        placeholder: "Comma-separated list",
        defaultValue: "",
        submitLabel: "Save",
      };
    case "edit-emergency-name":
      return {
        title: "Emergency Contact Name",
        placeholder: "Contact's full name",
        defaultValue: "",
        submitLabel: "Next",
      };
    case "edit-emergency-rel":
      return {
        title: "Relationship",
        placeholder: "e.g. Son, Daughter, Nurse",
        defaultValue: "",
        submitLabel: "Next",
      };
    case "edit-emergency-phone":
      return {
        title: "Phone Number",
        placeholder: "(555) 000-0000",
        defaultValue: "",
        submitLabel: "Save",
      };
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 16,
  },
  title: {
    ...typography.greeting,
  },
  subtitle: {
    ...typography.subtitle,
    marginTop: 3,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: -0.2,
  },
  sectionHint: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 12,
    fontStyle: "italic",
    letterSpacing: 0.1,
  },
  addButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.sageFaint,
    alignItems: "center",
    justifyContent: "center",
  },
  infoCard: {
    backgroundColor: colors.white,
    borderRadius: 24,
    padding: 22,
    ...shadows.md,
  },
  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.sage,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
    ...shadows.sm,
  },
  avatarInfo: {
    flex: 1,
  },
  editableRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  editableChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.cream,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textSecondary,
    letterSpacing: 0.1,
  },
  patientName: {
    fontSize: 21,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: -0.4,
  },
  conditionsRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 8,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  conditionsText: {
    flex: 1,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  emergencyRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 6,
  },
  emergencyText: {
    flex: 1,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  facesRow: {
    paddingBottom: 16,
  },
  noteCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    ...shadows.sm,
  },
  noteBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  noteBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  noteText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
    color: colors.text,
    lineHeight: 20,
  },
  fullSyncSection: {
    backgroundColor: colors.white,
    marginHorizontal: 20,
    paddingVertical: 22,
    borderRadius: 24,
    ...shadows.md,
  },
  deviceInfo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 16,
  },
  deviceText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textMuted,
    letterSpacing: 0.2,
  },
});
