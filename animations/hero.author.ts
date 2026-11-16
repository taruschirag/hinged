import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  ANIMATION_DOCUMENT_VERSION,
  assertValidAnimationDocument,
  base,
  constant,
  fill,
  hex,
  keyed,
  marker,
  withComputedRevision,
  type SceneNode,
  type Vec3,
} from "@clayzo/animation/authoring";

const W = 1920;
const H = 1080;
const TPS = 240;
const DURATION = 6 * TPS;

const FIELD = hex("#0F2A2E");
const TEAL = hex("#19C3B1");
const CARD = hex("#FFF7EE");
const BAR = hex("#EADFD2");
const BANDS = [hex("#E8476A"), hex("#FFC94A"), hex("#3A3AFF")];

const OUT_SOFT = { x1: 0.16, y1: 0.6, x2: 0.3, y2: 1 };
const SETTLE = { x1: 0.25, y1: 0.5, x2: 0.45, y2: 1 };
const IN_OUT = { x1: 0.45, y1: 0, x2: 0.55, y2: 1 };
const DRAIN = { x1: 0.5, y1: 0, x2: 0.7, y2: 0.7 };

const CARD_W = 420;
const CARD_H = 560;
const ENTER_X = W + CARD_W;
const EXIT_X = -CARD_W;
const SLOTS = [
  { x: 480, y: 566, rot: -4 },
  { x: 960, y: 524, rot: 0 },
  { x: 1440, y: 566, rot: 4 },
];
const STAGGER = 48;
const FIRST_IN = 8;
const OVERSHOOT_AT = 168;
const LAND_AT = 264;
const EXIT_START = 1032;
const EXIT_STAGGER = 40;
const EXIT_LEN = 144;

const p = (x: number, y: number): Vec3 => ({ x, y, z: 0 });
const r = (deg: number): Vec3 => ({ x: 0, y: 0, z: deg });

function card(i: number): Record<string, SceneNode> {
  const id = `card${i}`;
  const slot = SLOTS[i];
  const s = FIRST_IN + STAGGER * i;
  const land = s + LAND_AT;
  const e = EXIT_START + EXIT_STAGGER * i;
  const drift = Math.round((land + e) / 2 / 4) * 4;
  const position = keyed(`${id}.position`, [
    [s, p(ENTER_X, slot.y + 40), OUT_SOFT],
    [s + OVERSHOOT_AT, p(slot.x - 36, slot.y - 4), SETTLE],
    [land, p(slot.x, slot.y), IN_OUT],
    [drift, p(slot.x - 10, slot.y - 14), IN_OUT],
    [e, p(slot.x, slot.y), DRAIN],
    [e + EXIT_LEN, p(EXIT_X, slot.y + 30)],
  ]);
  const rotation = keyed(`${id}.rotation`, [
    [s, r(slot.rot + 10), OUT_SOFT],
    [s + OVERSHOOT_AT, r(slot.rot - 1.5), SETTLE],
    [land, r(slot.rot), IN_OUT],
    [e, r(slot.rot), DRAIN],
    [e + EXIT_LEN, r(slot.rot - 8)],
  ]);
  const bars = [300, 340, 220];
  const children = [`${id}.body`, `${id}.band`, ...bars.map((_, b) => `${id}.bar${b}`)];
  return {
    [id]: { ...base(id, { outTick: DURATION, position, rotation }), type: "group", children },
    [`${id}.body`]: {
      ...base(`${id}.body`, { outTick: DURATION, x: 0, y: 0 }),
      type: "rect",
      size: constant({ width: CARD_W, height: CARD_H }),
      cornerRadius: constant(40),
      style: { fill: fill(CARD) },
    },
    [`${id}.band`]: {
      ...base(`${id}.band`, { outTick: DURATION, x: 0, y: -110 }),
      type: "rect",
      size: constant({ width: CARD_W - 40, height: 300 }),
      cornerRadius: constant(28),
      style: { fill: fill(BANDS[i]) },
    },
    ...Object.fromEntries(
      bars.map((w, b) => [
        `${id}.bar${b}`,
        {
          ...base(`${id}.bar${b}`, { outTick: DURATION, x: -(CARD_W - 40) / 2 + w / 2, y: 90 + b * 50 }),
          type: "rect",
          size: constant({ width: w, height: 24 }),
          cornerRadius: constant(12),
          style: { fill: fill(BAR) },
        } satisfies SceneNode,
      ]),
    ),
  };
}

const pulse = <T,>(id: string, low: T, high: T) =>
  keyed(id, [
    [0, low, IN_OUT],
    [362, high, IN_OUT],
    [722, low, IN_OUT],
    [1082, high, IN_OUT],
    [DURATION, low],
  ]);

const nodes: Record<string, SceneNode> = {
  field: {
    ...base("field", { outTick: DURATION, x: W / 2, y: H / 2 }),
    type: "rect",
    size: constant({ width: W, height: H }),
    cornerRadius: constant(0),
    style: { fill: fill(FIELD) },
  },
  glowShape: {
    ...base("glowShape", { outTick: DURATION, x: W / 2, y: 560, scale: pulse("glowShape.scale", { x: 0.94, y: 0.94, z: 1 }, { x: 1.05, y: 1.05, z: 1 }) }),
    type: "ellipse",
    size: constant({ width: 1500, height: 720 }),
    style: { fill: fill(TEAL, pulse("glowShape.opacity", 0.32, 0.72)) },
  },
  glow: {
    ...base("glow", { outTick: DURATION, x: 0, y: 0 }),
    type: "effect",
    inputId: "glowShape",
    effect: "blur",
    parameters: [{ id: "glow.radius", name: "radius", valueType: "number", value: constant(150), minimum: 0, maximum: 400 }],
    capability: { requires: ["image-filter"], fallback: "passthrough", maxTemporarySurfaces: 1 },
  },
  ...card(0),
  ...card(1),
  ...card(2),
};

const document = withComputedRevision({
  version: ANIMATION_DOCUMENT_VERSION,
  id: "hero",
  name: "Hinged landing hero",
  canvas: { width: W, height: H, pixelAspectRatio: 1, backgroundColor: FIELD },
  timing: { ticksPerSecond: TPS, frameRate: { numerator: 60, denominator: 1 }, durationTicks: DURATION, displayStartTick: 0 },
  assets: {},
  rootCompositionId: "main",
  components: {},
  compositions: {
    main: {
      id: "main",
      name: "Main",
      width: W,
      height: H,
      durationTicks: DURATION,
      nodes,
      rootNodeIds: ["field", "glow", "card0", "card1", "card2"],
    },
  },
  markers: [
    marker("cards-in", FIRST_IN),
    marker("overshoot", FIRST_IN + STAGGER * 2 + OVERSHOOT_AT),
    marker("settled", FIRST_IN + STAGGER * 2 + LAND_AT),
    marker("drift-out", EXIT_START),
  ],
  design: { tokens: { looping: true } },
  capabilities: { required: [], optional: [], unsupportedPolicy: "warn" },
});

assertValidAnimationDocument(document);
const out = join(__dirname, "hero.json");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(document, null, 2));
console.log(`wrote ${out} revision ${(document as { revision?: string }).revision}`);
