import React, { useCallback, useContext, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeIn, FadeInUp, FadeInRight } from "react-native-reanimated";
import { router } from "expo-router";
import {
  Bell,
  Shield,
  WifiOff,
  AlertTriangle,
  MessageSquare,
  Camera,
  Pill,
  ChevronRight,
  Send,
  X,
  RefreshCw,
  User,
  Eye,
  Mic,
  Clock,
  Footprints,
  Heart,
  Activity,
  Utensils,
  type LucideIcon,
} from "lucide-react-native";
import { AmbientOrb } from "../../src/components/AmbientOrb";
import { EmergencyContext } from "../_layout";
import {
  useDeviceContext,
  useDeviceAlerts,
  useDeviceTimeline,
} from "../../src/hooks/useDevicePolling";
import {
  sendFamilyMessage,
  fetchLiveScene,
  type LiveScene,
} from "../../src/data/api";
import {
  stateThemes,
  colors,
  typography,
  shadows,
} from "../../src/constants/theme";

const QUICK_MESSAGES = [
  "I love you, take care!",
  "Time to take your medicine",
  "Lunch is ready, head to the kitchen",
  "We'll visit you this evening",
  "Don't forget to drink some water",
];

const EVENT_ICONS: Record<string, { icon: LucideIcon; color: string }> = {
  fall_detected: { icon: AlertTriangle, color: colors.coral },
  face_recognized: { icon: User, color: colors.blue },
  "Voice conversation": { icon: Mic, color: colors.sage },
  "Voice query": { icon: Mic, color: colors.sage },
  "Environment check": { icon: Eye, color: colors.amber },
  "Camera view": { icon: Camera, color: colors.amber },
  "Safety concern": { icon: AlertTriangle, color: colors.coral },
  "Care reminder": { icon: Clock, color: colors.lavender },
  "Inactivity detected": { icon: Activity, color: colors.lavender },
  "Family alert": { icon: Bell, color: colors.coral },
  "Family message": { icon: MessageSquare, color: colors.blue },
};

function getEventIcon(summary: string): { icon: LucideIcon; color: string } {
  for (const [key, val] of Object.entries(EVENT_ICONS)) {
    if (summary.toLowerCase().includes(key.toLowerCase())) return val;
  }
  return { icon: Activity, color: colors.textMuted };
}

const STAT_ICONS: Record<string, React.FC<{ color: string; size: number }>> = {
  heart: Heart,
  utensils: Utensils,
  activity: Activity,
};

