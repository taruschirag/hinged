import { Image } from "expo-image";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  cancelAnimation,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { ChemistryMeter } from "@/components/anim/ChemistryMeter";
import { PressableScale } from "@/components/ui/PressableScale";
import { TypingDots } from "@/components/wingman/TypingDots";
import { colors, radius, space } from "@/lib/theme";
import { isStrong, isTalking, type Vibe } from "@/lib/wingman";

type Props = {
  name: string;
  age: number;
  photo: string | null;
  liked: boolean;
  vibe?: Vibe;
  onPress: () => void;
};

export function PersonCard({ name, age, photo, liked, vibe, onPress }: Props) {
  const strong = isStrong(vibe);
  const talking = isTalking(vibe);
  const glow = useSharedValue(0);

  useEffect(() => {
    if (!strong) {
      cancelAnimation(glow);
      glow.set(withTiming(0, { duration: 300 }));
      return;
    }
    glow.set(withRepeat(withTiming(1, { duration: 1400 }), -1, true));
    return () => cancelAnimation(glow);
  }, [strong]);

  const glowStyle = useAnimatedStyle(() => ({
    shadowOpacity: strong ? 0.25 + glow.value * 0.35 : 0,
    borderColor: strong ? `rgba(110, 86, 207, ${0.35 + glow.value * 0.45})` : "transparent",
  }));

  return (
    <PressableScale onPress={onPress} scaleTo={0.95} accessibilityLabel={`${name}, ${age}`}>
      <Animated.View style={[styles.frame, glowStyle]}>
        <View style={styles.photo}>
          {photo ? (
            <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
          ) : (
            <Text style={styles.initial}>{name.slice(0, 1)}</Text>
          )}
          {liked && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>♥ Liked</Text>
            </View>
          )}
          {vibe && vibe.status !== "failed" && (
            <Animated.View entering={FadeIn.duration(300)} style={styles.vibe}>
              <ChemistryMeter score={vibe.status === "done" ? vibe.score : null} size={34} />
              {talking ? (
                <View style={styles.vibeRow}>
                  <Text style={styles.vibeText}>wingmen talking</Text>
                  <TypingDots color={colors.wingman} />
                </View>
              ) : (
                <Text style={[styles.vibeText, strong && { color: colors.wingman }]}>
                  {strong ? "✦ Strong vibe" : `${vibe.score ?? "–"} chemistry`}
                </Text>
              )}
            </Animated.View>
          )}
        </View>
      </Animated.View>
      <Text style={styles.name} numberOfLines={1}>
        {name}, <Text style={styles.age}>{age}</Text>
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: radius.md + 2,
    borderWidth: 2,
    borderColor: "transparent",
    backgroundColor: colors.surface,
    shadowColor: colors.wingman,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  photo: {
    aspectRatio: 3 / 4,
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  initial: { fontSize: 40, fontWeight: "700", color: colors.accent },
  badge: {
    position: "absolute",
    top: space.sm,
    right: space.sm,
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  vibe: {
    position: "absolute",
    left: space.sm,
    right: space.sm,
    bottom: space.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: radius.pill,
    paddingVertical: 4,
    paddingLeft: 4,
    paddingRight: 10,
  },
  vibeRow: { flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 1 },
  vibeText: { fontSize: 12, fontWeight: "700", color: colors.text, flexShrink: 1 },
  name: { fontSize: 16, fontWeight: "700", color: colors.text, marginTop: space.sm, marginLeft: 2 },
  age: { fontWeight: "400", color: colors.muted },
});
