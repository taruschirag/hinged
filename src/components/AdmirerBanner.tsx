import { useQuery } from "convex/react";
import * as Haptics from "expo-haptics";
import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@convex/_generated/api";
import { useToken } from "@/lib/session";
import { colors, radius, space } from "@/lib/theme";

const SHOW_MS = 4000;

export function AdmirerBanner() {
  const token = useToken();
  const insets = useSafeAreaInsets();
  const admirers = useQuery(api.likes.secretAdmirers, { token });
  const baseline = useRef<number | null>(null);
  const offset = useRef(new Animated.Value(-200)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = () => {
    Animated.timing(offset, { toValue: -200, duration: 250, useNativeDriver: true }).start();
  };

  useEffect(() => {
    if (!admirers) return;
    if (baseline.current === null) {
      baseline.current = admirers.latestAt;
      return;
    }
    if (admirers.latestAt <= baseline.current) return;
    baseline.current = admirers.latestAt;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    Animated.spring(offset, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start();
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(hide, SHOW_MS);
  }, [admirers?.latestAt]);

  useEffect(() => () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.wrap, { paddingTop: insets.top + space.sm, transform: [{ translateY: offset }] }]}
    >
      <Pressable onPress={hide} style={styles.banner} accessibilityRole="alert">
        <Text style={styles.heart}>♥</Text>
        <Text style={styles.text}>
          <Text style={styles.bold}>Someone nearby just liked you. </Text>
          Like them back to find out who.
        </Text>
      </Pressable>
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
    shadowColor: colors.accent,
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  heart: { fontSize: 22, color: colors.accent },
  text: { flex: 1, color: colors.text, fontSize: 14, lineHeight: 19 },
  bold: { fontWeight: "700" },
});
