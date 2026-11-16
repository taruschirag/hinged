import { useQuery } from "convex/react";
import * as Location from "expo-location";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { api } from "@convex/_generated/api";
import { PersonCard } from "@/components/nearby/PersonCard";
import { VisibilityToggle } from "@/components/nearby/VisibilityToggle";
import { DEMO_COORDS, setDemoLocation } from "@/lib/demoLocation";
import { useToken } from "@/lib/session";
import { colors, radius, space } from "@/lib/theme";
import { useNow } from "@/lib/useNow";

export default function NearbyScreen() {
  const token = useToken();
  const now = useNow();
  const me = useQuery(api.users.me, { token });
  const nearby = useQuery(api.nearby.list, { token, now });
  const admirers = useQuery(api.likes.secretAdmirers, { token });
  const locating = nearby?.status === "locating";
  const [locationDenied, setLocationDenied] = useState(false);
  const [slowFix, setSlowFix] = useState(false);

  useEffect(() => {
    setSlowFix(false);
    if (!locating) return;
    const id = setTimeout(() => setSlowFix(true), 10000);
    return () => clearTimeout(id);
  }, [locating]);

  useEffect(() => {
    if (!locating) return;
    const check = () =>
      Location.getForegroundPermissionsAsync()
        .then((p) => setLocationDenied(p.status === "denied"))
        .catch(() => {});
    check();
    const id = setInterval(check, 3000);
    return () => clearInterval(id);
  }, [locating]);

  const header = (
    <View style={styles.header}>
      <VisibilityToggle visibleUntil={me?.visibleUntil ?? 0} now={now} />
      {!!admirers?.count && (
        <View style={styles.pill}>
          <Text style={styles.pillText}>
            ♥ {admirers.count} {admirers.count === 1 ? "person" : "people"} nearby {admirers.count === 1 ? "likes" : "like"} you
          </Text>
        </View>
      )}
    </View>
  );

  let empty: React.ReactNode;
  if (!nearby) {
    empty = <ActivityIndicator color={colors.accent} style={{ marginTop: space.xl }} />;
  } else if (nearby.status === "hidden") {
    empty = (
      <Message
        title="You're hidden"
        body="To see who's around you, you have to be visible too. Turn on “I'm open right now” and you'll show up for the next hour."
      />
    );
  } else if (nearby.status === "locating") {
    empty = locationDenied ? (
      <Message
        title="Location is off"
        body="Hinged needs your location to find people near you. We never show anyone where you are."
        action={{ label: "Open Settings", onPress: () => Linking.openSettings() }}
      />
    ) : (
      <View style={styles.message}>
        <ActivityIndicator color={colors.accent} />
        <Text style={[styles.messageBody, { marginTop: space.md }]}>Finding people around you…</Text>
        {slowFix && (
          <Pressable onPress={() => setDemoLocation(DEMO_COORDS)} style={styles.messageButton}>
            <Text style={styles.messageButtonText}>No GPS? Use a demo location</Text>
          </Pressable>
        )}
      </View>
    );
  } else {
    empty = (
      <Message
        title="No one nearby yet"
        body="Nobody visible is around you right now. Check back soon, or try Demo mode on the Profile tab to see how it works."
        action={{ label: "Go to Profile", onPress: () => router.navigate("/profile") }}
      />
    );
  }

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.content}
      data={nearby?.status === "ok" ? nearby.people : []}
      keyExtractor={(p) => p._id}
      numColumns={2}
      ListHeaderComponent={header}
      ListEmptyComponent={<>{empty}</>}
      renderItem={({ item }) => (
        <PersonCard
          name={item.name}
          age={item.age}
          photo={item.photo}
          liked={item.liked}
          onPress={() => router.push({ pathname: "/person/[id]", params: { id: item._id } })}
        />
      )}
    />
  );
}

function Message({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View style={styles.message}>
      <Text style={styles.messageTitle}>{title}</Text>
      <Text style={styles.messageBody}>{body}</Text>
      {action && (
        <Pressable onPress={action.onPress} style={styles.messageButton}>
          <Text style={styles.messageButtonText}>{action.label}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.background },
  content: { padding: space.md - space.xs, paddingBottom: space.xl },
  header: { padding: space.xs, gap: space.md, marginBottom: space.sm },
  pill: {
    alignSelf: "center",
    backgroundColor: colors.accentSoft,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 6,
  },
  pillText: { color: colors.accent, fontSize: 13, fontWeight: "600" },
  message: { alignItems: "center", paddingHorizontal: space.lg, paddingTop: space.xl },
  messageTitle: { fontSize: 20, fontWeight: "700", color: colors.text, marginBottom: space.sm },
  messageBody: { fontSize: 15, color: colors.muted, textAlign: "center", lineHeight: 21 },
  messageButton: {
    marginTop: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.accent,
    paddingHorizontal: space.lg,
    paddingVertical: 10,
  },
  messageButtonText: { color: colors.accent, fontWeight: "700" },
});
