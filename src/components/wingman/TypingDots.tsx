import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { colors } from "@/lib/theme";

function Dot({ delay, color }: { delay: number; color: string }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.set(withDelay(delay, withRepeat(withSequence(withTiming(1, { duration: 320 }), withTiming(0, { duration: 320 })), -1)));
    return () => cancelAnimation(t);
  }, [delay]);
  const style = useAnimatedStyle(() => ({ opacity: 0.35 + t.value * 0.65, transform: [{ translateY: -3 * t.value }] }));
  return <Animated.View style={[styles.dot, { backgroundColor: color }, style]} />;
}

export function TypingDots({ color = colors.muted }: { color?: string }) {
  return (
    <View style={styles.row} accessibilityLabel="Typing">
      <Dot delay={0} color={color} />
      <Dot delay={140} color={color} />
      <Dot delay={280} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 4, height: 18 },
  dot: { width: 7, height: 7, borderRadius: 4 },
});
