import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Avatar } from "@/components/matches/Avatar";
import { useToken } from "@/lib/session";
import { colors, radius, space } from "@/lib/theme";

const ICEBREAKERS = ["I'm the one by the window", "Coffee at the next stop?", "Hi! Nice to actually say hello 👋"];

export default function ChatScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: Id<"matches"> }>();
  const token = useToken();
  const insets = useSafeAreaInsets();
  const match = useQuery(api.matches.get, { token, matchId });
  const messages = useQuery(api.chat.list, { token, matchId });
  const send = useMutation(api.chat.send);
  const block = useMutation(api.users.block);
  const [draft, setDraft] = useState("");
  const [blocking, setBlocking] = useState(false);

  const submit = async (body: string) => {
    const text = body.trim();
    if (!text) return;
    setDraft("");
    try {
      await send({ token, matchId, body: text });
    } catch (e) {
      setDraft(text);
      Alert.alert("Couldn't send", e instanceof ConvexError ? String(e.data) : "Check your connection and try again.");
    }
  };

  const confirmBlock = () => {
    if (!match) return;
    Alert.alert(
      `Block ${match.other.name}?`,
      "They won't see you nearby again and this chat will be deleted. They won't be told.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Block",
          style: "destructive",
          onPress: async () => {
            setBlocking(true);
            try {
              await block({ token, userId: match.other._id });
              router.back();
            } catch {
              setBlocking(false);
              Alert.alert("Couldn't block", "Please try again.");
            }
          },
        },
      ],
    );
  };

  const openMenu = () =>
    Alert.alert(match?.other.name ?? "Options", undefined, [
      { text: "Block", style: "destructive", onPress: confirmBlock },
      { text: "Cancel", style: "cancel" },
    ]);

  if (match === undefined || blocking) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: "" }} />
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (match === null) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: "Chat" }} />
        <Text style={styles.goneTitle}>This match is no longer available</Text>
        <Text style={styles.goneBody}>They may have unmatched or blocked. It happens.</Text>
        <Pressable style={styles.goneButton} onPress={() => (router.canGoBack() ? router.back() : router.replace("/matches"))}>
          <Text style={styles.goneButtonText}>Back to matches</Text>
        </Pressable>
      </View>
    );
  }

  const reversed = messages ? [...messages].reverse() : [];

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior="padding"
      keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 44 : 0}
    >
      <Stack.Screen
        options={{
          headerTitle: () => (
            <View style={styles.header}>
              <Avatar uri={match.other.photo} name={match.other.name} size={32} />
              <Text style={styles.headerName} numberOfLines={1}>
                {match.other.name}
              </Text>
            </View>
          ),
          headerRight: () => (
            <Pressable onPress={openMenu} hitSlop={12} accessibilityLabel="More options">
              <Text style={styles.menu}>•••</Text>
            </Pressable>
          ),
        }}
      />
      {messages === undefined ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : messages.length === 0 ? (
        <View style={styles.empty}>
          <Avatar uri={match.other.photo} name={match.other.name} size={88} />
          <Text style={styles.emptyTitle}>You matched with {match.other.name}</Text>
          <Text style={styles.emptyBody}>They're close by. Break the ice:</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.md }}
            style={{ flexGrow: 0, marginTop: space.md, alignSelf: "stretch" }}
          >
            {ICEBREAKERS.map((text) => (
              <Pressable key={text} style={styles.chip} onPress={() => submit(text)}>
                <Text style={styles.chipText}>{text}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : (
        <FlatList
          inverted
          data={reversed}
          keyExtractor={(m) => m._id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: space.md, gap: space.xs }}
          renderItem={({ item }) => (
            <View style={[styles.bubble, item.mine ? styles.mine : styles.theirs]}>
              <Text style={[styles.bubbleText, item.mine && { color: colors.surface }]}>{item.body}</Text>
            </View>
          )}
        />
      )}
      <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, space.sm) }]}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Message"
          placeholderTextColor={colors.muted}
          multiline
          maxLength={500}
        />
        <Pressable
          style={[styles.send, !draft.trim() && { opacity: 0.4 }]}
          disabled={!draft.trim()}
          onPress={() => submit(draft)}
          accessibilityLabel="Send"
        >
          <Text style={styles.sendText}>↑</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.xl },
  header: { flexDirection: "row", alignItems: "center", gap: space.sm, maxWidth: 220 },
  headerName: { fontSize: 17, fontWeight: "700", color: colors.text },
  menu: { fontSize: 18, color: colors.text, fontWeight: "700", paddingHorizontal: space.xs },
  goneTitle: { fontSize: 18, fontWeight: "700", color: colors.text, textAlign: "center" },
  goneBody: { fontSize: 15, color: colors.muted, marginTop: space.sm, textAlign: "center" },
  goneButton: {
    marginTop: space.lg,
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingVertical: space.sm + 4,
    paddingHorizontal: space.lg,
  },
  goneButtonText: { color: colors.surface, fontWeight: "700", fontSize: 15 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: space.xl },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: colors.text, marginTop: space.md },
  emptyBody: { fontSize: 15, color: colors.muted, marginTop: space.xs },
  chip: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.pill,
    paddingVertical: space.sm + 2,
    paddingHorizontal: space.md,
  },
  chipText: { color: colors.accent, fontWeight: "600", fontSize: 15 },
  bubble: { maxWidth: "78%", paddingVertical: space.sm + 2, paddingHorizontal: space.md, borderRadius: radius.md },
  mine: { alignSelf: "flex-end", backgroundColor: colors.accent, borderBottomRightRadius: 4 },
  theirs: {
    alignSelf: "flex-start",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: 4,
  },
  bubbleText: { fontSize: 16, color: colors.text, lineHeight: 21 },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
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
  send: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  sendText: { color: colors.surface, fontSize: 20, fontWeight: "800" },
});
