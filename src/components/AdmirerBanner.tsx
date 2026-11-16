import { useQuery } from "convex/react";
import { Text } from "react-native";
import { api } from "@convex/_generated/api";
import { TopBanner } from "@/components/banner/TopBanner";
import { useToken } from "@/lib/session";
import { colors } from "@/lib/theme";

export function AdmirerBanner() {
  const token = useToken();
  const admirers = useQuery(api.likes.secretAdmirers, { token });
  return (
    <TopBanner
      signal={admirers?.latestAt}
      icon={<Text style={{ fontSize: 22, color: colors.accent }}>♥</Text>}
      title="Someone nearby just liked you."
      body="Like them back to find out who."
    />
  );
}
