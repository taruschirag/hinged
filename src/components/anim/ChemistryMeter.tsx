import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { colors } from "@/lib/theme";
import ChemistryMeterDom from "./dom/ChemistryMeterDom";
import { ClayzoLayer, DOM_PROPS, useClayzoStatus, useLoop, useReduceMotion } from "./runtime";

export type ChemistryMeterProps = { score: number | null; size?: number };

export function ChemistryMeter({ score, size = 96 }: ChemistryMeterProps) {
  const { status, onReady, onFailed } = useClayzoStatus();
  const reduceMotion = useReduceMotion();
  return (
    <ClayzoLayer
      status={status}
      onFailed={onFailed}
      style={{ width: size, height: size }}
      fallback={<MeterFallback score={score} size={size} animate={!reduceMotion} />}
    >
      <ChemistryMeterDom score={score} reduceMotion={reduceMotion} textColor={colors.text} onReady={onReady} onFailed={onFailed} dom={DOM_PROPS} />
    </ClayzoLayer>
  );
}

const DOTS = 36;

function mix(from: string, to: string, t: number) {
  const a = parseInt(from.slice(1), 16);
  const b = parseInt(to.slice(1), 16);
  const channel = (shift: number) => Math.round(((a >> shift) & 255) + (((b >> shift) & 255) - ((a >> shift) & 255)) * t);
  return `rgb(${channel(16)}, ${channel(8)}, ${channel(0)})`;
}

function MeterFallback({ score, size, animate }: { score: number | null; size: number; animate: boolean }) {
  const pulse = useLoop(1600, animate && score === null);
  const progress = useRef(new Animated.Value(0)).current;
  const [value, setValue] = useState(0);

  useEffect(() => {
    const id = progress.addListener(({ value: v }) => setValue(v));
    return () => progress.removeListener(id);
  }, [progress]);

  useEffect(() => {
    const target = score === null ? 0 : Math.max(0, Math.min(100, score));
    if (!animate || score === null) {
      progress.setValue(target);
      return;
    }
    const anim = Animated.timing(progress, { toValue: target, duration: 1000, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    anim.start();
    return () => anim.stop();
  }, [score, animate, progress]);

  const filled = score === null ? 0 : Math.round((value / 100) * DOTS);
  const tint = mix("#CDBFC3", colors.accent, value / 100);
  const dot = size * 0.08;
  const radius = size / 2 - dot;

  return (
    <View style={{ width: size, height: size }}>
      <Animated.View
        style={[StyleSheet.absoluteFill, score === null && { opacity: pulse.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.45, 1, 0.45] }) }]}
      >
        {Array.from({ length: DOTS }, (_, i) => {
          const angle = (i / DOTS) * Math.PI * 2 - Math.PI / 2;
          return (
            <View
              key={i}
              style={{
                position: "absolute",
                left: size / 2 + Math.cos(angle) * radius - dot / 2,
                top: size / 2 + Math.sin(angle) * radius - dot / 2,
                width: dot,
                height: dot,
                borderRadius: dot,
                backgroundColor: i < filled ? tint : score === null ? colors.accentSoft : colors.border,
              }}
            />
          );
        })}
      </Animated.View>
      {score !== null ? (
        <View style={[StyleSheet.absoluteFill, styles.center]}>
          <Text style={[styles.score, { fontSize: size * 0.26 }]}>{Math.round(value)}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  score: { color: colors.text, fontWeight: "800", fontVariant: ["tabular-nums"], letterSpacing: -0.5 },
});
