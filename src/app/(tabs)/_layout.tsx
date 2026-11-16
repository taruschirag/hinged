import { Tabs } from "expo-router";
import { View } from "react-native";
import { AdmirerBanner } from "@/components/AdmirerBanner";
import { MatchModal } from "@/components/MatchModal";
import { useLocationSync } from "@/lib/useLocationSync";
import { colors } from "@/lib/theme";

export default function TabsLayout() {
  useLocationSync();
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.muted,
          headerStyle: { backgroundColor: colors.background },
          sceneStyle: { backgroundColor: colors.background },
        }}
      >
        <Tabs.Screen name="index" options={{ title: "Nearby" }} />
        <Tabs.Screen name="matches" options={{ title: "Matches" }} />
        <Tabs.Screen name="profile" options={{ title: "Profile" }} />
      </Tabs>
      <AdmirerBanner />
      <MatchModal />
    </View>
  );
}
