# Animation components (contract)

Owned by the animation thread. Screens import these and must not depend on how they are drawn.

- `<WingmanOrb state size />`: your agent's avatar. state: idle | thinking | happy | unsure.
- `<AgentsTalking active leftPhoto rightPhoto height />`: two agents conversing; loops while active.
- `<ChemistryMeter score size />`: 0-100 ring that animates to score; null shows a pending shimmer.
- `<MatchBurst play onDone />`: full-screen celebratory burst overlay; calls onDone when finished.

All must render safely with no network and degrade to a static fallback if the animation runtime fails.
