import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";
import { CalendarDays, Radio, WifiOff } from "lucide-react-native";
import { TimelineItem } from "../../src/components/TimelineItem";
import { ConversationModal } from "../../src/components/ConversationModal";
import { useDeviceTimeline } from "../../src/hooks/useDevicePolling";
import { colors, typography, shadows } from "../../src/constants/theme";
import type { ContextEntry } from "../../src/types";

export default function TimelineScreen() {
  const { timeline, connected } = useDeviceTimeline();
  const [selectedEntry, setSelectedEntry] = useState<ContextEntry | null>(null);

  const alertCount = timeline.filter(
    (e) => e.state === "emergency" || e.state === "confused"
  ).length;
  const overallStatus = alertCount > 0 ? "Attention" : "Normal";
  const overallColor = alertCount > 0 ? colors.coral : "#27AE60";

  const dateStr = new Date().toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

  return (
    <View style={styles.container}>
      <SafeAreaView edges={["top"]} style={styles.safeArea}>
        <Animated.View entering={FadeIn.duration(500)} style={styles.header}>
          <View>
            <Text style={styles.title}>Activity</Text>
            <Text style={styles.subtitle}>{"Today's Timeline"}</Text>
          </View>
          <View style={styles.headerRight}>
            {connected ? (
              <View style={styles.liveChip}>
                <Radio color="#27AE60" size={11} />
                <Text style={styles.liveText}>Live</Text>
              </View>
            ) : (
              <View style={[styles.liveChip, { backgroundColor: colors.coralFaint }]}>
                <WifiOff color={colors.coral} size={11} />
                <Text style={[styles.liveText, { color: colors.coral }]}>Offline</Text>
              </View>
            )}
            <View style={styles.dateChip}>
              <CalendarDays color={colors.sage} size={14} />
              <Text style={styles.dateChipText}>{dateStr}</Text>
            </View>
          </View>
        </Animated.View>

        <Animated.View
          entering={FadeInUp.delay(100).duration(400)}
          style={styles.summaryBar}
        >
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{timeline.length}</Text>
            <Text style={styles.summaryLabel}>Events</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{alertCount}</Text>
            <Text style={styles.summaryLabel}>Alerts</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: overallColor }]}>
              {overallStatus}
            </Text>
            <Text style={styles.summaryLabel}>Overall</Text>
          </View>
        </Animated.View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {timeline.map((entry, index) => (
            <TimelineItem
              key={entry.id}
              entry={entry}
              index={index}
              isLast={index === timeline.length - 1}
              onPress={(e) =>
                (e.conversation || e.imageId) && setSelectedEntry(e)
              }
            />
          ))}

          <View style={styles.timelineEnd}>
            <View style={styles.endLine} />
            <Text style={styles.endText}>
              Beginning of recorded activity
            </Text>
          </View>
        </ScrollView>

        {selectedEntry && (selectedEntry.conversation || selectedEntry.imageId) && (
          <ConversationModal
            visible
            turns={selectedEntry.conversation ?? []}
            title={selectedEntry.summary}
            imageId={selectedEntry.imageId}
            onClose={() => setSelectedEntry(null)}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 8,
  },
  title: {
    ...typography.greeting,
  },
  subtitle: {
    ...typography.subtitle,
    marginTop: 3,
  },
  headerRight: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  liveChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#27AE60" + "12",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  liveText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#27AE60",
    letterSpacing: 0.3,
  },
  dateChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.glass,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    ...shadows.sm,
  },
  dateChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.sage,
    letterSpacing: 0.2,
  },
  summaryBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 16,
    borderRadius: 22,
    ...shadows.md,
  },
  summaryItem: {
    flex: 1,
    alignItems: "center",
  },
  summaryValue: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: colors.textMuted,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  summaryDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.border,
  },
  scrollContent: {
    paddingBottom: 120,
    paddingTop: 4,
  },
  timelineEnd: {
    alignItems: "center",
    paddingVertical: 28,
    gap: 10,
  },
  endLine: {
    width: 24,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.border,
  },
  endText: {
    ...typography.caption,
    fontSize: 12,
  },
});
