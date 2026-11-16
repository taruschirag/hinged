import * as Haptics from "expo-haptics";
import { useEffect, useRef, type ReactNode } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { spring } from "@/lib/motion";
import { colors, radius, space } from "@/lib/theme";

const SHOW_MS = 4000;
const HIDDEN = -220;

type Props = {
  signal: number | undefined;
  icon: ReactNode;
  title: string;
  body: string;
  tint?: string;
  onPress?: () => void;
};

export function TopBanner({ signal, icon, title, body, tint = colors.accent, onPress }: Props) {
  const insets = useSafeAreaInsets();
  const baseline = useRef<number | null>(null);
  const offset = useSharedValue(HIDDEN);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = () => {
    offset.set(withTiming(HIDDEN, { duration: 250 }));
  };

  useEffect(() => {
    if (signal === undefined) return;
    if (baseline.current === null) {
      baseline.current = signal;
      return;
    }
    if (signal <= baseline.current) return;
    baseline.current = signal;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    offset.set(withSpring(0, spring));
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(hide, SHOW_MS);
  }, [signal]);

  useEffect(
    () => () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    },
    [],
  );

  const pan = usePanGesture({
    runOnJS: true,
    onUpdate: (e) => {
      offset.set(Math.min(0, e.translationY));
    },
    onDeactivate: (e) => {
      if (e.translationY < -30) hide();
      else offset.set(withSpring(0, spring));
    },
  });

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: offset.value }] }));

  return (
    <Animated.View pointerEvents="box-none" style={[styles.wrap, { paddingTop: insets.top + space.sm }, style]}>
      <GestureDetector gesture={pan}>
        <Pressable
          onPress={() => {
            hide();
            onPress?.();
          }}
          style={[styles.banner, { shadowColor: tint }]}
          accessibilityRole="alert"
        >
          {icon}
          <Text style={styles.text}>
            <Text style={styles.bold}>{title} </Text>
            {body}
          </Text>
        </Pressable>
      </GestureDetector>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", top: 0, left: 0, right: 0, paddingHorizontal: space.md, zIndex: 100 },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accentSoft,
    padding: space.md,
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  text: { flex: 1, color: colors.text, fontSize: 14, lineHeight: 19 },
  bold: { fontWeight: "700" },
});
