# Animation components (contract)

Owned by the animation thread. Screens import these and must not depend on how they are drawn.

- `<WingmanOrb state size />`: your agent's avatar. state: idle | thinking | happy | unsure.
- `<AgentsTalking active leftPhoto rightPhoto height />`: two agents conversing; loops while active.
- `<ChemistryMeter score size />`: 0-100 ring that animates to score; null shows a pending shimmer.
- `<MatchBurst play onDone />`: full-screen celebratory burst overlay; calls onDone when finished.

All must render safely with no network and degrade to a static fallback if the animation runtime fails.

## How they are drawn

Each animation is a Clayzo document authored in TypeScript (`assets/anim/author.ts`) and written as JSON next to it. Regenerate after editing the script with `npm run anim:build`.

| Component | Document | Driven by |
| --- | --- | --- |
| WingmanOrb | `assets/anim/wingman-orb.json` | state machine input `mood` (0 idle, 1 thinking, 2 happy, 3 unsure), each state loops |
| AgentsTalking | `assets/anim/agents-talking.json` | plain 4 s loop; paused on its first frame when `active` is false |
| ChemistryMeter | `assets/anim/chemistry-meter.json` | inputs `hasScore` (pending shimmer vs fill) and `score` (scrubbed 0-100, eased by the host) |
| MatchBurst | `assets/anim/match-burst.json` | 1.5 s, plays once per `play` |

The documents play in `@clayzo/webgl-player` inside Expo DOM components (`dom/*Dom.tsx`, `"use dom"`). Each DOM component imports its JSON, so the document ships inside the embedded DOM bundle and nothing touches the network at runtime. Photos, the score number and anything text-like are drawn outside the document, so no fonts are needed.

`runtime.tsx` holds the native side: every component shows a lightweight React Native `Animated` fallback until the WebGL player reports ready, and keeps it if the player reports an error, throws while rendering (error boundary), or is not ready within 8 s. MatchBurst switches to its fallback if the player isn't ready 700 ms after `play`, and always calls `onDone` (a safety timer covers a stalled webview). Reduce Motion is honoured on both paths.
