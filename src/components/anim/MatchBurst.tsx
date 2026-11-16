import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/lib/theme";
import MatchBurstDom from "./dom/MatchBurstDom";
import { DOM_PROPS, DomBoundary, useClayzoStatus, useReduceMotion } from "./runtime";

export type MatchBurstProps = { play: boolean; onDone?: () => void };

const DURATION = 1500;
const START_DEADLINE = 700;

export function MatchBurst({ play, onDone }: MatchBurstProps) {
  const { status, onReady, onFailed } = useClayzoStatus();
  const reduceMotion = useReduceMotion();
  const [playId, setPlayId] = useState(0);
  const [running, setRunning] = useState(false);
  const [useFallback, setUseFallback] = useState(false);
  const runningRef = useRef(false);
  const statusRef = useRef(status);
  statusRef.current = status;
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const finish = useCallback(async () => {
    if (!runningRef.current) return;
    runningRef.current = false;
    setRunning(false);
    setUseFallback(false);
    onDoneRef.current?.();
  }, []);

  useEffect(() => {
    if (!play) {
      runningRef.current = false;
      setRunning(false);
      return;
    }
    runningRef.current = true;
    setRunning(true);
    setPlayId((id) => id + 1);
    const deadline = setTimeout(() => {
      if (statusRef.current !== "ready") setUseFallback(true);
    }, START_DEADLINE);
    const safety = setTimeout(() => void finish(), DURATION + START_DEADLINE + 600);
    return () => {
      clearTimeout(deadline);
      clearTimeout(safety);
    };
  }, [play, finish]);

  const fallback = status === "failed" || useFallback;

  return (
    <View style={[StyleSheet.absoluteFill, styles.overlay, !running && styles.hidden]} pointerEvents="none">
      {fallback ? (
        running ? <BurstFallback key={playId} onFinished={finish} animate={!reduceMotion} /> : null
      ) : (
        <DomBoundary onError={() => void onFailed("render error")}>
          <MatchBurstDom playId={running ? playId : 0} reduceMotion={reduceMotion} onReady={onReady} onFailed={onFailed} onFinished={finish} dom={DOM_PROPS} />
        </DomBoundary>
      )}
    </View>
  );
}

const PARTICLES = Array.from({ length: 16 }, (_, i) => ({
  angle: (i / 16) * Math.PI * 2 + (i % 2) * 0.2,
  distance: 0.28 + ((i * 37) % 10) / 60,
  heart: i % 2 === 0,
  color: [colors.accent, "#FFC14D", "#FF9A62", "#FF8FA6"][i % 4],
}));

function BurstFallback({ onFinished, animate }: { onFinished: () => void; animate: boolean }) {
  const { width, height } = useWindowDimensions();
  const span = Math.min(width, height);
  const t = useRef(new Animated.Value(animate ? 0 : 0.3)).current;

  useEffect(() => {
    if (!animate) {
      const timer = setTimeout(onFinished, 1200);
      return () => clearTimeout(timer);
    }
    const anim = Animated.timing(t, { toValue: 1, duration: DURATION, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    anim.start(({ finished }) => finished && onFinished());
    return () => anim.stop();
  }, [t, onFinished, animate]);

  const fade = t.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] });
  return (
    <View style={[StyleSheet.absoluteFill, styles.center]}>
      {PARTICLES.map((p, i) => {
        const dx = Math.cos(p.angle) * p.distance * span;
        const dy = Math.sin(p.angle) * p.distance * span;
        return (
          <Animated.View
            key={i}
            style={{
              position: "absolute",
              opacity: fade,
              transform: [
                { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [0, dx] }) },
                { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, dy + span * 0.08] }) },
                { rotate: t.interpolate({ inputRange: [0, 1], outputRange: ["0deg", `${(i % 2 ? 1 : -1) * 220}deg`] }) },
              ],
            }}
          >
            {p.heart ? (
              <Ionicons name="heart" size={span * 0.06} color={p.color} />
            ) : (
              <View style={{ width: span * 0.018, height: span * 0.034, borderRadius: 3, backgroundColor: p.color }} />
            )}
          </Animated.View>
        );
      })}
      <Animated.View
        style={{
          opacity: fade,
          transform: [{ scale: t.interpolate({ inputRange: [0, 0.2, 0.3, 1], outputRange: [0, 1.25, 1, 1.3] }) }],
        }}
      >
        <Ionicons name="heart" size={span * 0.3} color={colors.accent} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { zIndex: 1000, elevation: 1000 },
  hidden: { opacity: 0 },
  center: { alignItems: "center", justifyContent: "center" },
});
