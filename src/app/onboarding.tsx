import { useMutation } from "convex/react";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { errorMessage } from "@/components/nearby/errorMessage";
import { useToken } from "@/lib/session";
import { colors, radius, space } from "@/lib/theme";

const pickerOptions: ImagePicker.ImagePickerOptions = {
  mediaTypes: "images",
  allowsEditing: true,
  aspect: [1, 1],
  quality: 0.7,
};

export default function OnboardingScreen() {
  const token = useToken();
  const generateUploadUrl = useMutation(api.users.generateUploadUrl);
  const saveProfile = useMutation(api.users.saveProfile);
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [bio, setBio] = useState("");
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function pick(source: "camera" | "library") {
    const permission =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError(source === "camera" ? "Camera access is needed to take a photo." : "Photo access is needed to pick a photo.");
      return;
    }
    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync(pickerOptions)
        : await ImagePicker.launchImageLibraryAsync(pickerOptions);
    if (!result.canceled && result.assets[0]) {
      setPhoto(result.assets[0]);
      setError(null);
    }
  }

  function choosePhoto() {
    Alert.alert("Add a photo", "Pick a clear photo of your face so people nearby can recognise you.", [
      { text: "Take photo", onPress: () => pick("camera") },
      { text: "Choose from library", onPress: () => pick("library") },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  async function submit() {
    const ageNumber = Number(age);
    if (!name.trim()) return setError("Add your first name");
    if (!Number.isInteger(ageNumber) || ageNumber < 18) return setError("You must be 18 or older");
    if (!photo) return setError("Add a photo so people can recognise you");
    setError(null);
    setSaving(true);
    try {
      const uploadUrl = await generateUploadUrl();
      const blob = await (await fetch(photo.uri)).blob();
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": photo.mimeType ?? "image/jpeg" },
        body: blob,
      });
      if (!response.ok) throw new Error("upload failed");
      const { storageId } = (await response.json()) as { storageId: Id<"_storage"> };
      await saveProfile({ token, name, age: ageNumber, bio, photoId: storageId });
    } catch (e) {
      setError(errorMessage(e));
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Hinged</Text>
          <Text style={styles.subtitle}>
            Like someone you see nearby. They only find out if they like you back.
          </Text>

          <Pressable onPress={choosePhoto} style={styles.photo} accessibilityRole="button" accessibilityLabel="Add a photo">
            {photo ? (
              <Image source={{ uri: photo.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
            ) : (
              <View style={styles.photoEmpty}>
                <Text style={styles.photoPlus}>+</Text>
                <Text style={styles.photoHint}>Add a photo</Text>
              </View>
            )}
          </Pressable>
          {photo && (
            <Pressable onPress={choosePhoto} hitSlop={8}>
              <Text style={styles.link}>Change photo</Text>
            </Pressable>
          )}

          <Text style={styles.label}>First name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Alex"
            placeholderTextColor={colors.muted}
            style={styles.input}
            maxLength={30}
            autoCapitalize="words"
            textContentType="givenName"
          />

          <Text style={styles.label}>Age</Text>
          <TextInput
            value={age}
            onChangeText={(t) => setAge(t.replace(/[^0-9]/g, ""))}
            placeholder="18+"
            placeholderTextColor={colors.muted}
            style={styles.input}
            keyboardType="number-pad"
            maxLength={2}
          />

          <Text style={styles.label}>Short bio</Text>
          <TextInput
            value={bio}
            onChangeText={setBio}
            placeholder="Coffee, climbing, terrible puns…"
            placeholderTextColor={colors.muted}
            style={[styles.input, styles.bio]}
            multiline
            maxLength={160}
          />
          <Text style={styles.counter}>{bio.length}/160</Text>

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable
            onPress={submit}
            disabled={saving}
            style={({ pressed }) => [styles.button, (pressed || saving) && { opacity: 0.8 }]}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Start meeting people</Text>}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: space.lg, paddingBottom: space.xl * 2 },
  title: { fontSize: 34, fontWeight: "800", color: colors.accent, textAlign: "center", marginTop: space.md },
  subtitle: { fontSize: 15, color: colors.muted, textAlign: "center", marginTop: space.sm, marginBottom: space.lg, lineHeight: 21 },
  photo: {
    alignSelf: "center",
    width: 160,
    height: 160,
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  photoEmpty: { flex: 1, alignItems: "center", justifyContent: "center" },
  photoPlus: { fontSize: 40, color: colors.accent, fontWeight: "300" },
  photoHint: { color: colors.accent, fontWeight: "600" },
  link: { color: colors.accent, fontWeight: "600", textAlign: "center", marginTop: space.sm },
  label: { fontSize: 13, fontWeight: "600", color: colors.muted, marginTop: space.md, marginBottom: space.xs },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
  },
  bio: { minHeight: 90, textAlignVertical: "top" },
  counter: { alignSelf: "flex-end", color: colors.muted, fontSize: 12, marginTop: space.xs },
  error: { color: colors.danger, marginTop: space.md, textAlign: "center" },
  button: {
    marginTop: space.lg,
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingVertical: 16,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
