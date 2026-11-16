/// <reference types="node" />
import { writeFileSync } from "node:fs";
import {
  ANIMATION_DOCUMENT_VERSION,
  assertValidAnimationDocument,
  base,
  constant,
  fill,
  hex,
  keyed,
  marker,
  parseSvgPath,
  pen,
  stateMachine,
  stroke,
  withComputedRevision,
  withStateMachine,
  type AnimationDocument,
  type Animatable,
  type BaseOptions,
  type Color,
  type CubicBezier,
  type Key,
  type Marker,
  type PathData,
  type SceneNode,
  type ShapeStyle,
  type Vec3,
} from "@clayzo/animation/authoring";

const OUT_DIR = new URL(".", import.meta.url);

const C = {
  accent: "#E8476A",
  accentLight: "#FF8FA6",
  accentDeep: "#C9305A",
  accentSoft: "#FDE3E8",
  peach: "#FF9A62",
  peachLight: "#FFC9A3",
  peachDeep: "#F2734A",
  gold: "#FFC14D",
  mint: "#6FD0B0",
  lilac: "#B28CFF",
  ink: "#2A1A20",
  muted: "#CDBFC3",
  track: "#F4E7E4",
  white: "#FFFFFF",
  blush: "#FF9FB4",
  sky: "#8FD3F4",
};

const IO: CubicBezier = { x1: 0.45, y1: 0, x2: 0.55, y2: 1 };
const OUT: CubicBezier = { x1: 0.22, y1: 1, x2: 0.36, y2: 1 };
const IN: CubicBezier = { x1: 0.55, y1: 0, x2: 0.85, y2: 0.35 };
const POP: CubicBezier = { x1: 0.34, y1: 1.56, x2: 0.64, y2: 1 };
const RISE: CubicBezier = { x1: 0.2, y1: 0.6, x2: 0.35, y2: 1 };

const v = (x: number, y: number): Vec3 => ({ x, y, z: 0 });
const s = (x: number, y = x): Vec3 => ({ x, y, z: 1 });
const r = (deg: number): Vec3 => ({ x: 0, y: 0, z: deg });
const col = (c: string): Color => hex(c);

function radial(stops: [number, string][], cx: number, cy: number, radius: number): ShapeStyle {
  return {
    gradientFill: {
      kind: "radial",
      stops: constant(stops.map(([position, c]) => ({ position, color: col(c) }))),
      start: constant({ x: cx, y: cy }),
      end: constant({ x: cx + radius, y: cy }),
      opacity: constant(1),
    },
  };
}

function ellipse(id: string, w: number, h: number, style: ShapeStyle, o: BaseOptions): SceneNode {
  return { ...base(id, o), type: "ellipse", size: constant({ width: w, height: h }), style };
}

function rect(id: string, w: number, h: number, radius: number, style: ShapeStyle, o: BaseOptions): SceneNode {
  return { ...base(id, o), type: "rect", size: constant({ width: w, height: h }), cornerRadius: constant(radius), style };
}

function group(id: string, children: string[], o: BaseOptions): SceneNode {
  return { ...base(id, o), type: "group", children };
}

function arc(id: string, radius: number, start: number | Animatable<number>, end: number | Animatable<number>, style: ShapeStyle, o: BaseOptions): SceneNode {
  return {
    ...base(id, o),
    type: "arc",
    radius: constant(radius),
    startAngle: typeof start === "number" ? constant(start) : start,
    endAngle: typeof end === "number" ? constant(end) : end,
    clockwise: true,
    style,
  };
}

function path(id: string, data: PathData, style: ShapeStyle, o: BaseOptions): SceneNode {
  return { ...base(id, o), type: "path", path: constant(data), style };
}

function sparkle(id: string, radius: number, color: string, o: BaseOptions): SceneNode {
  return {
    ...base(id, o),
    type: "polystar",
    variant: "star",
    points: constant(4),
    innerRadius: constant(radius * 0.38),
    outerRadius: constant(radius),
    innerRoundness: constant(0),
    outerRoundness: constant(0),
    rotationOffset: constant(0),
    style: { fill: fill(col(color)) },
  };
}

