import React, { useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInLeft } from "react-native-reanimated";
import {
  Moon,
  Footprints,
  Utensils,
  CircleHelp,
  TriangleAlert,
  MessageCircle,
  Camera,
} from "lucide-react-native";
import { stateThemes, colors, typography, shadows } from "../constants/theme";
import { DEVICE_URL } from "../config";
import type { ContextEntry, PatientState } from "../types";

const STATE_ICONS: Record<
  PatientState,
  React.FC<{ color: string; size: number }>
> = {
  resting: Moon,
  active: Footprints,
  eating: Utensils,
  confused: CircleHelp,
  emergency: TriangleAlert,
};

const STATE_TINTS: Record<PatientState, string> = {
  resting: "#EDF4EC",
  active: "#FBF3EA",
  eating: "#EDF4EC",
  confused: "#F2EFF8",
  emergency: "#FDF0EF",
};

interface TimelineItemProps {
  entry: ContextEntry;
  index: number;
  isLast: boolean;
  onPress?: (entry: ContextEntry) => void;
}

export const TimelineItem: React.FC<TimelineItemProps> = ({
  entry,
  index,
  isLast,
  onPress,
}) => {
  const theme = stateThemes[entry.state];
  const dotColor = theme.colors[0];
  const IconComponent = STATE_ICONS[entry.state];
  const tint = STATE_TINTS[entry.state];
  const hasConversation = entry.conversation && entry.conversation.length > 0;
  const hasImage = !!entry.imageId;

  const [imgB64, setImgB64] = useState<string | null>(null);
  useEffect(() => {
    if (!entry.imageId) return;
    fetch(`${DEVICE_URL}/api/captures?image_id=${entry.imageId}`)
      .then((r) => r.json())
      .then((d) => { if (d.b64) setImgB64(d.b64); })
      .catch(() => {});
  }, [entry.imageId]);

  const card = (
    <View style={[styles.card, { backgroundColor: tint }]}>
      <View style={styles.cardHeader}>
        <View
          style={[styles.stateChip, { backgroundColor: dotColor + "18" }]}
        >
          <IconComponent color={dotColor} size={10} />
          <Text style={[styles.stateChipText, { color: dotColor }]}>
            {theme.label}
          </Text>
        </View>
        {hasImage && (
          <View style={styles.chatBadge}>
            <Camera color={colors.blue} size={11} />
          </View>
        )}
        {hasConversation && (
          <View style={styles.chatBadge}>
            <MessageCircle color={colors.blue} size={11} />
            <Text style={styles.chatBadgeText}>
              {entry.conversation!.length}
            </Text>
          </View>
        )}
      </View>
      <Text style={styles.summary}>{entry.summary}</Text>
      {imgB64 && (
        <Image
          source={{ uri: `data:image/jpeg;base64,${imgB64}` }}
          style={styles.captureImage}
          resizeMode="cover"
        />
      )}
      <Text style={styles.detail} numberOfLines={2}>{entry.detail}</Text>
      {hasConversation && (
        <Text style={styles.tapHint}>Tap to view conversation</Text>
      )}
    </View>
  );

  return (
    <Animated.View
      entering={FadeInLeft.delay(Math.min(index * 40, 400))
        .duration(400)
        .springify()
        .damping(20)}
      style={styles.container}
    >
      <View style={styles.timeColumn}>
        <Text style={styles.time}>{entry.timestamp}</Text>
      </View>

      <View style={styles.dotColumn}>
        <View style={[styles.dot, { backgroundColor: dotColor }]}>
          <IconComponent color={colors.white} size={11} />
        </View>
        {!isLast && (
          <View style={[styles.line, { backgroundColor: dotColor + "20" }]} />
        )}
      </View>

      <View style={styles.contentColumn}>
        {hasConversation || hasImage ? (
          <Pressable
            onPress={() => onPress?.(entry)}
            style={({ pressed }) => pressed && { opacity: 0.7 }}
          >
            {card}
          </Pressable>
        ) : (
          card
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    marginBottom: 2,
    minHeight: 90,
  },
  timeColumn: {
    width: 68,
    paddingTop: 18,
    alignItems: "flex-end",
    paddingRight: 14,
  },
  time: {
    ...typography.timelineTime,
  },
  dotColumn: {
    width: 28,
    alignItems: "center",
  },
  dot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
    zIndex: 1,
    ...shadows.sm,
  },
  line: {
    width: 2,
    flex: 1,
    marginTop: 4,
    borderRadius: 1,
  },
  contentColumn: {
    flex: 1,
    paddingLeft: 12,
    paddingRight: 20,
    paddingBottom: 10,
  },
  card: {
    borderRadius: 18,
    padding: 16,
    ...shadows.sm,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  stateChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  stateChipText: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  chatBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: colors.blueFaint,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
  },
  chatBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.blue,
  },
  summary: {
    ...typography.timelineTitle,
    marginBottom: 4,
  },
  captureImage: {
    width: "100%",
    height: 140,
    borderRadius: 12,
    marginBottom: 8,
  },
  detail: {
    ...typography.timelineDetail,
  },
  tapHint: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.blue,
    marginTop: 8,
    letterSpacing: 0.2,
  },
});
