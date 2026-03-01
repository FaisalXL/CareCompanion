import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Camera, Trash2, User } from "lucide-react-native";
import { colors, shadows } from "../constants/theme";
import type { LovedOne } from "../types";

interface LovedOneCardProps {
  lovedOne: LovedOne;
  onPickImage: (id: string) => void;
  onRemove: (id: string) => void;
}

export const LovedOneCard: React.FC<LovedOneCardProps> = ({
  lovedOne,
  onPickImage,
  onRemove,
}) => {
  return (
    <View style={styles.card}>
      <Pressable
        onPress={() => onPickImage(lovedOne.id)}
        style={({ pressed }) => [
          styles.imageArea,
          pressed && styles.imagePressed,
        ]}
        accessibilityLabel={"Upload photo for " + lovedOne.name}
      >
        {lovedOne.imageUri ? (
          <Image source={{ uri: lovedOne.imageUri }} style={styles.image} />
        ) : (
          <View style={styles.placeholder}>
            <User color={colors.textMuted} size={26} />
            <View style={styles.cameraOverlay}>
              <Camera color={colors.white} size={11} />
            </View>
          </View>
        )}
      </Pressable>

      <Text style={styles.name} numberOfLines={1}>
        {lovedOne.name}
      </Text>
      <Text style={styles.relationship} numberOfLines={1}>
        {lovedOne.relationship}
      </Text>

      <Pressable
        onPress={() => onRemove(lovedOne.id)}
        style={({ pressed }) => [
          styles.removeButton,
          pressed && styles.removePressed,
        ]}
        accessibilityLabel={"Remove " + lovedOne.name}
        hitSlop={8}
      >
        <Trash2 color={colors.coral} size={13} />
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 14,
    width: 108,
    marginRight: 12,
    ...shadows.sm,
  },
  imageArea: {
    marginBottom: 10,
  },
  imagePressed: {
    opacity: 0.7,
  },
  image: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  placeholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: "dashed",
  },
  cameraOverlay: {
    position: "absolute",
    bottom: -1,
    right: -1,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.sage,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.white,
  },
  name: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: -0.2,
    marginBottom: 1,
  },
  relationship: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textMuted,
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  removeButton: {
    padding: 4,
  },
  removePressed: {
    opacity: 0.5,
  },
});
