import { useMutation, useQuery } from "convex/react";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { api } from "@convex/_generated/api";
import { Avatar } from "@/components/matches/Avatar";
import { useToken } from "@/lib/session";
import { colors, radius, space } from "@/lib/theme";

export function MatchModal() {
  const token = useToken();
  const match = useQuery(api.matches.unseen, { token });
  const me = useQuery(api.users.me, { token });
  const markSeen = useMutation(api.matches.markSeen);
  const [dismissedId, setDismissedId] = useState<string | null>(null);

  const visible = !!match && match._id !== dismissedId;

  useEffect(() => {
    if (visible) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, [visible, match?._id]);

  if (!match) return null;

  const close = async (openChat: boolean) => {
    setDismissedId(match._id);
    await markSeen({ token, matchId: match._id }).catch(() => {});
    if (openChat) router.push({ pathname: "/chat/[matchId]", params: { matchId: match._id } });
  };

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent onRequestClose={() => close(false)}>
      <View style={styles.backdrop}>
        <Text style={styles.kicker}>You both liked each other</Text>
        <Text style={styles.title}>It's mutual!</Text>
        <View style={styles.photos}>
          <View style={{ transform: [{ rotate: "-6deg" }], marginRight: -24 }}>
            <Avatar uri={me?.photo} name={me?.name ?? "You"} size={140} ring />
          </View>
          <View style={{ transform: [{ rotate: "6deg" }] }}>
            <Avatar uri={match.other.photo} name={match.other.name} size={140} ring />
          </View>
        </View>
        <Text style={styles.subtitle}>
          You and {match.other.name} are both nearby. Say hi before the moment passes.
        </Text>
        <Pressable style={({ pressed }) => [styles.primary, pressed && { opacity: 0.85 }]} onPress={() => close(true)}>
          <Text style={styles.primaryText}>Say hi</Text>
        </Pressable>
        <Pressable style={styles.secondary} onPress={() => close(false)}>
          <Text style={styles.secondaryText}>Later</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    padding: space.xl,
  },
  kicker: { color: colors.accentSoft, fontSize: 15, fontWeight: "600", letterSpacing: 0.5 },
  title: { color: colors.surface, fontSize: 44, fontWeight: "800", marginTop: space.xs },
  photos: { flexDirection: "row", marginVertical: space.xl },
  subtitle: { color: colors.surface, fontSize: 16, textAlign: "center", lineHeight: 22, marginBottom: space.xl },
  primary: {
    alignSelf: "stretch",
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingVertical: space.md,
    alignItems: "center",
  },
  primaryText: { color: colors.accent, fontSize: 17, fontWeight: "700" },
  secondary: { paddingVertical: space.md, marginTop: space.sm },
  secondaryText: { color: colors.surface, fontSize: 16, fontWeight: "600" },
});
