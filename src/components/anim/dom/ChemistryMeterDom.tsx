"use dom";

import { useEffect, useRef, useState } from "react";
import type { DOMProps } from "expo/dom";
import type { AnimationDocument } from "@clayzo/animation";
import meter from "../../../../assets/anim/chemistry-meter.json";
import { Stage, useClayzo } from "./useClayzo";

const document = meter as unknown as AnimationDocument;

export default function ChemistryMeterDom({ score, reduceMotion, textColor, onReady, onFailed }: {
  score: number | null;
  reduceMotion: boolean;
  textColor: string;
  onReady: () => Promise<void>;
  onFailed: (message: string) => Promise<void>;
  dom?: DOMProps;
}) {
  const { canvasRef, player } = useClayzo(document, { onReady, onFailed }, { reduceMotion });
  const current = useRef(0);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (!player) return;
    player.play();
    if (score === null) {
      current.current = 0;
      player.setInput("score", 0);
      player.setInput("hasScore", false);
      return;
    }
    const from = current.current;
    const to = Math.max(0, Math.min(100, score));
    const duration = reduceMotion ? 0 : 900 + Math.abs(to - from) * 6;
    const start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const t = duration === 0 ? 1 : Math.min(1, (now - start) / duration);
      const value = from + (to - from) * (1 - Math.pow(1 - t, 3));
      current.current = value;
      player.setInput("score", value);
      setShown(Math.round(value));
      if (t < 1) frame = requestAnimationFrame(step);
    };
    player.setInput("score", from);
    player.setInput("hasScore", true);
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [player, score, reduceMotion]);

  return (
    <Stage canvasRef={canvasRef}>
      {score !== null ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            font: "800 26vmin -apple-system, system-ui, sans-serif",
            letterSpacing: "-0.03em",
            color: textColor,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {shown}
        </div>
      ) : null}
    </Stage>
  );
}
