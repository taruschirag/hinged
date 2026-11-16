import { useMutation, useQuery } from "convex/react";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown, SlideInLeft, SlideInRight, ZoomIn } from "react-native-reanimated";
import { api } from "@convex/_generated/api";
import { MatchBurst } from "@/components/anim/MatchBurst";
import { Avatar } from "@/components/matches/Avatar";
import { PressableScale } from "@/components/ui/PressableScale";
import { savedOpener } from "@/lib/openers";
import { useToken } from "@/lib/session";
import { colors, radius, space } from "@/lib/theme";
import { useNow } from "@/lib/useNow";
import { useNearbyVibes } from "@/lib/wingman";

export function MatchModal() {
  const token = useToken();
  const now = useNow();
  const match = useQuery(api.matches.unseen, { token });
  const me = useQuery(api.users.me, { token });
  const vibes = useNearbyVibes(now);
  const markSeen = useMutation(api.matches.markSeen);
  const [dismissedId, setDismissedId] = useState<string | null>(null);

  const visible = !!match && match._id !== dismissedId;

  useEffect(() => {
    if (visible) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, [visible, match?._id]);

  if (!match || !visible) return null;

  const opener = savedOpener(match.other._id) ?? vibes?.[match.other._id]?.opener ?? null;

  const close = async (openChat: boolean) => {
    setDismissedId(match._id);
    await markSeen({ token, matchId: match._id }).catch(() => {});
    if (openChat) {
      router.push({ pathname: "/chat/[matchId]", params: opener ? { matchId: match._id, opener } : { matchId: match._id } });
    }
  };

  return (
    <Animated.View entering={FadeIn.duration(200)} style={styles.backdrop}>
      <MatchBurst play={visible} />
      <Animated.Text entering={FadeInDown.delay(100).springify().damping(14)} style={styles.kicker}>
        You both liked each other
      </Animated.Text>
      <Animated.Text entering={ZoomIn.delay(180).springify().damping(10)} style={styles.title}>
        It’s mutual!
      </Animated.Text>
      <View style={styles.photos}>
        <Animated.View entering={SlideInLeft.delay(220).springify().damping(13)} style={{ transform: [{ rotate: "-6deg" }], marginRight: -24 }}>
          <Avatar uri={me?.photo} name={me?.name ?? "You"} size={140} ring />
        </Animated.View>
        <Animated.View entering={SlideInRight.delay(220).springify().damping(13)} style={{ transform: [{ rotate: "6deg" }] }}>
          <Avatar uri={match.other.photo} name={match.other.name} size={140} ring />
        </Animated.View>
      </View>
      <Animated.Text entering={FadeInDown.delay(360).springify()} style={styles.subtitle}>
        You and {match.other.name} are both nearby. Say hi before the moment passes.
      </Animated.Text>
      {opener && (
        <Animated.View entering={FadeInDown.delay(440).springify()} style={styles.opener}>
          <Text style={styles.openerKicker}>YOUR WINGMAN SUGGESTS</Text>
          <Text style={styles.openerText}>“{opener}”</Text>
        </Animated.View>
      )}
      <Animated.View entering={FadeInDown.delay(500).springify()} style={{ alignSelf: "stretch" }}>
        <PressableScale style={styles.primary} onPress={() => close(true)}>
          <Text style={styles.primaryText}>{opener ? "Say it" : "Say hi"}</Text>
        </PressableScale>
        <PressableScale style={styles.secondary} onPress={() => close(false)} haptic={false}>
          <Text style={styles.secondaryText}>Later</Text>
        </PressableScale>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 200,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    padding: space.xl,
  },
  kicker: { color: colors.accentSoft, fontSize: 15, fontWeight: "600", letterSpacing: 0.5 },
  title: { color: colors.surface, fontSize: 44, fontWeight: "800", marginTop: space.xs },
  photos: { flexDirection: "row", marginVertical: space.xl },
  subtitle: { color: colors.surface, fontSize: 16, textAlign: "center", lineHeight: 22, marginBottom: space.lg },
  opener: {
    alignSelf: "stretch",
    backgroundColor: "rgba(255,255,255,0.16)",
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.lg,
  },
  openerKicker: { color: colors.accentSoft, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  openerText: { color: colors.surface, fontSize: 16, fontWeight: "600", lineHeight: 22, marginTop: space.xs },
  primary: {
    alignSelf: "stretch",
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingVertical: space.md,
    alignItems: "center",
  },
  primaryText: { color: colors.accent, fontSize: 17, fontWeight: "700" },
  secondary: { paddingVertical: space.md, marginTop: space.sm, alignItems: "center" },
  secondaryText: { color: colors.surface, fontSize: 16, fontWeight: "600" },
});
