import { useMutation, useQuery } from "convex/react";
import * as Location from "expo-location";
import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { api } from "@convex/_generated/api";
import { useToken } from "@/lib/session";
import { useNow } from "@/lib/useNow";

const INTERVAL_MS = 15000;

export function useLocationSync() {
  const token = useToken();
  const me = useQuery(api.users.me, { token });
  const now = useNow();
  const updateLocation = useMutation(api.users.updateLocation);
  const [active, setActive] = useState(AppState.currentState === "active");
  const visible = !!me && me.visibleUntil > now;

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => setActive(state === "active"));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!visible || !active) return;
    let cancelled = false;
    let subscription: Location.LocationSubscription | null = null;
    let last: { lat: number; lng: number } | null = null;
    let lastSentAt = 0;

    const send = () => {
      if (!last) return;
      lastSentAt = Date.now();
      updateLocation({ token, ...last }).catch(() => {});
    };

    (async () => {
      const { granted } = await Location.requestForegroundPermissionsAsync();
      if (!granted || cancelled) return;
      subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: INTERVAL_MS, distanceInterval: 10 },
        (position) => {
          last = { lat: position.coords.latitude, lng: position.coords.longitude };
          if (Date.now() - lastSentAt > 3000) send();
        },
        () => {},
      ).catch(() => null);
      if (cancelled) subscription?.remove();
    })();

    const timer = setInterval(send, INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
      subscription?.remove();
    };
  }, [visible, active, token, updateLocation]);
}