const HEART = parseSvgPath(
  "M0,35 C-40,10 -70,-15 -70,-40 C-70,-62 -52,-78 -32,-78 C-18,-78 -6,-70 0,-58 C6,-70 18,-78 32,-78 C52,-78 70,-62 70,-40 C70,-15 40,10 0,35 Z",
).path;

function rng(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

const snap = (tick: number) => Math.round(tick / 4) * 4;

function documentOf(
  id: string,
  name: string,
  width: number,
  height: number,
  duration: number,
  nodes: SceneNode[],
  roots: string[],
  markers: Marker[],
  looping: boolean,
): AnimationDocument {
  const byId: Record<string, SceneNode> = {};
  for (const node of nodes) {
    if (byId[node.id]) throw new Error(`duplicate node ${node.id}`);
    byId[node.id] = node;
  }
  return withComputedRevision({
    version: ANIMATION_DOCUMENT_VERSION,
    id,
    name,
    canvas: { width, height, pixelAspectRatio: 1, backgroundColor: hex("#00000000") },
    timing: { ticksPerSecond: 240, frameRate: { numerator: 60, denominator: 1 }, durationTicks: duration, displayStartTick: 0 },
    assets: {},
    rootCompositionId: "main",
    components: {},
    compositions: { main: { id: "main", name: "Main", width, height, durationTicks: duration, nodes: byId, rootNodeIds: roots } },
    markers,
    design: { tokens: { looping } },
    capabilities: { required: [], optional: [], unsupportedPolicy: "warn" },
  });
}

function wingmanOrb(): AnimationDocument {
  const D = 2400;
  const I = 0, T = 960, H = 1440, U = 1920;
  const nodes: SceneNode[] = [];

  const posKeys: Key<Vec3>[] = [[0, v(200, 310), "hold"]];
  const scaleKeys: Key<Vec3>[] = [
    [I, s(1), IO], [480, s(1.045, 1.03), IO], [T, s(1), IO],
    [1200, s(1.03), IO],
  ];
  for (let b = 0; b < 2; b++) {
    const t0 = H + b * 240;
    posKeys.push([t0, v(200, 310)], [t0 + 24, v(200, 312), RISE], [t0 + 112, v(200, 282), IN], [t0 + 212, v(200, 310), "hold"]);
    scaleKeys.push([t0, s(1), OUT], [t0 + 24, s(1.1, 0.9), OUT], [t0 + 60, s(0.93, 1.08), IO], [t0 + 112, s(1), IN], [t0 + 192, s(0.96, 1.05), OUT], [t0 + 212, s(1.12, 0.88), OUT]);
  }
  posKeys.push([U, v(200, 310), "hold"], [D, v(200, 310)]);
  scaleKeys.push([U, s(1), IO], [2160, s(1.02, 0.98), IO], [D, s(1)]);

  const orbChildren = ["glow3", "glow2", "glow1", "body", "innerSwirl", "highlight", "blush", "eyes", "happyEyes", "smile", "squiggle", "sweat", "swirl", "sparkles"];
  nodes.push(group("orb", orbChildren, {
    outTick: D,
    position: keyed("orb.position", posKeys),
    anchor: { x: 0, y: 110 },
    scale: keyed("orb.scale", scaleKeys),
    rotation: keyed("orb.rotation", [[0, r(0), "hold"], [U, r(0), IO], [2040, r(-9), IO], [2160, r(7), IO], [2280, r(-4), IO], [D, r(0)]]),
  }));

  const glowPulse = (id: string, lo: number, hi: number): Animatable<number> => {
    const keys: Key<number>[] = [];
    for (let t = 0; t < D; t += 480) keys.push([t, lo, IO], [t + 240, hi, IO]);
    keys.push([D, lo]);
    return keyed(id, keys);
  };
  const glowScale = (id: string, amount: number): Animatable<Vec3> => {
    const keys: Key<Vec3>[] = [];
    for (let t = 0; t < D; t += 480) keys.push([t, s(1), IO], [t + 240, s(1 + amount), IO]);
    keys.push([D, s(1)]);
    return keyed(id, keys);
  };
  nodes.push(ellipse("glow3", 310, 310, { fill: fill(col(C.accent), glowPulse("glow3.o", 0.08, 0.14)) }, { outTick: D, scale: glowScale("glow3.s", 0.05) }));
  nodes.push(ellipse("glow2", 276, 276, { fill: fill(col(C.accent), glowPulse("glow2.o", 0.13, 0.2)) }, { outTick: D, scale: glowScale("glow2.s", 0.04) }));
  nodes.push(ellipse("glow1", 246, 246, { fill: fill(col(C.accentLight), glowPulse("glow1.o", 0.22, 0.32)) }, { outTick: D }));
  nodes.push(ellipse("body", 220, 220, radial([[0, "#FFB3C2"], [0.45, C.accentLight], [0.8, C.accent], [1, C.accentDeep]], -40, -55, 190), { outTick: D }));
  nodes.push(ellipse("highlight", 64, 38, { fill: fill(col(C.white), 0.5) }, { outTick: D, x: -44, y: -62, rotation: -32 }));

  nodes.push(group("innerSwirl", ["innerSwirlArc"], {
    outTick: D,
    scale: keyed("innerSwirl.s", [[0, s(0), "hold"], [T, s(0), OUT], [1000, s(1), "hold"], [1400, s(1), IN], [H, s(0)]]),
    rotation: keyed("innerSwirl.r", [[0, r(0), "hold"], [T, r(0), "linear"], [H, r(720)]]),
  }));
  nodes.push(arc("innerSwirlArc", 78, 0, 140, { stroke: stroke(col(C.white), 12, { opacity: 0.55 }) }, { outTick: D }));

  nodes.push(group("eyes", ["eyeL", "eyeR"], {
    outTick: D,
    position: keyed("eyes.p", [
      [0, v(0, -6), "hold"], [T, v(0, -6), IO], [1040, v(14, -22), "hold"], [1360, v(14, -22), IO], [H, v(0, -6), "hold"],
      [U, v(0, -6), IO], [2000, v(-14, -4), "hold"], [2120, v(-14, -4), IO], [2200, v(12, -4), "hold"], [2320, v(12, -4), IO], [D, v(0, -6)],
    ]),
    scale: keyed("eyes.s", [
      [0, s(1), "linear"], [600, s(1), "linear"], [612, s(1, 0.1), "linear"], [628, s(1), "hold"],
      [H, s(1), "linear"], [H + 16, s(1, 0), "hold"], [U - 16, s(1, 0), "linear"], [U, s(1), "hold"],
      [2240, s(1), "linear"], [2252, s(1, 0.1), "linear"], [2268, s(1)],
    ]),
  }));
  nodes.push(ellipse("eyeL", 22, 30, { fill: fill(col(C.ink)) }, { outTick: D, x: -34, y: 0 }));
  nodes.push(ellipse("eyeR", 22, 30, { fill: fill(col(C.ink)) }, { outTick: D, x: 34, y: 0 }));

  nodes.push(group("happyEyes", ["happyEyeL", "happyEyeR"], {
    outTick: D,
    y: -8,
    scale: keyed("happyEyes.s", [[0, s(1, 0), "hold"], [H, s(1, 0), OUT], [H + 24, s(1), "hold"], [U - 16, s(1), "linear"], [U, s(1, 0)]]),
  }));
  nodes.push(arc("happyEyeL", 15, 200, 340, { stroke: stroke(col(C.ink), 8) }, { outTick: D, x: -34, y: 8 }));
  nodes.push(arc("happyEyeR", 15, 200, 340, { stroke: stroke(col(C.ink), 8) }, { outTick: D, x: 34, y: 8 }));

  nodes.push(group("blush", ["blushL", "blushR"], {
    outTick: D,
    scale: keyed("blush.s", [[0, s(0), "hold"], [H, s(0), POP], [H + 40, s(1), "hold"], [U - 24, s(1), IN], [U, s(0)]]),
  }));
  nodes.push(ellipse("blushL", 30, 16, { fill: fill(col(C.blush), 0.85) }, { outTick: D, x: -62, y: 24 }));
  nodes.push(ellipse("blushR", 30, 16, { fill: fill(col(C.blush), 0.85) }, { outTick: D, x: 62, y: 24 }));

  nodes.push(arc("smile", 18, 25, 155, { stroke: stroke(col(C.ink), 6) }, {
    outTick: D,
    y: 26,
    scale: keyed("smile.s", [
      [0, s(1), "hold"], [T, s(1), IO], [1000, s(0.55), "hold"], [1400, s(0.55), IO], [H, s(1), OUT],
      [H + 24, s(1.45), "hold"], [U - 16, s(1.45), IO], [U, s(0), "hold"], [D - 16, s(0), IO], [D, s(1)],
    ]),
  }));
  const squiggle = pen(-20, 0).curveTo({ x: -13, y: -9 }, { x: -7, y: -9 }, 0, 0).curveTo({ x: 7, y: 9 }, { x: 13, y: 9 }, 20, 0).open();
  nodes.push(path("squiggle", { contours: [squiggle] }, { stroke: stroke(col(C.ink), 6) }, {
    outTick: D,
    y: 40,
    scale: keyed("squiggle.s", [[0, s(0), "hold"], [U, s(0), OUT], [U + 24, s(1), "hold"], [D - 16, s(1), IN], [D, s(0)]]),
  }));
  nodes.push(ellipse("sweat", 14, 20, { fill: fill(col(C.sky), 0.9) }, {
    outTick: D,
    position: keyed("sweat.p", [[0, v(84, -70), "hold"], [U + 120, v(84, -70), IN], [U + 400, v(90, -30), "hold"], [D, v(90, -30)]]),
    scale: keyed("sweat.s", [[0, s(0), "hold"], [U + 80, s(0), POP], [U + 120, s(1), "hold"], [D - 40, s(1), IN], [D, s(0)]]),
  }));

  nodes.push(group("swirl", ["swirlA", "swirlB", "swirlC"], {
    outTick: D,
    scale: keyed("swirl.s", [[0, s(0), "hold"], [T, s(0), OUT], [1020, s(1), "hold"], [1396, s(1), IN], [H, s(0)]]),
    rotation: keyed("swirl.r", [[0, r(0), "hold"], [T, r(0), "linear"], [H, r(360)]]),
  }));
  const orbit = (deg: number) => ({ x: Math.cos((deg * Math.PI) / 180) * 150, y: Math.sin((deg * Math.PI) / 180) * 150 });
  nodes.push(ellipse("swirlA", 22, 22, { fill: fill(col(C.gold)) }, { outTick: D, ...orbit(-90) }));
  nodes.push(ellipse("swirlB", 15, 15, { fill: fill(col(C.accent)) }, { outTick: D, ...orbit(-140) }));
  nodes.push(ellipse("swirlC", 10, 10, { fill: fill(col(C.peach)) }, { outTick: D, ...orbit(-180) }));

  nodes.push(group("sparkles", ["sparkleA", "sparkleB"], { outTick: D }));
  const twinkle = (id: string, delay: number): Animatable<Vec3> => keyed(id, [
    [0, s(0), "hold"], [H + delay, s(0), POP], [H + delay + 40, s(1), IO], [H + delay + 160, s(0.6), IO],
    [H + delay + 280, s(1), IO], [U - 40, s(1), IN], [U, s(0)],
  ]);
  nodes.push(sparkle("sparkleA", 22, C.gold, { outTick: D, x: -128, y: -104, scale: twinkle("sparkleA.s", 0), rotation: keyed("sparkleA.r", [[0, r(0), "hold"], [H, r(0), "linear"], [U, r(90)]]) }));
  nodes.push(sparkle("sparkleB", 15, C.accent, { outTick: D, x: 130, y: -128, scale: twinkle("sparkleB.s", 40), rotation: keyed("sparkleB.r", [[0, r(0), "hold"], [H, r(0), "linear"], [U, r(-90)]]) }));

  const markers = [
    marker("idle", I, { durationTicks: T - I, payload: { loop: true } }),
    marker("thinking", T, { durationTicks: H - T, payload: { loop: true } }),
    marker("happy", H, { durationTicks: U - H, payload: { loop: true } }),
    marker("unsure", U, { durationTicks: D - U, payload: { loop: true } }),
  ];
  const scene = documentOf("wingman-orb", "Wingman orb", 400, 400, D, nodes, ["orb"], markers, false);
  const moods = ["idle", "thinking", "happy", "unsure"] as const;
  let machine = stateMachine({ initial: "idle" });
  for (const mood of moods) machine = machine.state(mood, { marker: mood, playback: "loop" });
  moods.forEach((mood, value) => {
    machine = machine.when("*", mood, { input: "mood", operator: "eq", value });
  });
  return withStateMachine(scene, machine, { inputs: { mood: { kind: "number", minimum: 0, maximum: 3, defaultValue: 0 } } });
}

function agentsTalking(): AnimationDocument {
  const D = 960;
  const nodes: SceneNode[] = [];

  const orb = (side: "L" | "R", x: number, palette: { light: string; mid: string; deep: string; glow: string }, scaleKeys: Key<Vec3>[], posKeys: Key<Vec3>[]) => {
    const id = `orb${side}`;
    nodes.push(group(id, [`${id}.glow2`, `${id}.glow1`, `${id}.body`, `${id}.hi`], {
      outTick: D,
      position: keyed(`${id}.p`, posKeys.map(([t, p, e]) => [t, v(x, p.y), e] as Key<Vec3>)),
      scale: keyed(`${id}.s`, scaleKeys),
    }));
    nodes.push(ellipse(`${id}.glow2`, 220, 220, { fill: fill(col(palette.glow), 0.12) }, { outTick: D }));
    nodes.push(ellipse(`${id}.glow1`, 186, 186, { fill: fill(col(palette.glow), 0.22) }, { outTick: D }));
    nodes.push(ellipse(`${id}.body`, 150, 150, radial([[0, palette.light], [0.55, palette.mid], [1, palette.deep]], -28, -38, 130), { outTick: D }));
    nodes.push(ellipse(`${id}.hi`, 44, 26, { fill: fill(col(C.white), 0.5) }, { outTick: D, x: -30, y: -44, rotation: -32 }));
  };

  const bob = (start: number): Key<Vec3>[] => {
    const keys: Key<Vec3>[] = [[0, v(0, 214), "hold"], [start, v(0, 214), IO]];
    for (let t = start; t < start + 360; t += 120) keys.push([t + 60, v(0, 204), IO], [t + 120, v(0, 214), IO]);
    keys.push([D, v(0, 214)]);
    return keys;
  };
  orb("L", 170, { light: "#FFB3C2", mid: C.accentLight, deep: C.accent, glow: C.accent },
    [[0, s(1), IO], [240, s(1.03), IO], [480, s(1), IO], [720, s(1.03), IO], [896, s(1), OUT], [924, s(1.08), IO], [D, s(1)]],
    bob(60));
  orb("R", 630, { light: C.peachLight, mid: C.peach, deep: C.peachDeep, glow: C.peach },
    [[0, s(1.02), IO], [240, s(1), IO], [404, s(1.02), OUT], [444, s(1.08), IO], [520, s(1.01), IO], [720, s(1.03), IO], [D, s(1.02)]],
    bob(540));

  const bubble = (side: "L" | "R", start: number, dotColors: string[]) => {
    const id = `bubble${side}`;
    const dir = side === "L" ? 1 : -1;
    const ax = -54 * dir;
    nodes.push(group(id, [`${id}.tail2`, `${id}.tail1`, `${id}.card`, `${id}.d0`, `${id}.d1`, `${id}.d2`], {
      outTick: D,
      x: (side === "L" ? 300 : 500) + ax,
      y: 82 + 42,
      anchor: { x: ax, y: 42 },
      scale: keyed(`${id}.s`, [[0, s(0), "hold"], [start, s(0), POP], [start + 64, s(1), "hold"], [start + 352, s(1), IN], [start + 400, s(0), "hold"], [D, s(0)]]),
    }));
    nodes.push(ellipse(`${id}.tail2`, 10, 10, { fill: fill(col(C.white)), stroke: stroke(col("#F1DDD9"), 3) }, { outTick: D, x: ax - 12 * dir, y: 54 }));
    nodes.push(ellipse(`${id}.tail1`, 18, 18, { fill: fill(col(C.white)), stroke: stroke(col("#F1DDD9"), 3) }, { outTick: D, x: ax + 2 * dir, y: 36 }));
    nodes.push(rect(`${id}.card`, 128, 64, 32, { fill: fill(col(C.white)), stroke: stroke(col("#F1DDD9"), 3) }, { outTick: D }));
    for (let i = 0; i < 3; i++) {
      const keys: Key<Vec3>[] = [[0, v((i - 1) * 28, 0), "hold"]];
      for (let t = start + 64 + i * 24; t < start + 340; t += 96) keys.push([t, v((i - 1) * 28, 0), IO], [t + 32, v((i - 1) * 28, -10), IO], [t + 64, v((i - 1) * 28, 0), "hold"]);
      nodes.push(ellipse(`${id}.d${i}`, 14, 14, { fill: fill(col(dotColors[i])) }, { outTick: D, position: keyed(`${id}.d${i}.p`, keys) }));
    }
  };
  bubble("L", 8, [C.accent, C.accentLight, C.accent]);
  bubble("R", 480, [C.peachDeep, C.peach, C.peachDeep]);

  const flight = (prefix: string, from: number, to: number, start: number, colors: string[]) => {
    for (let i = 0; i < 3; i++) {
      const id = `${prefix}${i}`;
      const t0 = start + i * 20;
      const steps = 8;
      const keys: Key<Vec3>[] = [[0, v(from, 160), "hold"]];
      for (let k = 0; k <= steps; k++) {
        const u = k / steps;
        const x = from + (to - from) * u;
        const y = 160 - Math.sin(u * Math.PI) * (110 - i * 18);
        keys.push([snap(t0 + 120 * u), v(x, y), k === steps ? "hold" : "linear"]);
      }
      keys.push([D, v(to, 160)]);
      nodes.push(sparkle(id, 14 - i * 3, colors[i], {
        outTick: D,
        position: keyed(`${id}.p`, keys),
        scale: keyed(`${id}.s`, [[0, s(0), "hold"], [t0, s(0), POP], [t0 + 24, s(1), "hold"], [t0 + 96, s(1), IN], [t0 + 120, s(0), "hold"], [D, s(0)]]),
        rotation: keyed(`${id}.r`, [[0, r(0), "hold"], [t0, r(0), "linear"], [t0 + 120, r(180 * (to > from ? 1 : -1)), "hold"], [D, r(0)]]),
      }));
    }
  };
  flight("sparkLR", 250, 560, 324, [C.gold, C.accent, C.accentLight]);
  flight("sparkRL", 550, 240, 780, [C.gold, C.peach, C.peachDeep]);

  const roots = nodes.filter((n) => !nodes.some((p) => p.type === "group" && p.children.includes(n.id))).map((n) => n.id);
  return documentOf("agents-talking", "Agents talking", 800, 320, D, nodes, roots, [marker("loop", 0, { durationTicks: D, payload: { loop: true } })], true);
}

function chemistryMeter(): AnimationDocument {
  const P = 480;
  const F = 1000;
  const D = P + F;
  const last = D - 4;
  const nodes: SceneNode[] = [];

  nodes.push(arc("track", 160, 0, 360, { stroke: stroke(col(C.track), 30) }, { outTick: D, x: 200, y: 200 }));
  nodes.push(group("shimmer", ["shimmerTail", "shimmerArc"], {
    outTick: D,
    x: 200,
    y: 200,
    scale: keyed("shimmer.s", [[0, s(1), "hold"], [P, s(0)]]),
    rotation: keyed("shimmer.r", [[0, r(0), "linear"], [P, r(360)]]),
  }));
  nodes.push(arc("shimmerArc", 160, -150, -90, { stroke: stroke(col("#F7B9C7"), 30, { opacity: keyed("shimmerArc.o", [[0, 0.55, IO], [240, 0.95, IO], [P, 0.55]]) }) }, { outTick: D }));
  nodes.push(arc("shimmerTail", 160, -210, -140, { stroke: stroke(col("#FBD9E1"), 30, { opacity: 0.7 }) }, { outTick: D }));

  nodes.push(arc("fillArc", 160, -90, keyed("fillArc.end", [[0, -89.5, "hold"], [P, -89.5, "linear"], [last, 270]]), {
    stroke: stroke(keyed("fillArc.c", [[0, col(C.muted), "hold"], [P, col(C.muted), "linear"], [P + 500, col("#F08AA2"), "linear"], [last, col(C.accent)]]), 30, {
      opacity: keyed("fillArc.o", [[0, 0, "hold"], [P, 1]]),
    }),
  }, { outTick: D, x: 200, y: 200 }));
  nodes.push(group("knobSpin", ["knob"], {
    outTick: D,
    x: 200,
    y: 200,
    rotation: keyed("knobSpin.r", [[0, r(0), "hold"], [P, r(0), "linear"], [last, r(359.5)]]),
    scale: keyed("knobSpin.s", [[0, s(0), "hold"], [P, s(1)]]),
  }));
  nodes.push(ellipse("knob", 12, 12, { fill: fill(col(C.white), 0.9) }, { outTick: D, x: 0, y: -160 }));

  const scene = documentOf("chemistry-meter", "Chemistry meter", 400, 400, D, nodes, ["track", "shimmer", "fillArc", "knobSpin"], [
    marker("pending", 0, { durationTicks: P, payload: { loop: true } }),
    marker("fill", P, { durationTicks: F }),
  ], false);
  const machine = stateMachine({ initial: "pending" })
    .state("pending", { marker: "pending", playback: "loop" })
    .state("fill", { marker: "fill", playback: "scrub", scrubInput: "score" })
    .when("pending", "fill", { input: "hasScore", operator: "eq", value: true })
    .when("fill", "pending", { input: "hasScore", operator: "eq", value: false });
  return withStateMachine(scene, machine, {
    inputs: {
      score: { kind: "number", minimum: 0, maximum: 100, defaultValue: 0 },
      hasScore: { kind: "boolean", defaultValue: false },
    },
  });
}

function matchBurst(): AnimationDocument {
  const D = 360;
  const rand = rng(14);
  const nodes: SceneNode[] = [];
  const roots: string[] = [];
  const add = (node: SceneNode, root = true) => {
    nodes.push(node);
    if (root) roots.push(node.id);
  };

  add(ellipse("flash", 300, 300, { fill: fill(col(C.accentSoft), keyed("flash.o", [[0, 0.9, OUT], [140, 0]])) }, {
    outTick: D, x: 500, y: 500, scale: keyed("flash.s", [[0, s(0), OUT], [140, s(3.4)]]),
  }));
  add(ellipse("shock", 200, 200, { stroke: stroke(col(C.accent), 10, { opacity: keyed("shock.o", [[0, 0.9, "linear"], [40, 0.9, IO], [170, 0]]) }) }, {
    outTick: D, x: 500, y: 500, scale: keyed("shock.s", [[0, s(0), OUT], [170, s(4.4)]]),
  }));
  add(ellipse("shock2", 200, 200, { stroke: stroke(col(C.peach), 6, { opacity: keyed("shock2.o", [[0, 0, "hold"], [28, 0.8, IO], [200, 0]]) }) }, {
    outTick: D, x: 500, y: 500, scale: keyed("shock2.s", [[0, s(0.3), "hold"], [28, s(0.3), OUT], [200, s(3.6)]]),
  }));

  const confettiColors = [C.accent, C.gold, C.mint, C.peach, C.lilac, C.accentLight];
  for (let i = 0; i < 30; i++) {
    const angle = (i / 30) * Math.PI * 2 + (rand() - 0.5) * 0.3;
    const dist = 300 + rand() * 200;
    const t0 = snap(8 + rand() * 30);
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist;
    const fall = 140 + rand() * 120;
    const spin = (rand() > 0.5 ? 1 : -1) * (300 + rand() * 500);
    const w = 12 + rand() * 6;
    const id = `confetti${i}`;
    add(rect(id, w, w * 1.9, 4, { fill: fill(col(confettiColors[i % confettiColors.length]), keyed(`${id}.o`, [[0, 1, "hold"], [snap(250 + rand() * 40), 1, "linear"], [D, 0]])) }, {
      outTick: D,
      inTick: t0,
      position: keyed(`${id}.p`, [[t0, v(500, 500), OUT], [t0 + 132, v(500 + dx, 500 + dy), IN], [D, v(500 + dx * 1.12, 500 + dy * 1.12 + fall)]]),
      rotation: keyed(`${id}.r`, [[t0, r(rand() * 180), "linear"], [D, r(spin)]]),
      scale: keyed(`${id}.s`, [[t0, s(0.3), OUT], [t0 + 40, s(1)]]),
    }));
  }

  const heartColors = [C.accent, C.accentLight, "#FFB0C0", C.peach];
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2 + 0.26 + (rand() - 0.5) * 0.25;
    const dist = 250 + rand() * 170;
    const t0 = snap(16 + rand() * 40);
    const size = 0.22 + rand() * 0.22;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist;
    const id = `heart${i}`;
    add(path(id, HEART, { fill: fill(col(heartColors[i % heartColors.length]), keyed(`${id}.o`, [[0, 1, "hold"], [snap(230 + rand() * 50), 1, "linear"], [D, 0]])) }, {
      outTick: D,
      inTick: t0,
      anchor: { x: 0, y: -22 },
      position: keyed(`${id}.p`, [[t0, v(500, 500), OUT], [t0 + 152, v(500 + dx, 500 + dy), IO], [D, v(500 + dx * 1.05, 500 + dy - 60)]]),
      scale: keyed(`${id}.s`, [[t0, s(0), POP], [t0 + 48, s(size)]]),
      rotation: keyed(`${id}.r`, [[t0, r(0), IO], [D, r((rand() - 0.5) * 50)]]),
    }));
  }

  for (let i = 0; i < 8; i++) {
    const angle = rand() * Math.PI * 2;
    const dist = 160 + rand() * 260;
    const t0 = snap(40 + rand() * 120);
    const id = `twinkle${i}`;
    add(sparkle(id, 16 + rand() * 12, i % 2 ? C.gold : C.white, {
      outTick: D,
      inTick: t0,
      x: 500 + Math.cos(angle) * dist,
      y: 500 + Math.sin(angle) * dist,
      scale: keyed(`${id}.s`, [[t0, s(0), POP], [t0 + 40, s(1), IO], [t0 + 120, s(0)]]),
      rotation: keyed(`${id}.r`, [[t0, r(0), "linear"], [t0 + 120, r(90)]]),
    }));
  }

  add(group("bigHeart", ["bigHeartShape", "bigHeartShine"], {
    outTick: D,
    x: 500,
    y: 500,
    anchor: { x: 0, y: -22 },
    scale: keyed("bigHeart.s", [[0, s(0), POP], [72, s(2.7), IO], [112, s(2.3), IO], [240, s(2.4), IN], [D, s(3.4)]]),
  }));
  add(path("bigHeartShape", HEART, { fill: fill(col(C.accent), keyed("bigHeart.o", [[0, 1, "hold"], [250, 1, "linear"], [D - 8, 0]])) }, { outTick: D }), false);
  add(ellipse("bigHeartShine", 26, 16, { fill: fill(col(C.white), keyed("bigHeartShine.o", [[0, 0.6, "hold"], [250, 0.6, "linear"], [D - 8, 0]])) }, { outTick: D, x: -36, y: -52, rotation: -30 }), false);

  return documentOf("match-burst", "Match burst", 1000, 1000, D, nodes, roots, [marker("burst", 0, { durationTicks: D })], false);
}

const documents: Record<string, AnimationDocument> = {
  "wingman-orb": wingmanOrb(),
  "agents-talking": agentsTalking(),
  "chemistry-meter": chemistryMeter(),
  "match-burst": matchBurst(),
};

for (const [name, document] of Object.entries(documents)) {
  assertValidAnimationDocument(document);
  writeFileSync(new URL(`${name}.json`, OUT_DIR), JSON.stringify(document));
  console.log(`${name}.json`, document.revision);
}
