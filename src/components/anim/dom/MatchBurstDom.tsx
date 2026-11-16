"use dom";

import { useEffect, useRef } from "react";
import type { DOMProps } from "expo/dom";
import type { AnimationDocument } from "@clayzo/animation";
import burst from "../../../../assets/anim/match-burst.json";
import { Stage, useClayzo } from "./useClayzo";

const document = burst as unknown as AnimationDocument;
const LAST_TICK = document.timing.durationTicks - 8;

export default function MatchBurstDom({ playId, reduceMotion, onReady, onFailed, onFinished }: {
  playId: number;
  reduceMotion: boolean;
  onReady: () => Promise<void>;
  onFailed: (message: string) => Promise<void>;
  onFinished: () => Promise<void>;
  dom?: DOMProps;
}) {
  const running = useRef(false);
  const { canvasRef, player } = useClayzo(document, { onReady, onFailed }, {
    loop: false,
    reduceMotion,
    onFrame: (handle) => {
      if (running.current && handle.tick >= LAST_TICK) {
        running.current = false;
        void onFinished();
      }
    },
  });

  useEffect(() => {
    if (!player || playId === 0) return;
    running.current = true;
    void player.seek(0).then(() => player.play());
  }, [player, playId]);

  return (
    <Stage
      canvasRef={canvasRef}
      canvasStyle={{ position: "absolute", left: "50%", top: "50%", width: "100vmax", height: "100vmax", transform: "translate(-50%, -50%)" }}
    />
  );
}
