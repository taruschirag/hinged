import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { api } from "@convex/_generated/api";
import { useToken } from "@/lib/session";
import { colors, radius, space } from "@/lib/theme";

export function DemoSection() {
  const token = useToken();
  const start = useMutation(api.demo.start);
  const stop = useMutation(api.demo.stop);
  const [busy, setBusy] = useState<"start" | "stop" | null>(null);
  const [status, setStatus] = useState<{ text: string; error: boolean } | null>(null);

  const run = async (kind: "start" | "stop") => {
    setBusy(kind);
    setStatus(null);
    try {
      await (kind === "start" ? start : stop)({ token });
      setStatus({
        text: kind === "start" ? "Five demo people are now nearby. Check the Nearby tab." : "Demo people removed.",
        error: false,
      });
    } catch (e) {
      setStatus({ text: e instanceof ConvexError ? String(e.data) : "Something went wrong. Try again.", error: true });
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Demo mode</Text>
      <Text style={styles.body}>
        Try Hinged on one phone. Turn on visibility in the Nearby tab first so demo people can appear around
        you. One of them likes you a few seconds after you start, and three of them like you back.
      </Text>
      <Pressable style={styles.primary} onPress={() => run("start")} disabled={busy !== null}>
        {busy === "start" ? (
          <ActivityIndicator color={colors.surface} />
        ) : (
          <Text style={styles.primaryText}>Add demo people nearby</Text>
        )}
      </Pressable>
      <Pressable style={styles.secondary} onPress={() => run("stop")} disabled={busy !== null}>
        {busy === "stop" ? (
          <ActivityIndicator color={colors.accent} />
        ) : (
          <Text style={styles.secondaryText}>Remove demo people</Text>
        )}
      </Pressable>
      {status && (
        <Text style={[styles.status, { color: status.error ? colors.danger : colors.success }]}>{status.text}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
  },
  title: { fontSize: 17, fontWeight: "700", color: colors.text },
  body: { fontSize: 14, color: colors.muted, lineHeight: 20, marginTop: space.xs },
  primary: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingVertical: space.sm + 6,
    alignItems: "center",
    marginTop: space.md,
  },
  primaryText: { color: colors.surface, fontWeight: "700", fontSize: 16 },
  secondary: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.pill,
    paddingVertical: space.sm + 6,
    alignItems: "center",
    marginTop: space.sm,
  },
  secondaryText: { color: colors.accent, fontWeight: "700", fontSize: 16 },
  status: { marginTop: space.sm, fontSize: 14 },
});
