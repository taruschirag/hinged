import * as Haptics from "expo-haptics";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type ScrollViewInstance,
} from "react-native";
import Animated, { FadeIn, FadeInDown, FadeInUp, useAnimatedStyle, withSpring } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WingmanOrb, type WingmanOrbProps } from "@/components/anim/WingmanOrb";
import { errorMessage } from "@/components/nearby/errorMessage";
import { PressableScale } from "@/components/ui/PressableScale";
import { Bubble } from "@/components/wingman/Bubble";
import { softSpring } from "@/lib/motion";
import { colors, radius, space } from "@/lib/theme";
import { interviewQuestions as QUESTIONS, useInterview, useSaveInterview } from "@/lib/wingman";

type Line = { id: string; from: "wingman" | "me"; text: string };

const INTRO = "Hey, I'm your wingman. Five quick questions and I'll know how to talk you up when you're near someone interesting.";
const REACTIONS = ["Love that.", "Noted ✍️", "Ooh, good one.", "Okay, I'm getting a picture.", "Perfect."];
const REVIEW = "That's everything. Before I go out there: what am I allowed to share?";
const QUICK_REPLIES: string[][] = [
  ["Brunch, then a long walk", "Couch, blanket, a good show", "Somewhere outdoors"],
  ["A new album on repeat", "Trying every ramen spot", "A show I can't stop talking about", "Climbing"],
  ["Dry, deadpan humor", "Silly and a bit weird", "Clever wordplay"],
  ["Real conversation", "Something fun, no pressure", "A spark I can't explain"],
  ["Nothing, I'm an open book", "My job", "Where I live"],
];

