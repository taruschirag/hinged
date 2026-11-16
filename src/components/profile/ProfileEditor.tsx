import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Avatar } from "@/components/matches/Avatar";
import { useToken } from "@/lib/session";
import { colors, radius, space } from "@/lib/theme";

type Profile = { name: string; age: number; bio: string; photo: string | null };

export function ProfileEditor({ profile, onDone }: { profile: Profile; onDone: () => void }) {
  const token = useToken();
  const saveProfile = useMutation(api.users.saveProfile);
  const generateUploadUrl = useMutation(api.users.generateUploadUrl);
  const [name, setName] = useState(profile.name);
  const [age, setAge] = useState(String(profile.age));
  const [bio, setBio] = useState(profile.bio);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      let photoId: Id<"_storage"> | undefined;
      if (photoUri) {
        const blob = await (await fetch(photoUri)).blob();
        const uploadUrl = await generateUploadUrl();
        const res = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": blob.type || "image/jpeg" },
          body: blob,
        });
        if (!res.ok) throw new Error("upload failed");
        photoId = (await res.json()).storageId;
      }
      await saveProfile({ token, name, age: Number.parseInt(age, 10), bio, photoId });
      onDone();
    } catch (e) {
      setError(e instanceof ConvexError ? String(e.data) : "Couldn't save your profile. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.card}>
      <Pressable style={styles.photo} onPress={pickPhoto} accessibilityLabel="Change photo">
        <Avatar uri={photoUri ?? profile.photo} name={name || profile.name} size={112} />
        <Text style={styles.photoLink}>Change photo</Text>
      </Pressable>
      <Text style={styles.label}>First name</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} maxLength={30} />
      <Text style={styles.label}>Age</Text>
      <TextInput style={styles.input} value={age} onChangeText={setAge} keyboardType="number-pad" maxLength={2} />
      <Text style={styles.label}>Bio</Text>
      <TextInput
        style={[styles.input, { minHeight: 80, textAlignVertical: "top" }]}
        value={bio}
        onChangeText={setBio}
        multiline
        maxLength={160}
        placeholder="Something people nearby could notice about you"
        placeholderTextColor={colors.muted}
      />
      <Text style={styles.counter}>{bio.length}/160</Text>
      {error && <Text style={styles.error}>{error}</Text>}
      <View style={styles.actions}>
        <Pressable style={styles.cancel} onPress={onDone} disabled={saving}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Pressable style={styles.save} onPress={save} disabled={saving}>
          {saving ? <ActivityIndicator color={colors.surface} /> : <Text style={styles.saveText}>Save</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
  },
  photo: { alignItems: "center", marginBottom: space.md },
  photoLink: { color: colors.accent, fontWeight: "600", marginTop: space.sm },
  label: { fontSize: 13, fontWeight: "600", color: colors.muted, marginTop: space.md, marginBottom: space.xs },
  input: {
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: space.md,
    paddingVertical: space.sm + 4,
    fontSize: 16,
    color: colors.text,
  },
  counter: { alignSelf: "flex-end", fontSize: 12, color: colors.muted, marginTop: space.xs },
  error: { color: colors.danger, marginTop: space.sm },
  actions: { flexDirection: "row", gap: space.sm, marginTop: space.lg },
  cancel: {
    flex: 1,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: space.sm + 6,
    alignItems: "center",
  },
  cancelText: { color: colors.text, fontWeight: "600", fontSize: 16 },
  save: {
    flex: 1,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    paddingVertical: space.sm + 6,
    alignItems: "center",
  },
  saveText: { color: colors.surface, fontWeight: "700", fontSize: 16 },
});
