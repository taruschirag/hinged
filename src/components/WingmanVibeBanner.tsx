import { router } from "expo-router";
import { View } from "react-native";
import { WingmanOrb } from "@/components/anim/WingmanOrb";
import { TopBanner } from "@/components/banner/TopBanner";
import { colors } from "@/lib/theme";
import { useTopVibe } from "@/lib/wingman";

export function WingmanVibeBanner() {
  const vibe = useTopVibe();
  return (
    <TopBanner
      signal={vibe?.latestAt}
      tint={colors.wingman}
      icon={
        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.wingmanSoft, alignItems: "center", justifyContent: "center" }}>
          <WingmanOrb state="happy" size={28} />
        </View>
      }
      title="Your wingman hit it off with someone nearby."
      body="Look around, then check Nearby."
      onPress={() => router.navigate("/")}
    />
  );
}
