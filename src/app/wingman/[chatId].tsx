import * as Haptics from "expo-haptics";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useQuery } from "convex/react";
import { useEffect, useRef } from "react";
import { Alert, ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from "react-native";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { AgentsTalking } from "@/components/anim/AgentsTalking";
import { WingmanOrb } from "@/components/anim/WingmanOrb";
import { Avatar } from "@/components/matches/Avatar";
import { errorMessage } from "@/components/nearby/errorMessage";
import { PressableScale } from "@/components/ui/PressableScale";
import { Bubble } from "@/components/wingman/Bubble";
import { WingmanVerdict } from "@/components/wingman/WingmanVerdict";
import { useToken } from "@/lib/session";
import { colors, radius, space } from "@/lib/theme";
import { useRerun, useWingmanChat } from "@/lib/wingman";

export default function WingmanChatScreen() {
  const { chatId, with: withId } = useLocalSearchParams<{ chatId: string; with?: string }>();
  const token = useToken();
  const chat = useWingmanChat(chatId);
  const me = useQuery(api.users.me, { token });
  const other = useQuery(api.nearby.person, withId ? { token, userId: withId as Id<"users"> } : "skip");
  const rerun = useRerun();
  const scroll = useRef<ScrollViewInstance>(null);
  const seenTurns = useRef<number | null>(null);
  const lastStatus = useRef<string | null>(null);

  const turns = chat?.turns ?? [];
  const talking = chat?.status === "talking" || chat?.status === "pending";

  useEffect(() => {
    if (!chat) return;
    if (seenTurns.current !== null && turns.length > seenTurns.current) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    seenTurns.current = turns.length;
    if (lastStatus.current && lastStatus.current !== "done" && chat.status === "done") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    lastStatus.current = chat.status;
  }, [turns.length, chat?.status]);

  const next = turns.length === 0 || turns[turns.length - 1].speaker === "theirs" ? "mine" : "theirs";
  const theirAvatar = <Avatar uri={other?.photo} name="?" size={24} />;
  const myAvatar = <WingmanOrb state="idle" size={24} />;

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: "Wingmen" }} />
      <View style={styles.header}>
        <AgentsTalking active={talking} leftPhoto={other?.photo ?? null} rightPhoto={me?.photo ?? null} height={110} />
        <Text style={styles.status}>
          {chat === undefined
            ? "Connecting…"
            : chat === null
              ? "This conversation isn't available"
              : talking
                ? "Your wingmen are talking"
                : chat.status === "done"
                  ? "They've made up their minds"
                  : "The conversation stalled"}
        </Text>
        <View style={styles.legend}>
          <Text style={styles.legendText}>← Their wingman</Text>
          <Text style={styles.legendText}>Your wingman →</Text>
        </View>
      </View>

      <ScrollView
        ref={scroll}
        style={{ flex: 1 }}
        contentContainerStyle={styles.thread}
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
      >
        {turns.map((t, i) => {
          const mine = t.speaker === "mine";
          const label = i === 0 || turns[i - 1].speaker !== t.speaker ? (mine ? "YOUR WINGMAN" : "THEIR WINGMAN") : undefined;
          return (
            <Bubble
              key={i}
              side={mine ? "right" : "left"}
              tone={mine ? "wingman" : "plain"}
              text={t.text}
              label={label}
              avatar={mine ? myAvatar : theirAvatar}
            />
          );
        })}
        {talking && (
          <Bubble
            side={next === "mine" ? "right" : "left"}
            tone={next === "mine" ? "wingman" : "plain"}
            typing
            avatar={next === "mine" ? myAvatar : theirAvatar}
          />
        )}

        {chat?.status === "done" && (
          <Animated.View entering={ZoomIn.springify().damping(14).delay(150)} style={styles.verdict}>
            <Text style={styles.verdictTitle}>The verdict</Text>
            <WingmanVerdict score={chat.score} why={chat.why} opener={chat.opener} userId={withId} />
          </Animated.View>
        )}

        {chat?.status === "failed" && (
          <Animated.View entering={FadeIn} style={styles.failed}>
            <WingmanOrb state="unsure" size={48} />
            <Text style={styles.failedText}>Your wingman lost the thread.</Text>
            {withId && (
              <PressableScale style={styles.retry} onPress={() =>
                  rerun(withId as Id<"users">)
                    .then((next) => router.setParams({ chatId: next }))
                    .catch((e) => Alert.alert("Couldn’t retry", errorMessage(e)))
                }>
                <Text style={styles.retryText}>Try again</Text>
              </PressableScale>
            )}
          </Animated.View>
        )}

        <Text style={styles.footnote}>
          Wingmen only use what each person chose to share. Neither one can like anyone for you.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { alignItems: "center", paddingTop: space.md, paddingHorizontal: space.md, gap: space.xs },
  status: { fontSize: 16, fontWeight: "800", color: colors.text, marginTop: space.xs },
  legend: { flexDirection: "row", justifyContent: "space-between", alignSelf: "stretch", marginTop: space.xs },
  legendText: { fontSize: 11, fontWeight: "700", color: colors.muted, letterSpacing: 0.3 },
  thread: { padding: space.md, paddingBottom: space.xl * 2 },
  verdict: {
    marginTop: space.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.wingmanSoft,
    padding: space.md,
    gap: space.md,
    shadowColor: colors.wingman,
    shadowOpacity: 0.16,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
  },
  verdictTitle: { fontSize: 20, fontWeight: "800", color: colors.text },
  failed: { alignItems: "center", gap: space.sm, marginTop: space.lg },
  failedText: { color: colors.muted, fontSize: 15 },
  retry: { borderRadius: radius.pill, borderWidth: 1, borderColor: colors.wingman, paddingVertical: 10, paddingHorizontal: space.lg },
  retryText: { color: colors.wingman, fontWeight: "700" },
  footnote: { fontSize: 12, color: colors.muted, textAlign: "center", marginTop: space.lg, lineHeight: 17 },
});
