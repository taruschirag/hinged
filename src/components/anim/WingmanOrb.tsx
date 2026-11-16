import { Animated, StyleSheet, View } from "react-native";
import { colors } from "@/lib/theme";
import WingmanOrbDom from "./dom/WingmanOrbDom";
import { ClayzoLayer, DOM_PROPS, useClayzoStatus, useLoop, useReduceMotion } from "./runtime";

export type WingmanOrbProps = { state: "idle" | "thinking" | "happy" | "unsure"; size?: number };

const MOODS = { idle: 0, thinking: 1, happy: 2, unsure: 3 } as const;

export function WingmanOrb({ state, size = 96 }: WingmanOrbProps) {
  const { status, onReady, onFailed } = useClayzoStatus();
  const reduceMotion = useReduceMotion();
  return (
    <ClayzoLayer
      status={status}
      onFailed={onFailed}
      style={{ width: size, height: size }}
      fallback={<OrbFallback state={state} size={size} animate={!reduceMotion} />}
    >
      <WingmanOrbDom mood={MOODS[state]} reduceMotion={reduceMotion} onReady={onReady} onFailed={onFailed} dom={DOM_PROPS} />
    </ClayzoLayer>
  );
}

function OrbFallback({ state, size, animate }: WingmanOrbProps & { size: number; animate: boolean }) {
  const t = useLoop(state === "idle" ? 4000 : 2000, animate);
  const body = size * 0.55;
  const motion =
    state === "happy"
      ? [{ translateY: t.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0, -size * 0.07, 0, -size * 0.07, 0] }) }]
      : state === "unsure"
        ? [{ rotate: t.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: ["0deg", "-9deg", "0deg", "7deg", "0deg"] }) }]
        : [{ scale: t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.04, 1] }) }];
  const spin = t.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const eyeHeight = state === "happy" ? body * 0.05 : body * 0.14;

  return (
    <View style={[styles.center, { width: size, height: size }]}>
      <Animated.View style={[styles.center, { width: size, height: size, transform: motion }]}>
        <View style={[styles.disc, { width: size * 0.77, height: size * 0.77, backgroundColor: colors.accent, opacity: 0.1 }]} />
        <View style={[styles.disc, { width: size * 0.66, height: size * 0.66, backgroundColor: colors.accent, opacity: 0.16 }]} />
        <View style={[styles.center, { width: body, height: body, borderRadius: body, backgroundColor: colors.accent }]}>
          <View
            style={{
              position: "absolute",
              left: body * 0.17,
              top: body * 0.15,
              width: body * 0.29,
              height: body * 0.17,
              borderRadius: body,
              backgroundColor: "rgba(255,255,255,0.5)",
              transform: [{ rotate: "-32deg" }],
            }}
          />
          <View style={{ flexDirection: "row", gap: body * 0.2, marginTop: -body * 0.06 }}>
            <View style={{ width: body * 0.1, height: eyeHeight, borderRadius: body, backgroundColor: colors.text }} />
            <View style={{ width: body * 0.1, height: eyeHeight, borderRadius: body, backgroundColor: colors.text }} />
          </View>
        </View>
        {state === "thinking" ? (
          <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate: spin }] }]}>
            <View style={[styles.dot, { left: size / 2 - size * 0.03, top: size * 0.1, width: size * 0.06, height: size * 0.06, backgroundColor: "#FFC14D" }]} />
          </Animated.View>
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  disc: { position: "absolute", borderRadius: 9999 },
  dot: { position: "absolute", borderRadius: 9999 },
});
