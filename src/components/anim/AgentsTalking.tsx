import { useState } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { colors } from "@/lib/theme";
import AgentsTalkingDom from "./dom/AgentsTalkingDom";
import { ClayzoLayer, DOM_PROPS, useClayzoStatus, useLoop, useReduceMotion } from "./runtime";

export type AgentsTalkingProps = { active: boolean; leftPhoto?: string | null; rightPhoto?: string | null; height?: number };

const ASPECT = 800 / 320;
const ORBS = [
  { x: 170 / 800, color: colors.accent },
  { x: 630 / 800, color: "#FF9A62" },
];
const ORB_Y = 214 / 320;
const BODY = 150 / 320;
const PHOTO = 124 / 320;

export function AgentsTalking({ active, leftPhoto, rightPhoto, height = 140 }: AgentsTalkingProps) {
  const { status, onReady, onFailed } = useClayzoStatus();
  const reduceMotion = useReduceMotion();
  const [width, setWidth] = useState(0);
  const stageWidth = Math.min(width, height * ASPECT);
  const stageHeight = stageWidth / ASPECT;
  const photos = [leftPhoto, rightPhoto];

  return (
    <View style={[styles.center, { height, width: "100%" }]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)} pointerEvents="none">
      {stageWidth > 0 ? (
        <View style={{ width: stageWidth, height: stageHeight }}>
          <ClayzoLayer
            status={status}
            onFailed={onFailed}
            style={StyleSheet.absoluteFill}
            fallback={<TalkFallback width={stageWidth} height={stageHeight} active={active && !reduceMotion} />}
          >
            <AgentsTalkingDom active={active} reduceMotion={reduceMotion} onReady={onReady} onFailed={onFailed} dom={DOM_PROPS} />
          </ClayzoLayer>
          {photos.map((uri, i) => {
            if (!uri) return null;
            const d = PHOTO * stageHeight;
            return (
              <Image
                key={i}
                source={{ uri }}
                contentFit="cover"
                style={[styles.photo, { width: d, height: d, borderRadius: d, left: ORBS[i].x * stageWidth - d / 2, top: ORB_Y * stageHeight - d / 2 }]}
              />
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

function TalkFallback({ width, height, active }: { width: number; height: number; active: boolean }) {
  const t = useLoop(4000, active);
  const body = BODY * height;
  const bubbles = [
    t.interpolate({ inputRange: [0, 0.05, 0.4, 0.45, 1], outputRange: [0, 1, 1, 0, 0] }),
    t.interpolate({ inputRange: [0, 0.5, 0.55, 0.9, 0.95, 1], outputRange: [0, 0, 1, 1, 0, 0] }),
  ];
  return (
    <View style={{ width, height }}>
      {ORBS.map((orb, i) => (
        <View key={i}>
          <View
            style={[styles.disc, { width: body * 1.24, height: body * 1.24, left: orb.x * width - body * 0.62, top: ORB_Y * height - body * 0.62, backgroundColor: orb.color, opacity: 0.18 }]}
          />
          <View style={[styles.disc, { width: body, height: body, left: orb.x * width - body / 2, top: ORB_Y * height - body / 2, backgroundColor: orb.color }]} />
          <Animated.View
            style={[
              styles.bubble,
              {
                opacity: active ? bubbles[i] : 0,
                height: height * 0.2,
                width: height * 0.4,
                borderRadius: height,
                left: (i === 0 ? 300 / 800 : 500 / 800) * width - height * 0.2,
                top: height * 0.16,
                gap: height * 0.04,
              },
            ]}
          >
            {[0, 1, 2].map((d) => (
              <View key={d} style={{ width: height * 0.045, height: height * 0.045, borderRadius: height, backgroundColor: orb.color }} />
            ))}
          </Animated.View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  disc: { position: "absolute", borderRadius: 9999 },
  bubble: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  photo: { position: "absolute", borderWidth: 2, borderColor: colors.surface },
});
