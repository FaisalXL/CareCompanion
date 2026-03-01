import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Heart, Utensils, Activity } from "lucide-react-native";
import { colors, shadows, typography } from "../constants/theme";

const ICON_MAP: Record<string, React.FC<{ color: string; size: number }>> = {
  heart: Heart,
  utensils: Utensils,
  activity: Activity,
};

interface StatusCardProps {
  label: string;
  value: string;
  iconName: string;
  color: string;
}

export const StatusCard: React.FC<StatusCardProps> = ({
  label,
  value,
  iconName,
  color,
}) => {
  const IconComponent = ICON_MAP[iconName] ?? Activity;

  return (
    <View style={styles.card}>
      <View style={[styles.iconCircle, { backgroundColor: color + "14" }]}>
        <IconComponent color={color} size={18} />
      </View>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 22,
    paddingVertical: 20,
    paddingHorizontal: 12,
    alignItems: "center",
    marginHorizontal: 5,
    ...shadows.md,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  value: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textMuted,
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
});
