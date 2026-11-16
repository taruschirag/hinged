# Hinged

Mutual likes for people who are physically near you right now. You see someone in person, like them in the app, and nobody finds out unless they like you back. Until then they only get an anonymous "someone nearby likes you" ping.

Expo (Router, TypeScript) + Convex, run on device with Revyl.

## Layout

- `convex/` backend: `users` (profile, visibility, location, block), `nearby` (who is within ~150 m), `likes` (like, secret admirer count), `matches`, `chat`, `demo` (bots for a one-phone demo).
- `src/app/` screens (Expo Router), `src/components/`, `src/lib/` (session token, theme, hooks).
- Every Convex function takes `token`, the per-device session secret from `useToken()`.

## Run

```
npm install
npx convex dev        # needs CONVEX_DEPLOY_KEY or a Convex login
npx expo start
```
