import { useQuery } from "convex/react";
import { router } from "expo-router";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { api } from "@convex/_generated/api";
import { Avatar } from "@/components/matches/Avatar";
import { relativeTime } from "@/components/matches/relativeTime";
import { useToken } from "@/lib/session";
import { colors, radius, space } from "@/lib/theme";
import { useNow } from "@/lib/useNow";

export default function MatchesScreen() {
  const token = useToken();
  const matches = useQuery(api.matches.list, { token });
  const now = useNow(30000);

  if (matches === undefined) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (matches.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyEmoji}>💞</Text>
        <Text style={styles.emptyTitle}>No matches yet</Text>
        <Text style={styles.emptyBody}>
          Like someone you can see nearby. They won't know it was you. If they like you back, you both get
          a match and can chat here.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={matches}
      keyExtractor={(m) => m._id}
      contentContainerStyle={{ padding: space.md, gap: space.sm }}
      renderItem={({ item }) => {
        const preview = item.lastMessage
          ? `${item.lastMessage.mine ? "You: " : ""}${item.lastMessage.body}`
          : "New match. Say hi!";
        return (
          <Pressable
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }]}
            onPress={() => router.push({ pathname: "/chat/[matchId]", params: { matchId: item._id } })}
          >
            <Avatar uri={item.other.photo} name={item.other.name} size={56} />
            <View style={{ flex: 1, marginLeft: space.md }}>
              <View style={styles.rowTop}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.other.name}
                </Text>
                <Text style={styles.time}>{relativeTime(item.lastMessageAt, now)}</Text>
              </View>
              <Text
                style={[styles.preview, !item.lastMessage && { color: colors.accent, fontWeight: "600" }]}
                numberOfLines={1}
              >
                {preview}
              </Text>
            </View>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.xl },
  emptyEmoji: { fontSize: 44, marginBottom: space.md },
  emptyTitle: { fontSize: 20, fontWeight: "700", color: colors.text, marginBottom: space.sm },
  emptyBody: { fontSize: 15, color: colors.muted, textAlign: "center", lineHeight: 22 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.md,
  },
  rowTop: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  name: { flex: 1, fontSize: 17, fontWeight: "700", color: colors.text },
  time: { fontSize: 13, color: colors.muted, marginLeft: space.sm },
  preview: { fontSize: 15, color: colors.muted, marginTop: 2 },
});
