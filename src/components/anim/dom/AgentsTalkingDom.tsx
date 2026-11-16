"use dom";

import { useEffect } from "react";
import type { DOMProps } from "expo/dom";
import type { AnimationDocument } from "@clayzo/animation";
import talking from "../../../../assets/anim/agents-talking.json";
import { Stage, useClayzo } from "./useClayzo";

const document = talking as unknown as AnimationDocument;

export default function AgentsTalkingDom({ active, reduceMotion, onReady, onFailed }: {
  active: boolean;
  reduceMotion: boolean;
  onReady: () => Promise<void>;
  onFailed: (message: string) => Promise<void>;
  dom?: DOMProps;
}) {
  const { canvasRef, player } = useClayzo(document, { onReady, onFailed }, { reduceMotion });

  useEffect(() => {
    if (!player) return;
    if (active) {
      player.play();
      return;
    }
    player.pause();
    void player.seek(0);
  }, [player, active]);

  return <Stage canvasRef={canvasRef} />;
}
