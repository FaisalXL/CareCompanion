import React, { useEffect } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { stateThemes } from "../constants/theme";
import type { PatientState } from "../types";

interface AmbientOrbProps {
  state: PatientState;
}

export const AmbientOrb: React.FC<AmbientOrbProps> = ({ state }) => {
  const { width } = useWindowDimensions();
  const orbSize = width * 0.52;
  const containerSize = orbSize * 1.8;
  const theme = stateThemes[state];

  const p0 = useSharedValue(1);
  const p1 = useSharedValue(1);
  const p2 = useSharedValue(1);
  const p3 = useSharedValue(1);
  const p4 = useSharedValue(1);

  const ring1 = useSharedValue(0);
  const ring2 = useSharedValue(0);
  const ring3 = useSharedValue(0);

  useEffect(() => {
    const speed = theme.pulseSpeed;
    const ease = Easing.inOut(Easing.sin);

    const layers = [
      { sv: p0, scaleUp: 1.14, scaleDown: 0.97, speedMul: 1.0, delay: 0 },
      { sv: p1, scaleUp: 1.10, scaleDown: 0.96, speedMul: 0.88, delay: speed * 0.18 },
      { sv: p2, scaleUp: 1.08, scaleDown: 0.94, speedMul: 0.78, delay: speed * 0.33 },
      { sv: p3, scaleUp: 1.06, scaleDown: 0.93, speedMul: 0.68, delay: speed * 0.5 },
      { sv: p4, scaleUp: 1.04, scaleDown: 0.92, speedMul: 0.58, delay: speed * 0.65 },
    ];

    layers.forEach(({ sv, scaleUp, scaleDown, speedMul, delay }) => {
      sv.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(scaleUp, { duration: speed * speedMul, easing: ease }),
            withTiming(scaleDown, { duration: speed * speedMul, easing: ease })
          ),
          -1,
          true
        )
      );
    });

    ring1.value = withRepeat(
      withTiming(360, { duration: 28000, easing: Easing.linear }),
      -1,
      false
    );
    ring2.value = withRepeat(
      withTiming(-360, { duration: 38000, easing: Easing.linear }),
      -1,
      false
    );
    ring3.value = withRepeat(
      withTiming(360, { duration: 22000, easing: Easing.linear }),
      -1,
      false
    );
  }, [state]);

  const a0 = useAnimatedStyle(() => ({ transform: [{ scale: p0.value }] }));
  const a1 = useAnimatedStyle(() => ({ transform: [{ scale: p1.value }] }));
  const a2 = useAnimatedStyle(() => ({ transform: [{ scale: p2.value }] }));
  const a3 = useAnimatedStyle(() => ({ transform: [{ scale: p3.value }] }));
  const a4 = useAnimatedStyle(() => ({ transform: [{ scale: p4.value }] }));

  const r1 = useAnimatedStyle(() => ({
    transform: [{ rotate: `${ring1.value}deg` }],
  }));
  const r2 = useAnimatedStyle(() => ({
    transform: [{ rotate: `${ring2.value}deg` }],
  }));
  const r3 = useAnimatedStyle(() => ({
    transform: [{ rotate: `${ring3.value}deg` }],
  }));

  const cx = containerSize / 2;
  const cy = containerSize / 2;

  const glowLayers = [
    { size: orbSize * 1.35, color: theme.colors[2], opacity: 0.04, ox: 0, oy: 0, anim: a0 },
    { size: orbSize * 1.1, color: theme.colors[1], opacity: 0.09, ox: -4, oy: -5, anim: a1 },
    { size: orbSize * 0.88, color: theme.colors[0], opacity: 0.2, ox: 10, oy: 8, anim: a2 },
    { size: orbSize * 0.7, color: theme.colors[1], opacity: 0.35, ox: -8, oy: 10, anim: a3 },
    { size: orbSize * 0.48, color: theme.colors[0], opacity: 0.6, ox: 0, oy: 0, anim: a4 },
  ];

  const rings = [
    { size: orbSize * 1.52, bw: 1.5, opacity: 0.14, ox: 4, oy: -3, anim: r1 },
    { size: orbSize * 1.72, bw: 1, opacity: 0.08, ox: -5, oy: 4, anim: r2 },
    { size: orbSize * 1.38, bw: 1, opacity: 0.1, ox: -2, oy: -5, anim: r3 },
  ];

  return (
    <View style={[styles.container, { width: containerSize, height: containerSize }]}>
      {/* Orbital rings */}
      {rings.map((ring, i) => (
        <Animated.View
          key={"ring-" + i}
          style={[
            styles.ring,
            {
              width: ring.size,
              height: ring.size,
              borderRadius: ring.size / 2,
              borderWidth: ring.bw,
              borderColor: theme.colors[0],
              opacity: ring.opacity,
              left: cx - ring.size / 2 + ring.ox,
              top: cy - ring.size / 2 + ring.oy,
            },
            ring.anim,
          ]}
        />
      ))}

      {/* Glow layers */}
      {glowLayers.map((layer, i) => (
        <Animated.View
          key={"glow-" + i}
          style={[
            styles.orbLayer,
            {
              width: layer.size,
              height: layer.size,
              borderRadius: layer.size / 2,
              backgroundColor: layer.color,
              opacity: layer.opacity,
              left: cx - layer.size / 2 + layer.ox,
              top: cy - layer.size / 2 + layer.oy,
            },
            layer.anim,
          ]}
        />
      ))}

      {/* Core highlight */}
      <View
        style={[
          styles.orbLayer,
          {
            width: orbSize * 0.2,
            height: orbSize * 0.2,
            borderRadius: orbSize * 0.1,
            backgroundColor: "#FFFFFF",
            opacity: 0.12,
            left: cx - orbSize * 0.1 - orbSize * 0.08,
            top: cy - orbSize * 0.1 - orbSize * 0.1,
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "relative",
  },
  orbLayer: {
    position: "absolute",
  },
  ring: {
    position: "absolute",
    borderStyle: "dashed",
  },
});
