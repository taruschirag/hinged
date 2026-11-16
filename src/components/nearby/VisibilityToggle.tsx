import { useMutation } from "convex/react";
import * as Haptics from "expo-haptics";
import { useState } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { api } from "@convex/_generated/api";
import { useToken } from "@/lib/session";
import { colors, radius, space } from "@/lib/theme";

export function VisibilityToggle({ visibleUntil, now }: { visibleUntil: number; now: number }) {
  const token = useToken();
  const setVisible = useMutation(api.users.setVisible);
  const [pending, setPending] = useState<boolean | null>(null);
  const serverVisible = visibleUntil > now;
  const visible = pending ?? serverVisible;
  const minutesLeft = Math.max(1, Math.ceil((visibleUntil - now) / 60000));

  async function toggle(next: boolean) {
    setPending(next);
    Haptics.selectionAsync().catch(() => {});
    try {
      await setVisible({ token, visible: next });
    } finally {
      setPending(null);
    }
  }

  return (
    <Pressable onPress={() => toggle(!visible)} style={[styles.card, visible && styles.cardOn]}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, visible && styles.titleOn]}>I'm open right now</Text>
        <Text style={styles.subtitle}>
          {visible && serverVisible
            ? `Visible to people nearby · ${minutesLeft} min left`
            : "Turn on to see and be seen for the next hour"}
        </Text>
      </View>
      <Switch
        value={visible}
        onValueChange={toggle}
        trackColor={{ true: colors.accent, false: colors.border }}
        thumbColor="#fff"
        ios_backgroundColor={colors.border}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.md,
  },
  cardOn: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  title: { fontSize: 18, fontWeight: "700", color: colors.text },
  titleOn: { color: colors.accent },
  subtitle: { fontSize: 13, color: colors.muted, marginTop: 2 },
});