export default function HomeScreen() {
  const { triggerEmergency } = useContext(EmergencyContext);
  const { context: ctx, stats, connected, refresh } = useDeviceContext();
  const { timeline } = useDeviceTimeline();
  const theme = stateThemes[ctx.state];

  const [lastAlert, setLastAlert] = useState<string | null>(null);
  const [showMessage, setShowMessage] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [msgText, setMsgText] = useState("");
  const [msgSending, setMsgSending] = useState(false);
  const [msgSent, setMsgSent] = useState(false);
  const [scene, setScene] = useState<LiveScene | null>(null);
  const [sceneLoading, setSceneLoading] = useState(false);

  useDeviceAlerts((msg, severity) => {
    setLastAlert(msg);
    if (severity === "critical") triggerEmergency(msg);
  });

  const recentEvents = timeline.slice(0, 6);

  const handleSendMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;
    setMsgSending(true);
    try {
      await sendFamilyMessage(text.trim());
      setMsgSent(true);
      setMsgText("");
      setTimeout(() => { setMsgSent(false); setShowMessage(false); }, 1500);
    } catch {
      setMsgSent(false);
    }
    setMsgSending(false);
  }, []);

  const handleOpenCamera = useCallback(async () => {
    setShowCamera(true);
    setSceneLoading(true);
    try {
      const s = await fetchLiveScene();
      setScene(s);
    } catch {
      setScene({ description: "Could not connect to device camera" });
    }
    setSceneLoading(false);
  }, []);

  const refreshScene = useCallback(async () => {
    setSceneLoading(true);
    try {
      const s = await fetchLiveScene();
      setScene(s);
    } catch {
      setScene({ description: "Could not connect to device camera" });
    }
    setSceneLoading(false);
  }, []);

  return (
    <LinearGradient
      colors={theme.gradient}
      locations={[0, 0.5, 1]}
      style={s.gradient}
    >
      <SafeAreaView style={s.safeArea} edges={["top"]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scrollContent}
        >
          {/* ── Header ─────────────────────────────────────────── */}
          <Animated.View entering={FadeIn.duration(600)} style={s.header}>
            <View>
              <Text style={s.greeting}>{getGreeting()}</Text>
              <Text style={s.subtitle}>
                {ctx.patientName || "Patient"} is {theme.label.toLowerCase()}
              </Text>
            </View>
            <View style={s.headerActions}>
              {!connected && (
                <View style={[s.iconBtn, { backgroundColor: colors.coralFaint }]}>
                  <WifiOff color={colors.coral} size={16} />
                </View>
              )}
              <Pressable
                onPress={refresh}
                onLongPress={() => router.push("/dev-chat")}
                delayLongPress={800}
                style={s.iconBtn}
              >
                <Shield color={colors.sage} size={17} />
              </Pressable>
            </View>
          </Animated.View>

          {/* ── Alert Banner ───────────────────────────────────── */}
          {lastAlert && (
            <Pressable onPress={() => setLastAlert(null)} style={s.alertBanner}>
              <AlertTriangle color={colors.coral} size={15} />
              <Text style={s.alertText} numberOfLines={2}>{lastAlert}</Text>
              <Text style={s.alertDismiss}>Dismiss</Text>
            </Pressable>
          )}

          {/* ── Status Card with mini orb ──────────────────────── */}
          <Animated.View
            entering={FadeInUp.delay(100).duration(500).springify().damping(18)}
            style={s.statusCard}
          >
            <View style={s.statusRow}>
              <View style={s.miniOrbWrap}>
                <AmbientOrb state={ctx.state} />
              </View>
              <View style={s.statusText}>
                <View style={s.stateBadge}>
                  <View style={[s.stateDot, { backgroundColor: theme.colors[0] }]} />
                  <Text style={[s.stateLabel, { color: theme.colors[0] }]}>
                    {theme.label}
                  </Text>
                </View>
                <Text style={s.statusSummary} numberOfLines={2}>
                  {ctx.summary}
                </Text>
                <Text style={s.statusDetail} numberOfLines={2}>
                  {ctx.detail}
                </Text>
              </View>
            </View>
            <View style={s.statusFooter}>
              <View style={s.liveChip}>
                <View style={s.liveDot} />
                <Text style={s.liveLabel}>
                  {connected ? "Live" : "Offline"}
                </Text>
              </View>
              <Text style={s.updatedLabel}>
                Updated {ctx.lastUpdated}
              </Text>
            </View>
          </Animated.View>

          {/* ── Quick Actions ──────────────────────────────────── */}
          <Animated.View
            entering={FadeInUp.delay(200).duration(500).springify().damping(18)}
            style={s.section}
          >
            <Text style={s.sectionTitle}>Quick Actions</Text>
            <View style={s.actionsRow}>
              <Pressable
                onPress={() => setShowMessage(true)}
                style={({ pressed }) => [s.actionCard, pressed && s.pressed]}
              >
                <View style={[s.actionIcon, { backgroundColor: colors.blueFaint }]}>
                  <MessageSquare color={colors.blue} size={20} />
                </View>
                <Text style={s.actionLabel}>Send{"\n"}Message</Text>
              </Pressable>

              <Pressable
                onPress={handleOpenCamera}
                style={({ pressed }) => [s.actionCard, pressed && s.pressed]}
              >
                <View style={[s.actionIcon, { backgroundColor: colors.amberFaint }]}>
                  <Camera color={colors.amber} size={20} />
                </View>
                <Text style={s.actionLabel}>Live{"\n"}Camera</Text>
              </Pressable>

              <Pressable
                onPress={() => router.push("/(tabs)/profile")}
                style={({ pressed }) => [s.actionCard, pressed && s.pressed]}
              >
                <View style={[s.actionIcon, { backgroundColor: colors.sageFaint }]}>
                  <Pill color={colors.sage} size={20} />
                </View>
                <Text style={s.actionLabel}>Meds &{"\n"}Profile</Text>
              </Pressable>
            </View>
          </Animated.View>

          {/* ── Stats Row ──────────────────────────────────────── */}
          <Animated.View
            entering={FadeInUp.delay(250).duration(500).springify().damping(18)}
            style={s.statsBar}
          >
            {stats.map((stat) => {
              const Icon = STAT_ICONS[stat.iconName] ?? Activity;
              return (
                <View key={stat.label} style={s.statCell}>
                  <Icon color={stat.color} size={14} />
                  <Text style={s.statValue}>{stat.value}</Text>
                  <Text style={s.statLabel}>{stat.label}</Text>
                </View>
              );
            })}
          </Animated.View>

          {/* ── Recent Activity ─────────────────────────────────── */}
          <Animated.View
            entering={FadeInUp.delay(300).duration(500).springify().damping(18)}
            style={s.section}
          >
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Recent Activity</Text>
              <Pressable
                onPress={() => router.push("/(tabs)/timeline")}
                style={({ pressed }) => [s.viewAll, pressed && s.pressed]}
              >
                <Text style={s.viewAllText}>View All</Text>
                <ChevronRight color={colors.sage} size={14} />
              </Pressable>
            </View>

            <View style={s.activityList}>
              {recentEvents.length === 0 && (
                <Text style={s.emptyText}>No recent activity</Text>
              )}
              {recentEvents.map((e, i) => {
                const { icon: EIcon, color: eColor } = getEventIcon(e.summary);
                return (
                  <Animated.View
                    key={e.id}
                    entering={FadeInRight.delay(350 + i * 60).duration(400)}
                  >
                    <Pressable
                      onPress={() => router.push("/(tabs)/timeline")}
                      style={({ pressed }) => [
                        s.activityItem,
                        i === recentEvents.length - 1 && s.activityItemLast,
                        pressed && s.pressed,
                      ]}
                    >
                      <View style={[s.activityDot, { backgroundColor: eColor + "18" }]}>
                        <EIcon color={eColor} size={13} />
                      </View>
                      <View style={s.activityContent}>
                        <Text style={s.activitySummary} numberOfLines={1}>
                          {e.summary}
                        </Text>
                        <Text style={s.activityDetail} numberOfLines={1}>
                          {e.detail}
                        </Text>
                      </View>
                      <Text style={s.activityTime}>{e.timestamp}</Text>
                    </Pressable>
                  </Animated.View>
                );
              })}
            </View>
          </Animated.View>

          {/* ── Connection ─────────────────────────────────────── */}
          <Animated.View entering={FadeIn.delay(500).duration(400)}>
            <Pressable onPress={refresh} style={s.connBtn}>
              <Text style={[s.connText, connected && { color: colors.sage }]}>
                {connected
                  ? "● Connected to CareCompanion"
                  : "○ Device Offline — Tap to Retry"}
              </Text>
            </Pressable>
          </Animated.View>

          <View style={{ height: 100 }} />
        </ScrollView>
      </SafeAreaView>

      {/* ════════ Send Message Modal ════════ */}
      <Modal
        visible={showMessage}
        transparent
        animationType="slide"
        onRequestClose={() => setShowMessage(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Send Message</Text>
              <Pressable onPress={() => setShowMessage(false)} style={s.modalClose}>
                <X color={colors.textMuted} size={20} />
              </Pressable>
            </View>
            <Text style={s.modalSubtitle}>
              Your message will be spoken aloud to {ctx.patientName || "the patient"}
            </Text>

            <View style={s.inputRow}>
              <TextInput
                style={s.textInput}
                placeholder="Type a message..."
                placeholderTextColor={colors.textMuted}
                value={msgText}
                onChangeText={setMsgText}
                multiline
                editable={!msgSending}
              />
              <Pressable
                onPress={() => handleSendMessage(msgText)}
                disabled={msgSending || !msgText.trim()}
                style={({ pressed }) => [
                  s.sendBtn,
                  (!msgText.trim() || msgSending) && s.sendBtnDisabled,
                  pressed && s.pressed,
                ]}
              >
                {msgSending ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : msgSent ? (
                  <Text style={s.sentCheck}>✓</Text>
                ) : (
                  <Send color={colors.white} size={18} />
                )}
              </Pressable>
            </View>

            <Text style={s.quickLabel}>Quick Messages</Text>
            <View style={s.quickWrap}>
              {QUICK_MESSAGES.map((qm) => (
                <Pressable
                  key={qm}
                  onPress={() => handleSendMessage(qm)}
                  disabled={msgSending}
                  style={({ pressed }) => [s.quickChip, pressed && s.pressed]}
                >
                  <Text style={s.quickChipText}>{qm}</Text>
                </Pressable>
              ))}
            </View>

            {msgSent && (
              <Text style={s.sentLabel}>Message delivered ✓</Text>
            )}
          </View>
        </View>
      </Modal>

      {/* ════════ Live Camera Modal ════════ */}
      <Modal
        visible={showCamera}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCamera(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Live Camera</Text>
              <View style={s.modalHeaderRight}>
                <Pressable onPress={refreshScene} style={s.refreshBtn}>
                  <RefreshCw color={colors.sage} size={16} />
                </Pressable>
                <Pressable onPress={() => setShowCamera(false)} style={s.modalClose}>
                  <X color={colors.textMuted} size={20} />
                </Pressable>
              </View>
            </View>

            {sceneLoading ? (
              <View style={s.cameraPlaceholder}>
                <ActivityIndicator size="large" color={colors.sage} />
                <Text style={s.cameraLoadText}>Capturing live view...</Text>
              </View>
            ) : scene ? (
              <>
                {scene.b64 ? (
                  <Image
                    source={{ uri: `data:image/jpeg;base64,${scene.b64}` }}
                    style={s.cameraImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={s.cameraPlaceholder}>
                    <Camera color={colors.textMuted} size={40} />
                    <Text style={s.cameraLoadText}>No image available</Text>
                  </View>
                )}
                <View style={s.sceneDescBox}>
                  <Eye color={colors.sage} size={14} />
                  <Text style={s.sceneDesc}>{scene.description}</Text>
                </View>
                {scene.timestamp && (
                  <Text style={s.sceneMeta}>
                    Captured {new Date(scene.timestamp * 1000).toLocaleTimeString([], {
                      hour: "numeric", minute: "2-digit",
                    })}
                  </Text>
                )}
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}

const s = StyleSheet.create({
  gradient: { flex: 1 },
  safeArea: { flex: 1 },
  scrollContent: { paddingBottom: 20 },

  /* header */
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 6,
    paddingBottom: 8,
  },
  greeting: { fontSize: 24, fontWeight: "700", color: colors.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, fontWeight: "500", color: colors.textMuted, marginTop: 2 },
  headerActions: { flexDirection: "row", gap: 8 },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.glass,
    alignItems: "center",
    justifyContent: "center",
  },

  /* alert */
  alertBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 20,
    marginBottom: 8,
    backgroundColor: colors.coralFaint,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.coral + "30",
  },
  alertText: { flex: 1, fontSize: 13, fontWeight: "600", color: colors.coral, lineHeight: 18 },
  alertDismiss: { fontSize: 11, fontWeight: "700", color: colors.textMuted },

  /* status card */
  statusCard: {
    marginHorizontal: 18,
    marginTop: 4,
    backgroundColor: colors.glass,
    borderRadius: 26,
    padding: 18,
    ...shadows.lg,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  miniOrbWrap: {
    width: 80,
    height: 80,
    overflow: "hidden",
    transform: [{ scale: 0.42 }],
    marginLeft: -30,
    marginRight: -24,
  },
  statusText: { flex: 1 },
  stateBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.04)",
    marginBottom: 6,
  },
  stateDot: { width: 6, height: 6, borderRadius: 3 },
  stateLabel: { fontSize: 11, fontWeight: "800", letterSpacing: 0.5, textTransform: "uppercase" },
  statusSummary: { fontSize: 17, fontWeight: "700", color: colors.text, letterSpacing: -0.3, marginBottom: 2 },
  statusDetail: { fontSize: 13, fontWeight: "400", color: colors.textSecondary, lineHeight: 18 },
  statusFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  liveChip: { flexDirection: "row", alignItems: "center", gap: 5 },
  liveDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: "#27AE60" },
  liveLabel: { fontSize: 11, fontWeight: "700", color: "#27AE60", letterSpacing: 0.3 },
  updatedLabel: { fontSize: 11, fontWeight: "500", color: colors.textMuted },

  /* quick actions */
  section: { marginHorizontal: 18, marginTop: 18 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.text, letterSpacing: -0.2, marginBottom: 12 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  actionsRow: { flexDirection: "row", gap: 12 },
  actionCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 20,
    paddingVertical: 18,
    alignItems: "center",
    gap: 10,
    ...shadows.sm,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: { fontSize: 12, fontWeight: "600", color: colors.text, textAlign: "center", lineHeight: 16 },

  /* stats */
  statsBar: {
    flexDirection: "row",
    marginHorizontal: 18,
    marginTop: 16,
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 14,
    ...shadows.sm,
  },
  statCell: { flex: 1, alignItems: "center", gap: 3 },
  statValue: { fontSize: 14, fontWeight: "800", color: colors.text, letterSpacing: -0.2 },
  statLabel: { fontSize: 9, fontWeight: "600", color: colors.textMuted, letterSpacing: 0.4, textTransform: "uppercase" },

  /* recent activity */
  viewAll: { flexDirection: "row", alignItems: "center", gap: 2 },
  viewAllText: { fontSize: 13, fontWeight: "600", color: colors.sage },
  activityList: {
    backgroundColor: colors.white,
    borderRadius: 20,
    overflow: "hidden",
    ...shadows.sm,
  },
  activityItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border + "60",
  },
  activityItemLast: { borderBottomWidth: 0 },
  activityDot: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  activityContent: { flex: 1 },
  activitySummary: { fontSize: 14, fontWeight: "600", color: colors.text, marginBottom: 1 },
  activityDetail: { fontSize: 12, fontWeight: "400", color: colors.textMuted },
  activityTime: { fontSize: 11, fontWeight: "700", color: colors.textMuted, letterSpacing: 0.2 },
  emptyText: { padding: 24, textAlign: "center", fontSize: 13, color: colors.textMuted },

  /* connection */
  connBtn: { alignSelf: "center", paddingVertical: 10, paddingHorizontal: 20, borderRadius: 16, marginTop: 14 },
  connText: { fontSize: 12, fontWeight: "600", color: colors.coral, letterSpacing: 0.2 },

  pressed: { opacity: 0.6, transform: [{ scale: 0.97 }] },

  /* ─── modals ─── */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  modalHeaderRight: { flexDirection: "row", gap: 12, alignItems: "center" },
  modalTitle: { fontSize: 20, fontWeight: "700", color: colors.text, letterSpacing: -0.3 },
  modalSubtitle: { fontSize: 13, color: colors.textMuted, marginBottom: 16 },
  modalClose: { padding: 4 },
  refreshBtn: { padding: 4 },

  /* send message */
  inputRow: { flexDirection: "row", gap: 10, alignItems: "flex-end", marginBottom: 20 },
  textInput: {
    flex: 1,
    backgroundColor: colors.cream,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sendBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.sage,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { backgroundColor: colors.textMuted, opacity: 0.5 },
  sentCheck: { color: colors.white, fontSize: 20, fontWeight: "700" },

  quickLabel: { fontSize: 13, fontWeight: "600", color: colors.textMuted, marginBottom: 10, letterSpacing: 0.3 },
  quickWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  quickChip: {
    backgroundColor: colors.cream,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickChipText: { fontSize: 13, fontWeight: "500", color: colors.text },
  sentLabel: { textAlign: "center", marginTop: 16, fontSize: 14, fontWeight: "600", color: colors.sage },

  /* live camera */
  cameraImage: { width: "100%", height: 220, borderRadius: 16, marginBottom: 12 },
  cameraPlaceholder: {
    width: "100%",
    height: 200,
    borderRadius: 16,
    backgroundColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    marginBottom: 12,
  },
  cameraLoadText: { fontSize: 13, color: colors.textMuted, fontWeight: "500" },
  sceneDescBox: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: colors.sageFaint,
    borderRadius: 14,
    padding: 14,
    alignItems: "flex-start",
  },
  sceneDesc: { flex: 1, fontSize: 14, fontWeight: "400", color: colors.text, lineHeight: 20 },
  sceneMeta: { textAlign: "center", marginTop: 10, fontSize: 11, color: colors.textMuted },
});
