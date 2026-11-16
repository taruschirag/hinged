import { router } from "expo-router";
import { Alert, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown, LinearTransition } from "react-native-reanimated";
import type { Id } from "@convex/_generated/dataModel";
import { AgentsTalking } from "@/components/anim/AgentsTalking";
import { WingmanOrb } from "@/components/anim/WingmanOrb";
import { errorMessage } from "@/components/nearby/errorMessage";
import { PressableScale } from "@/components/ui/PressableScale";
import { WingmanVerdict } from "@/components/wingman/WingmanVerdict";
import { colors, radius, space } from "@/lib/theme";
import { useNow } from "@/lib/useNow";
import { isTalking, useInterview, useNearbyVibes, useRerun } from "@/lib/wingman";

type Props = {
  userId: Id<"users">;
  photo: string | null;
  myPhoto: string | null;
  onUseInChat?: (opener: string) => void;
};

export function WingmanReport({ userId, photo, myPhoto, onUseInChat }: Props) {
  const now = useNow();
  const interview = useInterview();
  const vibes = useNearbyVibes(now);
  const rerun = useRerun();
  const vibe = vibes?.[userId];

  let body: React.ReactNode;
  if (interview?.status === "none") {
    body = (
      <View style={styles.center}>
        <WingmanOrb state="idle" size={56} />
        <Text style={styles.body}>Train your wingman and it’ll quietly chat with theirs to tell you if there’s chemistry.</Text>
        <PressableScale style={styles.primary} onPress={() => router.push("/wingman/interview")}>
          <Text style={styles.primaryText}>Train your wingman</Text>
        </PressableScale>
      </View>
    );
  } else if (!vibes || !vibe) {
    body = (
      <View style={styles.center}>
        <WingmanOrb state="thinking" size={56} />
        <Text style={styles.body}>Your wingman will say hi to theirs while you’re both nearby.</Text>
      </View>
    );
  } else if (isTalking(vibe)) {
    body = (
      <View style={styles.center}>
        <AgentsTalking active leftPhoto={photo} rightPhoto={myPhoto} height={88} />
        <Text style={styles.talking}>Your wingmen are talking…</Text>
        <WatchButton chatId={vibe.chatId} userId={userId} live />
      </View>
    );
  } else if (vibe.status === "failed") {
    body = (
      <View style={styles.center}>
        <WingmanOrb state="unsure" size={56} />
        <Text style={styles.body}>Your wingman lost the thread. Give it another go?</Text>
        <PressableScale style={styles.secondary} onPress={() => rerun(userId).catch((e) => Alert.alert("Couldn’t retry", errorMessage(e)))}>
          <Text style={styles.secondaryText}>Try again</Text>
        </PressableScale>
      </View>
    );
  } else {
    body = (
      <Animated.View entering={FadeIn.duration(250)} style={{ gap: space.md }}>
        <WingmanVerdict score={vibe.score} why={vibe.why} opener={vibe.opener} userId={userId} onUseInChat={onUseInChat} />
        <WatchButton chatId={vibe.chatId} userId={userId} />
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={FadeInDown.delay(120).springify().damping(16)} layout={LinearTransition.springify()} style={styles.card}>
      <View style={styles.titleRow}>
        <WingmanOrb state={vibe?.status === "done" ? "happy" : "idle"} size={22} />
        <Text style={styles.title}>Wingman report</Text>
        <Text style={styles.private}>Only you see this</Text>
      </View>
      {body}
    </Animated.View>
  );
}

function WatchButton({ chatId, userId, live }: { chatId: string; userId: string; live?: boolean }) {
  return (
    <PressableScale
      style={styles.secondary}
      onPress={() => router.push({ pathname: "/wingman/[chatId]", params: { chatId, with: userId } })}
    >
      <Text style={styles.secondaryText}>{live ? "Watch live" : "Watch the conversation"}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: space.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.wingmanSoft,
    padding: space.md,
    gap: space.md,
    shadowColor: colors.wingman,
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  title: { fontSize: 17, fontWeight: "800", color: colors.text, flex: 1 },
  private: { fontSize: 12, color: colors.muted, fontWeight: "600" },
  center: { alignItems: "center", gap: space.sm },
  body: { fontSize: 15, color: colors.muted, textAlign: "center", lineHeight: 21 },
  talking: { fontSize: 15, color: colors.wingman, fontWeight: "700" },
  primary: {
    backgroundColor: colors.wingman,
    borderRadius: radius.pill,
    paddingVertical: 12,
    paddingHorizontal: space.lg,
    marginTop: space.xs,
  },
  primaryText: { color: colors.surface, fontWeight: "700", fontSize: 15 },
  secondary: {
    alignSelf: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.wingman,
    paddingVertical: 10,
    paddingHorizontal: space.lg,
  },
  secondaryText: { color: colors.wingman, fontWeight: "700", fontSize: 15 },
});
