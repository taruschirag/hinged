import { ConvexProvider, ConvexReactClient, useQuery } from "convex/react";
import { Redirect, Stack, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { api } from "@convex/_generated/api";
import { SessionProvider, useToken } from "@/lib/session";
import { colors } from "@/lib/theme";

export { ErrorBoundary } from "expo-router";

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!, {
  unsavedChangesWarning: false,
});

function Gate() {
  const token = useToken();
  const me = useQuery(api.users.me, { token });
  const segments = useSegments();

  if (me === undefined) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  const onboarding = segments[0] === "onboarding";
  if (!me && !onboarding) return <Redirect href="/onboarding" />;
  if (me && onboarding) return <Redirect href={{ pathname: "/wingman/interview", params: { first: "1" } }} />;

  return (
    <Stack screenOptions={{ contentStyle: { backgroundColor: colors.background }, headerTintColor: colors.text }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="person/[id]" options={{ presentation: "modal", title: "" }} />
      <Stack.Screen name="chat/[matchId]" options={{ title: "Chat" }} />
      <Stack.Screen name="wingman/interview" options={{ title: "Your wingman" }} />
      <Stack.Screen name="wingman/[chatId]" options={{ presentation: "modal", title: "Wingmen" }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ConvexProvider client={convex}>
        <SessionProvider>
          <StatusBar style="dark" />
          <Gate />
        </SessionProvider>
      </ConvexProvider>
    </GestureHandlerRootView>
  );
}
