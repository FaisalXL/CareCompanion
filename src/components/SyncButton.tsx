import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { Upload, Check, AlertCircle } from "lucide-react-native";
import { colors, shadows } from "../constants/theme";
import type { SyncStatus } from "../types";

interface SyncButtonProps {
  label: string;
  status: SyncStatus;
  lastMessage?: string;
  onPress: () => void;
}

export const SyncButton: React.FC<SyncButtonProps> = ({
  label,
  status,
  lastMessage,
  onPress,
}) => {
  const isSyncing = status === "syncing";

  return (
    <View>
      <Pressable
        onPress={onPress}
        disabled={isSyncing}
        style={({ pressed }) => [
          styles.button,
          isSyncing && styles.buttonSyncing,
          status === "success" && styles.buttonSuccess,
          status === "error" && styles.buttonError,
          pressed && !isSyncing && styles.buttonPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        {isSyncing ? (
          <ActivityIndicator color={colors.white} size="small" />
        ) : status === "success" ? (
          <Check color={colors.white} size={16} />
        ) : status === "error" ? (
          <AlertCircle color={colors.white} size={16} />
        ) : (
          <Upload color={colors.white} size={16} />
        )}
        <Text style={styles.buttonText}>
          {isSyncing ? "Syncing..." : label}
        </Text>
      </Pressable>

      {lastMessage && status !== "idle" ? (
        <Animated.View entering={FadeIn.duration(300)}>
          <Text
            style={[
              styles.message,
              status === "success" && styles.messageSuccess,
              status === "error" && styles.messageError,
            ]}
          >
            {lastMessage}
          </Text>
        </Animated.View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.sage,
    paddingVertical: 14,
    borderRadius: 16,
    ...shadows.sm,
  },
  buttonSyncing: {
    backgroundColor: colors.amber,
  },
  buttonSuccess: {
    backgroundColor: "#27AE60",
  },
  buttonError: {
    backgroundColor: colors.coral,
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  buttonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  message: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textMuted,
    textAlign: "center",
    marginTop: 8,
    paddingHorizontal: 8,
    letterSpacing: 0.1,
  },
  messageSuccess: {
    color: "#27AE60",
  },
  messageError: {
    color: colors.coral,
  },
});
