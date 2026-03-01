import React, { useEffect, useState } from "react";
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { X, User, Bot, Camera } from "lucide-react-native";
import { colors, shadows } from "../constants/theme";
import { DEVICE_URL } from "../config";
import type { ConversationTurn } from "../types";

interface Props {
  visible: boolean;
  turns: ConversationTurn[];
  title: string;
  imageId?: string;
  onClose: () => void;
}

export const ConversationModal: React.FC<Props> = ({
  visible,
  turns,
  title,
  imageId,
  onClose,
}) => {
  const [imgB64, setImgB64] = useState<string | null>(null);

  useEffect(() => {
    if (!imageId) { setImgB64(null); return; }
    fetch(`${DEVICE_URL}/api/captures?image_id=${imageId}`)
      .then((r) => r.json())
      .then((d) => { if (d.b64) setImgB64(d.b64); })
      .catch(() => {});
  }, [imageId]);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <X color={colors.textMuted} size={20} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {imgB64 && (
              <View style={styles.imageWrap}>
                <Image
                  source={{ uri: `data:image/jpeg;base64,${imgB64}` }}
                  style={styles.captureImg}
                  resizeMode="cover"
                />
                <View style={styles.imageBadge}>
                  <Camera color={colors.white} size={11} />
                  <Text style={styles.imageBadgeText}>Device Camera</Text>
                </View>
              </View>
            )}
            {turns.map((turn, i) => (
              <View
                key={i}
                style={[
                  styles.bubble,
                  turn.role === "user" ? styles.userBubble : styles.assistantBubble,
                ]}
              >
                <View style={styles.roleRow}>
                  {turn.role === "user" ? (
                    <User color={colors.blue} size={12} />
                  ) : (
                    <Bot color={colors.sage} size={12} />
                  )}
                  <Text
                    style={[
                      styles.roleLabel,
                      { color: turn.role === "user" ? colors.blue : colors.sage },
                    ]}
                  >
                    {turn.role === "user" ? "Patient" : "CareCompanion"}
                  </Text>
                  <Text style={styles.turnTime}>{turn.timestamp}</Text>
                </View>
                <Text style={styles.turnText}>{turn.text}</Text>
              </View>
            ))}

            {turns.length === 0 && (
              <Text style={styles.empty}>No conversation content recorded.</Text>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.cream,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "75%",
    paddingBottom: 40,
    ...shadows.lg,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: -0.3,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.glass,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    gap: 10,
  },
  bubble: {
    borderRadius: 18,
    padding: 14,
    maxWidth: "88%",
  },
  userBubble: {
    backgroundColor: colors.blueFaint,
    alignSelf: "flex-end",
    borderBottomRightRadius: 6,
  },
  assistantBubble: {
    backgroundColor: colors.white,
    alignSelf: "flex-start",
    borderBottomLeftRadius: 6,
    ...shadows.sm,
  },
  roleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 6,
  },
  roleLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  turnTime: {
    fontSize: 10,
    color: colors.textMuted,
    marginLeft: "auto",
  },
  turnText: {
    fontSize: 15,
    fontWeight: "400",
    color: colors.text,
    lineHeight: 22,
  },
  imageWrap: {
    marginBottom: 12,
    borderRadius: 16,
    overflow: "hidden",
    position: "relative",
  },
  captureImg: {
    width: "100%",
    height: 180,
    borderRadius: 16,
  },
  imageBadge: {
    position: "absolute",
    bottom: 8,
    left: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  imageBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.white,
    letterSpacing: 0.3,
  },
  empty: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: 30,
  },
});
