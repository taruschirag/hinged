import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import type { AnimationDocument } from "@clayzo/animation";
import { createPlayer, type PlayerHandle } from "@clayzo/webgl-player";

export type ClayzoBridge = {
  onReady: () => Promise<void>;
  onFailed: (message: string) => Promise<void>;
};

type Options = {
  loop?: boolean;
  reduceMotion?: boolean;
  onFrame?: (player: PlayerHandle) => void;
};

export function useClayzo(document: AnimationDocument, bridge: ClayzoBridge, options: Options = {}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [player, setPlayer] = useState<PlayerHandle | null>(null);
  const latest = useRef({ bridge, options });
  latest.current = { bridge, options };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let handle: PlayerHandle | null = null;
    let disposed = false;
    const fail = (error: unknown) => {
      if (!disposed) void latest.current.bridge.onFailed(error instanceof Error ? error.message : String(error));
    };
    createPlayer({
      canvas,
      document,
      loop: latest.current.options.loop ?? true,
      pauseWhenOffscreen: false,
      onError: fail,
      onFrame: () => {
        if (handle) latest.current.options.onFrame?.(handle);
      },
    }).then((created) => {
      if (disposed) {
        created.dispose();
        return;
      }
      handle = created;
      created.setReducedMotion(!!latest.current.options.reduceMotion);
      setPlayer(created);
      void latest.current.bridge.onReady();
    }, fail);
    return () => {
      disposed = true;
      handle?.dispose();
    };
  }, [document]);

  useEffect(() => {
    player?.setReducedMotion(!!options.reduceMotion);
  }, [player, options.reduceMotion]);

  return { canvasRef, player };
}

const RESET = "html,body,body>div{margin:0;padding:0;width:100%;height:100%;background:transparent;overflow:hidden;-webkit-user-select:none;user-select:none}";

const inNativeWebView = typeof window !== "undefined" && "$$EXPO_DOM_HOST_OS" in window;

export function Stage({ canvasRef, canvasStyle, children }: { canvasRef: RefObject<HTMLCanvasElement | null>; canvasStyle?: CSSProperties; children?: ReactNode }) {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      {inNativeWebView ? <style>{RESET}</style> : null}
      <canvas ref={canvasRef} aria-hidden style={{ display: "block", width: "100%", height: "100%", ...canvasStyle }} />
      {children}
    </div>
  );
}
