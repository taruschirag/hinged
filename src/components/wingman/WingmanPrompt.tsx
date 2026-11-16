import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { WingmanOrb } from "@/components/anim/WingmanOrb";
import { PressableScale } from "@/components/ui/PressableScale";
import { colors, radius, space } from "@/lib/theme";

export function WingmanPrompt() {
  return (
    <Animated.View entering={FadeInDown.springify().damping(16)}>
      <PressableScale style={styles.card} onPress={() => router.push("/wingman/interview")}>
        <View style={styles.orb}>
          <WingmanOrb state="idle" size={48} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Meet your wingman</Text>
          <Text style={styles.body}>Answer 5 quick questions and it’ll check the chemistry with people around you.</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    backgroundColor: colors.wingmanSoft,
    borderRadius: radius.lg,
    padding: space.md,
  },
  orb: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 16, fontWeight: "800", color: colors.text },
  body: { fontSize: 13, color: colors.muted, lineHeight: 18, marginTop: 2 },
  chevron: { fontSize: 28, color: colors.wingman, fontWeight: "300" },
});