export default function InterviewScreen() {
  const { first } = useLocalSearchParams<{ first?: string }>();
  const insets = useSafeAreaInsets();
  const existing = useInterview();
  const save = useSaveInterview();
  const [lines, setLines] = useState<Line[]>([]);
  const [step, setStep] = useState(0);
  const [typing, setTyping] = useState(true);
  const [answers, setAnswers] = useState<string[]>([]);
  const [shared, setShared] = useState<boolean[]>(() => QUESTIONS.map(() => true));
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orb, setOrb] = useState<WingmanOrbProps["state"]>("thinking");
  const scroll = useRef<ScrollViewInstance>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const mounted = useRef(true);

  const reviewing = step >= QUESTIONS.length && !typing;
  const previous = existing?.answers.find((a) => a.question === QUESTIONS[step])?.answer;
  const chips = [...(previous ? [previous] : []), ...(QUICK_REPLIES[step] ?? [])];

  const say = (text: string, then?: () => void, delay = 900) => {
    setTyping(true);
    setOrb("thinking");
    timers.current.push(
      setTimeout(() => {
        setTyping(false);
        setOrb("idle");
        setLines((l) => [...l, { id: `w${l.length}`, from: "wingman", text }]);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        then?.();
      }, delay),
    );
  };

  const start = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setLines([]);
    setAnswers([]);
    setStep(0);
    setShared(QUESTIONS.map(() => true));
    setError(null);
    say(INTRO, () => say(QUESTIONS[0], undefined, 1100), 700);
  };

  useEffect(() => {
    start();
    mounted.current = true;
    return () => {
      mounted.current = false;
      timers.current.forEach(clearTimeout);
    };
  }, []);

  const answer = (raw: string) => {
    const text = raw.trim();
    if (!text || typing || step >= QUESTIONS.length) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setDraft("");
    setLines((l) => [...l, { id: `m${l.length}`, from: "me", text }]);
    setAnswers((a) => [...a, text]);
    const next = step + 1;
    setStep(next);
    if (next < QUESTIONS.length) say(REACTIONS[step % REACTIONS.length], () => say(QUESTIONS[next], undefined, 1000), 650);
    else say(REVIEW, () => setOrb("happy"), 1000);
  };

  const finish = () => {
    if (first) router.replace("/");
    else if (router.canGoBack()) router.back();
    else router.replace("/");
  };

  const submit = async () => {
    const payload = QUESTIONS.map((question, i) => ({ question, answer: answers[i] ?? "" })).filter(
      (a, i) => shared[i] && a.answer,
    );
    if (payload.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      await save(payload);
      setOrb("happy");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      if (mounted.current) timers.current.push(setTimeout(finish, 500));
    } catch (e) {
      setOrb("unsure");
      setError(errorMessage(e));
      setSaving(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    }
  };

  const progress = Math.min(answers.length, QUESTIONS.length) / QUESTIONS.length;
  const bar = useAnimatedStyle(() => ({ width: withSpring(progress * 160, softSpring) }), [progress]);
  const sharedCount = shared.filter((s, i) => s && answers[i]).length;

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 44 : 0}
    >
      <Stack.Screen
        options={{
          headerBackVisible: !first,
          gestureEnabled: !first,
          headerRight: first
            ? () => (
                <Pressable onPress={finish} hitSlop={12}>
                  <Text style={styles.skip}>Skip</Text>
                </Pressable>
              )
            : undefined,
        }}
      />
      <View style={styles.hero}>
        <WingmanOrb state={orb} size={72} />
        <View style={styles.track}>
          <Animated.View style={[styles.fill, bar]} />
        </View>
        <Text style={styles.progress}>
          {reviewing ? "Review" : `Question ${Math.min(step + 1, QUESTIONS.length)} of ${QUESTIONS.length}`}
        </Text>
      </View>

      <ScrollView
        ref={scroll}
        style={{ flex: 1 }}
        contentContainerStyle={styles.thread}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
      >
        {lines.map((line) =>
          line.from === "wingman" ? (
            <Bubble key={line.id} side="left" tone="wingman" text={line.text} avatar={<WingmanOrb state="idle" size={24} />} />
          ) : (
            <Bubble key={line.id} side="right" tone="accent" text={line.text} />
          ),
        )}
        {typing && <Bubble side="left" tone="wingman" typing avatar={<WingmanOrb state="thinking" size={24} />} />}

        {reviewing && (
          <Animated.View entering={FadeInUp.springify().damping(16)} style={styles.review}>
            <Text style={styles.reviewTitle}>What can your wingman share?</Text>
            <Text style={styles.reviewBody}>
              Anything you switch off stays out of your wingman’s head completely. It never shares your name, location,
              workplace or contacts before you match.
            </Text>
            {QUESTIONS.map((q, i) => (
              <Animated.View key={q} entering={FadeInDown.delay(80 + i * 70).springify().damping(16)} style={styles.reviewRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.reviewQ}>{q}</Text>
                  <Text style={[styles.reviewA, !shared[i] && styles.reviewOff]}>{answers[i]}</Text>
                </View>
                <Switch
                  value={shared[i]}
                  onValueChange={(v) => {
                    Haptics.selectionAsync().catch(() => {});
                    setShared((s) => s.map((x, j) => (j === i ? v : x)));
                  }}
                  trackColor={{ true: colors.wingman, false: colors.border }}
                />
              </Animated.View>
            ))}
            <Pressable onPress={start} hitSlop={8} style={{ alignSelf: "center", marginTop: space.sm }}>
              <Text style={styles.restart}>Start over</Text>
            </Pressable>
          </Animated.View>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, space.sm) }]}>
        {reviewing ? (
          <Animated.View entering={FadeIn}>
            {error && <Text style={styles.error}>{error}</Text>}
            <PressableScale style={styles.cta} onPress={submit} disabled={saving || sharedCount === 0}>
              {saving ? (
                <ActivityIndicator color={colors.surface} />
              ) : (
                <Text style={styles.ctaText}>{sharedCount === 0 ? "Share at least one answer" : "Send my wingman out"}</Text>
              )}
            </PressableScale>
          </Animated.View>
        ) : (
          <>
            {!typing && step < QUESTIONS.length && (
              <Animated.View entering={FadeInDown.springify().damping(16)} key={step}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={styles.chips}
                >
                  {chips.map((c) => (
                    <PressableScale key={c} style={styles.chip} onPress={() => answer(c)}>
                      <Text style={styles.chipText}>{c}</Text>
                    </PressableScale>
                  ))}
                </ScrollView>
              </Animated.View>
            )}
            <View style={styles.composer}>
              <TextInput
                style={styles.input}
                value={draft}
                onChangeText={setDraft}
                placeholder={typing ? "Your wingman is typing…" : "Type your answer"}
                placeholderTextColor={colors.muted}
                editable={!typing}
                multiline
                maxLength={280}
              />
              <PressableScale
                style={styles.send}
                disabled={typing || !draft.trim()}
                onPress={() => answer(draft)}
                accessibilityLabel="Send"
              >
                <Text style={styles.sendText}>↑</Text>
              </PressableScale>
            </View>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  skip: { color: colors.muted, fontWeight: "600", fontSize: 16 },
  hero: { alignItems: "center", paddingTop: space.md, paddingBottom: space.sm, gap: space.sm },
  track: { width: 160, height: 6, borderRadius: 3, backgroundColor: colors.wingmanSoft, overflow: "hidden" },
  fill: { height: 6, borderRadius: 3, backgroundColor: colors.wingman },
  progress: { fontSize: 12, fontWeight: "700", color: colors.muted, letterSpacing: 0.4 },
  thread: { padding: space.md, paddingBottom: space.lg },
  review: {
    marginTop: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.wingmanSoft,
    padding: space.md,
    gap: space.sm,
  },
  reviewTitle: { fontSize: 18, fontWeight: "800", color: colors.text },
  reviewBody: { fontSize: 13, color: colors.muted, lineHeight: 18 },
  reviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  reviewQ: { fontSize: 12, color: colors.muted, fontWeight: "600" },
  reviewA: { fontSize: 15, color: colors.text, marginTop: 2 },
  reviewOff: { color: colors.muted, textDecorationLine: "line-through" },
  restart: { color: colors.wingman, fontWeight: "700" },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    paddingTop: space.sm,
    paddingHorizontal: space.md,
    gap: space.sm,
  },
  chips: { gap: space.sm, paddingBottom: space.xs },
  chip: { backgroundColor: colors.wingmanSoft, borderRadius: radius.pill, paddingVertical: space.sm, paddingHorizontal: space.md },
  chipText: { color: colors.wingman, fontWeight: "700", fontSize: 14 },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: space.sm },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    paddingHorizontal: space.md,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 16,
    color: colors.text,
  },
  send: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.wingman, alignItems: "center", justifyContent: "center" },
  sendText: { color: colors.surface, fontSize: 20, fontWeight: "800" },
  cta: { backgroundColor: colors.wingman, borderRadius: radius.pill, paddingVertical: 16, alignItems: "center" },
  ctaText: { color: colors.surface, fontSize: 16, fontWeight: "700" },
  error: { color: colors.danger, textAlign: "center", marginBottom: space.sm },
});
