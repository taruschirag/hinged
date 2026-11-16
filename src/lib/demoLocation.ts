import { useSyncExternalStore } from "react";

type Coords = { lat: number; lng: number };

export const DEMO_COORDS: Coords = { lat: 37.7749, lng: -122.4194 };

let current: Coords | null = null;
const listeners = new Set<() => void>();

export function setDemoLocation(coords: Coords | null) {
  current = coords;
  listeners.forEach((l) => l());
}

export function useDemoLocation() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
}
