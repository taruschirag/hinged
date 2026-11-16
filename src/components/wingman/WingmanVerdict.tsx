import Ionicons from "@expo/vector-icons/Ionicons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { ChemistryMeter } from "@/components/anim/ChemistryMeter";
import { PressableScale } from "@/components/ui/PressableScale";
import { savedOpener, saveOpener } from "@/lib/openers";
import { colors, radius, space } from "@/lib/theme";
import { STRONG_VIBE } from "@/lib/wingman";

type Props = {
  score: number | null;
  why: string[];
  opener: string | null;
  userId?: string;
  onUseInChat?: (opener: string) => void;
};

function verdict(score: number | null) {
  if (score === null) return "Still reading the room";
  if (score >= STRONG_VIBE) return "Strong vibe. Go say hi.";
  if (score >= 50) return "Some real overlap";
  return "Maybe not your person";
}

export function WingmanVerdict({ score, why, opener, userId, onUseInChat }: Props) {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(() => !!userId && savedOpener(userId) === opener);

  const copy = async () => {
    if (!opener) return;
    await Clipboard.setStringAsync(opener).catch(() => {});
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const save = () => {
    if (!opener || !userId) return;
    saveOpener(userId, opener);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setSaved(true);
  };

  return (
    <View style={{ gap: space.md }}>
      <View style={styles.scoreRow}>
        <ChemistryMeter score={score} size={76} />
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>CHEMISTRY</Text>
          <Text style={styles.score}>
            {score ?? "–"}
            <Text style={styles.outOf}>/100</Text>
          </Text>
          <Text style={styles.verdict}>{verdict(score)}</Text>
        </View>
      </View>

      {why.slice(0, 2).map((line, i) => (
        <Animated.View key={line} entering={FadeInDown.delay(120 + i * 110).springify().damping(16)} style={styles.whyRow}>
          <Text style={styles.spark}>✦</Text>
          <Text style={styles.whyText}>{line}</Text>
        </Animated.View>
      ))}

      {opener && (
        <Animated.View entering={FadeInDown.delay(380).springify().damping(16)} style={styles.openerBox}>
          <Text style={styles.kicker}>YOUR OPENER</Text>
          <Text style={styles.opener}>“{opener}”</Text>
          <View style={styles.actions}>
            <PressableScale onPress={copy} style={styles.chip} accessibilityLabel="Copy opener">
              <Ionicons name={copied ? "checkmark" : "copy-outline"} size={15} color={colors.wingman} />
              <Text style={styles.chipText}>{copied ? "Copied" : "Copy"}</Text>
            </PressableScale>
            {onUseInChat ? (
              <PressableScale onPress={() => onUseInChat(opener)} style={[styles.chip, styles.chipSolid]}>
                <Ionicons name="chatbubble-ellipses-outline" size={15} color={colors.surface} />
                <Text style={[styles.chipText, { color: colors.surface }]}>Use in chat</Text>
              </PressableScale>
            ) : (
              userId && (
                <PressableScale onPress={save} disabled={saved} style={[styles.chip, saved && styles.chipSolid]}>
                  <Ionicons name={saved ? "checkmark-circle" : "bookmark-outline"} size={15} color={saved ? colors.surface : colors.wingman} />
                  <Text style={[styles.chipText, saved && { color: colors.surface }]}>
                    {saved ? "Ready for your first message" : "Use in chat after you match"}
                  </Text>
                </PressableScale>
              )
            )}
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  scoreRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  kicker: { fontSize: 11, fontWeight: "800", color: colors.wingman, letterSpacing: 1 },
  score: { fontSize: 34, fontWeight: "800", color: colors.text, marginTop: 2 },
  outOf: { fontSize: 16, fontWeight: "600", color: colors.muted },
  verdict: { fontSize: 14, color: colors.muted, fontWeight: "600" },
  whyRow: { flexDirection: "row", gap: space.sm },
  spark: { color: colors.wingman, fontSize: 14, marginTop: 2 },
  whyText: { flex: 1, fontSize: 15, color: colors.text, lineHeight: 21 },
  openerBox: { backgroundColor: colors.wingmanSoft, borderRadius: radius.md, padding: space.md, gap: space.sm },
  opener: { fontSize: 17, color: colors.text, lineHeight: 23, fontWeight: "600" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.xs },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.wingman,
    paddingVertical: 7,
    paddingHorizontal: space.md - 2,
    backgroundColor: colors.surface,
  },
  chipSolid: { backgroundColor: colors.wingman },
  chipText: { color: colors.wingman, fontWeight: "700", fontSize: 13 },
});
