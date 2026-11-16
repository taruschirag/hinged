import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, space } from "@/lib/theme";

type Props = {
  name: string;
  age: number;
  photo: string | null;
  liked: boolean;
  onPress: () => void;
};

export function PersonCard({ name, age, photo, liked, onPress }: Props) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}>
      <View style={styles.photo}>
        {photo ? (
          <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
        ) : (
          <Text style={styles.initial}>{name.slice(0, 1)}</Text>
        )}
        {liked && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>♥ Liked</Text>
          </View>
        )}
      </View>
      <Text style={styles.name} numberOfLines={1}>
        {name}, <Text style={styles.age}>{age}</Text>
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, maxWidth: "50%", padding: space.xs },
  photo: {
    aspectRatio: 3 / 4,
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  initial: { fontSize: 40, fontWeight: "700", color: colors.accent },
  badge: {
    position: "absolute",
    top: space.sm,
    right: space.sm,
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  name: { fontSize: 16, fontWeight: "700", color: colors.text, marginTop: space.sm, marginLeft: 2 },
  age: { fontWeight: "400", color: colors.muted },
});
