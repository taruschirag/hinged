import { Image } from "expo-image";
import { Text, View } from "react-native";
import { colors } from "@/lib/theme";

export function Avatar({
  uri,
  name,
  size,
  ring,
}: {
  uri: string | null | undefined;
  name: string;
  size: number;
  ring?: boolean;
}) {
  const frame = {
    width: size,
    height: size,
    borderRadius: size / 2,
    borderWidth: ring ? 4 : 0,
    borderColor: colors.surface,
    backgroundColor: colors.accentSoft,
    overflow: "hidden" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  };
  return (
    <View style={frame}>
      {uri ? (
        <Image source={{ uri }} style={{ width: "100%", height: "100%" }} contentFit="cover" transition={150} />
      ) : (
        <Text style={{ color: colors.accent, fontSize: size * 0.4, fontWeight: "700" }}>
          {name.slice(0, 1).toUpperCase()}
        </Text>
      )}
    </View>
  );
}
