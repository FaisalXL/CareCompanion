import React, { useEffect } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Phone, Siren, X } from "lucide-react-native";
import { colors, shadows } from "../constants/theme";

interface EmergencyModalProps {
  message: string;
  patientName?: string;
  onCall: () => void;
  onDispatch: () => void;
  onDismiss: () => void;
}

export const EmergencyModal: React.FC<EmergencyModalProps> = ({
  message,
  patientName = "Mom",
  onCall,
  onDispatch,
  onDismiss,
}) => {
  const { height } = useWindowDimensions();

  const pulseScale = useSharedValue(1);

  useEffect(() => {
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.12, {
          duration: 600,
          easing: Easing.inOut(Easing.ease),
        }),
        withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  return (
    <View style={[StyleSheet.absoluteFill, styles.wrapper]}>
      <Animated.View
        entering={FadeIn.duration(300)}
        exiting={FadeOut.duration(200)}
        style={styles.overlay}
      />

      <Animated.View
        entering={SlideInDown.springify().damping(22).stiffness(140)}
        exiting={SlideOutDown.duration(300)}
        style={[styles.modal, { maxHeight: height * 0.74 }]}
      >
        <View style={styles.handle} />

        <View style={styles.alertHeader}>
          <Animated.View style={[styles.alertIconOuter, pulseStyle]}>
            <View style={styles.alertIconInner}>
              <Siren color={colors.white} size={30} />
            </View>
          </Animated.View>
          <Text style={styles.alertTitle}>Attention Needed</Text>
          <Text style={styles.alertMessage}>{message}</Text>
        </View>

        <View style={styles.actions}>
          <Pressable
            onPress={onCall}
            style={({ pressed }) => [
              styles.actionButton,
              styles.callButton,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={"Call " + patientName}
          >
            <Phone color={colors.white} size={26} />
            <Text style={styles.callText}>{"Call " + patientName}</Text>
          </Pressable>

          <Pressable
            onPress={onDispatch}
            style={({ pressed }) => [
              styles.actionButton,
              styles.dispatchButton,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Dispatch help"
          >
            <Siren color={colors.white} size={26} />
            <Text style={styles.dispatchText}>Dispatch Help</Text>
          </Pressable>

          <Pressable
            onPress={onDismiss}
            style={({ pressed }) => [
              styles.actionButton,
              styles.dismissButton,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Dismiss alert"
          >
            <X color={colors.textSecondary} size={22} />
            <Text style={styles.dismissText}>{"I'll Handle It"}</Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    justifyContent: "flex-end",
    zIndex: 999,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10, 12, 14, 0.5)",
  },
  modal: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingBottom: 52,
    paddingHorizontal: 28,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 24,
  },
  alertHeader: {
    alignItems: "center",
    marginBottom: 36,
  },
  alertIconOuter: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.emergency + "18",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  alertIconInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.emergency,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.lg,
  },
  alertTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.emergency,
    marginBottom: 8,
    letterSpacing: -0.6,
  },
  alertMessage: {
    fontSize: 17,
    fontWeight: "500",
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 25,
    paddingHorizontal: 16,
  },
  actions: {
    gap: 12,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    borderRadius: 22,
    gap: 12,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  callButton: {
    backgroundColor: "#27AE60",
    ...shadows.md,
  },
  callText: {
    color: colors.white,
    fontSize: 19,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  dispatchButton: {
    backgroundColor: colors.emergency,
    ...shadows.md,
  },
  dispatchText: {
    color: colors.white,
    fontSize: 19,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  dismissButton: {
    backgroundColor: colors.cream,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  dismissText: {
    color: colors.textSecondary,
    fontSize: 17,
    fontWeight: "700",
  },
});
