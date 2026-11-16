import { useMutation, useQuery } from "convex/react";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { errorMessage } from "@/components/nearby/errorMessage";
import { WingmanReport } from "@/components/wingman/WingmanReport";
import { useToken } from "@/lib/session";
import { colors, radius, space } from "@/lib/theme";

export default function PersonScreen() {
  const token = useToken();
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = id as Id<"users">;
  const person = useQuery(api.nearby.person, { token, userId });
  const me = useQuery(api.users.me, { token });
  const like = useMutation(api.likes.like);
  const block = useMutation(api.users.block);
  const [liking, setLiking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (person === undefined) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  if (person === null) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>This person isn't available anymore.</Text>
      </View>
    );
  }

  async function onLike() {
    setError(null);
    setLiking(true);
    try {
      const { matchId } = await like({ token, userId });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      if (matchId) router.back();
    } catch (e) {
      setError(errorMessage(e));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    } finally {
      setLiking(false);
    }
  }

  function onBlock() {
    Alert.alert(`Block ${person!.name}?`, "You won't see each other on Hinged anymore.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Block",
        style: "destructive",
        onPress: async () => {
          try {
            await block({ token, userId });
            router.back();
          } catch (e) {
            setError(errorMessage(e));
          }
        },
      },
    ]);
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.photo}>
        {person.photo ? (
          <Image source={{ uri: person.photo }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
        ) : (
          <Text style={styles.initial}>{person.name.slice(0, 1)}</Text>
        )}
      </View>
      <Text style={styles.name}>
        {person.name}, <Text style={styles.age}>{person.age}</Text>
      </Text>
      {!!person.bio && <Text style={styles.bio}>{person.bio}</Text>}

      <WingmanReport
        userId={userId}
        photo={person.photo}
        myPhoto={me?.photo ?? null}
        onUseInChat={
          person.matchId
            ? (opener) => {
                router.back();
                router.push({ pathname: "/chat/[matchId]", params: { matchId: person.matchId!, opener } });
              }
            : undefined
        }
      />

      {person.matchId ? (
        <Pressable
          style={styles.likeButton}
          onPress={() => {
            router.back();
            router.push({ pathname: "/chat/[matchId]", params: { matchId: person.matchId! } });
          }}
        >
          <Text style={styles.likeText}>You matched · Open chat</Text>
        </Pressable>
      ) : person.liked ? (
        <View style={styles.likedBox}>
          <Text style={styles.likedTitle}>♥ Liked</Text>
          <Text style={styles.likedBody}>They'll only find out if they like you back.</Text>
        </View>
      ) : (
        <Pressable
          onPress={onLike}
          disabled={liking}
          style={({ pressed }) => [styles.likeButton, (pressed || liking) && { opacity: 0.8 }]}
        >
          {liking ? <ActivityIndicator color="#fff" /> : <Text style={styles.likeText}>♥ Like</Text>}
        </Pressable>
      )}
      {error && <Text style={styles.error}>{error}</Text>}
      {!person.matchId && !person.liked && (
        <Text style={styles.hint}>They won't know unless they like you too.</Text>
      )}

      <Pressable onPress={onBlock} hitSlop={8} style={styles.block}>
        <Text style={styles.blockText}>Block {person.name}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: space.md, paddingBottom: space.xl * 2 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background, padding: space.lg },
  muted: { color: colors.muted, fontSize: 15 },
  photo: {
    aspectRatio: 1,
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  initial: { fontSize: 80, fontWeight: "700", color: colors.accent },
  name: { fontSize: 28, fontWeight: "800", color: colors.text, marginTop: space.md },
  age: { fontWeight: "400", color: colors.muted },
  bio: { fontSize: 16, color: colors.text, lineHeight: 23, marginTop: space.sm },
  likeButton: {
    marginTop: space.lg,
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingVertical: 16,
    alignItems: "center",
  },
  likeText: { color: "#fff", fontSize: 17, fontWeight: "700" },
  likedBox: {
    marginTop: space.lg,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    padding: space.md,
    alignItems: "center",
  },
  likedTitle: { color: colors.accent, fontSize: 17, fontWeight: "700" },
  likedBody: { color: colors.text, marginTop: space.xs, textAlign: "center" },
  hint: { color: colors.muted, fontSize: 13, textAlign: "center", marginTop: space.sm },
  error: { color: colors.danger, textAlign: "center", marginTop: space.md },
  block: { alignSelf: "center", marginTop: space.xl },
  blockText: { color: colors.danger, fontWeight: "600" },
});
