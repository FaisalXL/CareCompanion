import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Pill, Clock, Trash2 } from "lucide-react-native";
import { colors, shadows } from "../constants/theme";
import type { Medication } from "../types";

interface MedicationCardProps {
  medication: Medication;
  onRemove: (id: string) => void;
}

export const MedicationCard: React.FC<MedicationCardProps> = ({
  medication,
  onRemove,
}) => {
  return (
    <View style={styles.card}>
      <View style={styles.iconColumn}>
        <View style={styles.pillIcon}>
          <Pill color={colors.sage} size={18} />
        </View>
      </View>

      <View style={styles.info}>
        <Text style={styles.name}>{medication.name}</Text>
        <Text style={styles.dosage}>{medication.dosage}</Text>
        <View style={styles.scheduleRow}>
          <Clock color={colors.textMuted} size={11} />
          <Text style={styles.schedule}>{medication.schedule}</Text>
        </View>
        {medication.notes ? (
          <Text style={styles.notes}>{medication.notes}</Text>
        ) : null}
      </View>

      <Pressable
        onPress={() => onRemove(medication.id)}
        style={({ pressed }) => [
          styles.removeButton,
          pressed && styles.removePressed,
        ]}
        accessibilityLabel={"Remove " + medication.name}
        hitSlop={12}
      >
        <Trash2 color={colors.coral} size={16} />
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 16,
    marginBottom: 10,
    ...shadows.sm,
  },
  iconColumn: {
    marginRight: 14,
    justifyContent: "center",
  },
  pillIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.sageFaint,
    alignItems: "center",
    justifyContent: "center",
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  dosage: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.sage,
    marginBottom: 4,
  },
  scheduleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  schedule: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textMuted,
    letterSpacing: 0.1,
  },
  notes: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
    fontStyle: "italic",
  },
  removeButton: {
    justifyContent: "center",
    paddingLeft: 10,
  },
  removePressed: {
    opacity: 0.5,
  },
});
