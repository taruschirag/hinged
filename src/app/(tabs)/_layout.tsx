import Ionicons from "@expo/vector-icons/Ionicons";
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
        <Tabs.Screen
          name="index"
          options={{ title: "Nearby", tabBarIcon: ({ color, size }) => <Ionicons name="radio-outline" color={color as string} size={size} /> }}
        />
        <Tabs.Screen
          name="matches"
          options={{ title: "Matches", tabBarIcon: ({ color, size }) => <Ionicons name="heart-outline" color={color as string} size={size} /> }}
        />
        <Tabs.Screen
          name="profile"
          options={{ title: "Profile", tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" color={color as string} size={size} /> }}
        />
      </Tabs>
      <AdmirerBanner />
      <MatchModal />
    </View>
  );
}
