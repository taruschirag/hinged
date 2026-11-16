"use dom";

import { useEffect } from "react";
import type { DOMProps } from "expo/dom";
import type { AnimationDocument } from "@clayzo/animation";
import orb from "../../../../assets/anim/wingman-orb.json";
import { Stage, useClayzo } from "./useClayzo";

const document = orb as unknown as AnimationDocument;

export default function WingmanOrbDom({ mood, reduceMotion, onReady, onFailed }: {
  mood: number;
  reduceMotion: boolean;
  onReady: () => Promise<void>;
  onFailed: (message: string) => Promise<void>;
  dom?: DOMProps;
}) {
  const { canvasRef, player } = useClayzo(document, { onReady, onFailed }, { reduceMotion });

  useEffect(() => {
    if (!player) return;
    player.setInput("mood", mood);
    player.play();
  }, [player, mood]);

  return <Stage canvasRef={canvasRef} />;
}
