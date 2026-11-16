import { useQuery } from "convex/react";
import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { api } from "@convex/_generated/api";
import { Avatar } from "@/components/matches/Avatar";
import { DemoSection } from "@/components/profile/DemoSection";
import { ProfileEditor } from "@/components/profile/ProfileEditor";
import { useToken } from "@/lib/session";
import { colors, radius, space } from "@/lib/theme";

const SAFETY = [
  "Visibility turns itself off after 60 minutes.",
  "No one ever sees your distance or location.",
  "Block anyone from their profile or your chat.",
];

export default function ProfileScreen() {
  const token = useToken();
  const me = useQuery(api.users.me, { token });
  const [editing, setEditing] = useState(false);

  if (!me) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={100}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {editing ? (
          <ProfileEditor profile={me} onDone={() => setEditing(false)} />
        ) : (
          <View style={[styles.card, { alignItems: "center" }]}>
            <Avatar uri={me.photo} name={me.name} size={120} />
            <Text style={styles.name}>
              {me.name}, {me.age}
            </Text>
            {me.bio ? <Text style={styles.bio}>{me.bio}</Text> : <Text style={styles.bioEmpty}>No bio yet</Text>}
            <Pressable style={styles.edit} onPress={() => setEditing(true)}>
              <Text style={styles.editText}>Edit profile</Text>
            </Pressable>
          </View>
        )}

        <DemoSection />

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Safety</Text>
          {SAFETY.map((line) => (
            <View key={line} style={styles.safetyRow}>
              <Text style={styles.dot}>•</Text>
              <Text style={styles.safetyText}>{line}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: space.md, gap: space.md, paddingBottom: space.xl },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
  },
  name: { fontSize: 24, fontWeight: "800", color: colors.text, marginTop: space.md },
  bio: { fontSize: 15, color: colors.text, textAlign: "center", lineHeight: 21, marginTop: space.sm },
  bioEmpty: { fontSize: 15, color: colors.muted, marginTop: space.sm },
  edit: {
    marginTop: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.accent,
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
  },
  editText: { color: colors.accent, fontWeight: "700", fontSize: 15 },
  sectionTitle: { fontSize: 17, fontWeight: "700", color: colors.text, marginBottom: space.sm },
  safetyRow: { flexDirection: "row", marginTop: space.xs },
  dot: { color: colors.accent, fontSize: 15, marginRight: space.sm },
  safetyText: { flex: 1, fontSize: 14, color: colors.muted, lineHeight: 20 },
});
