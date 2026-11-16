import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInLeft, FadeInRight, LinearTransition } from "react-native-reanimated";
import { TypingDots } from "@/components/wingman/TypingDots";
import { colors, radius, space } from "@/lib/theme";

type Props = {
  side: "left" | "right";
  tone: "accent" | "wingman" | "plain";
  text?: string;
  typing?: boolean;
  avatar?: ReactNode;
  label?: string;
};

export function Bubble({ side, tone, text, typing, avatar, label }: Props) {
  const right = side === "right";
  const entering = (right ? FadeInRight : FadeInLeft).springify().damping(16).stiffness(180);
  const filled = tone !== "plain";
  return (
    <Animated.View entering={entering} layout={LinearTransition.springify().damping(18)} style={[styles.wrap, right && styles.wrapRight]}>
      {label && <Text style={[styles.label, right && { textAlign: "right" }]}>{label}</Text>}
      <View style={[styles.row, right && { flexDirection: "row-reverse" }]}>
        {avatar && <View style={styles.avatar}>{avatar}</View>}
        <View
          style={[
            styles.bubble,
            tone === "accent" && styles.accent,
            tone === "wingman" && styles.wingman,
            tone === "plain" && styles.plain,
            right ? styles.tailRight : styles.tailLeft,
          ]}
        >
          {typing ? (
            <TypingDots color={filled ? colors.surface : colors.muted} />
          ) : (
            <Text style={[styles.text, filled && { color: colors.surface }]}>{text}</Text>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: "flex-start", maxWidth: "84%", marginVertical: 3 },
  wrapRight: { alignSelf: "flex-end" },
  label: { fontSize: 11, fontWeight: "700", color: colors.muted, marginBottom: 3, marginHorizontal: space.sm, letterSpacing: 0.3 },
  row: { flexDirection: "row", alignItems: "flex-end", gap: space.xs + 2 },
  avatar: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  bubble: { paddingVertical: space.sm + 2, paddingHorizontal: space.md, borderRadius: radius.md, flexShrink: 1 },
  accent: { backgroundColor: colors.accent },
  wingman: { backgroundColor: colors.wingman },
  plain: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  tailLeft: { borderBottomLeftRadius: 4 },
  tailRight: { borderBottomRightRadius: 4 },
  text: { fontSize: 16, color: colors.text, lineHeight: 21 },
});
