import { useAction, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useToken } from "@/lib/session";

export { interviewQuestions } from "@convex/wingmanQuestions";

export type Vibe = FunctionReturnType<typeof api.wingman.forNearby>[Id<"users">];

export const STRONG_VIBE = 75;

export function isStrong(vibe: Vibe | undefined) {
  return vibe?.status === "done" && (vibe.score ?? 0) >= STRONG_VIBE;
}

export function isTalking(vibe: Vibe | undefined) {
  return vibe?.status === "pending" || vibe?.status === "talking";
}

export function useInterview() {
  const token = useToken();
  return useQuery(api.wingman.getInterview, { token });
}

export function useMemoryCount(enabled: boolean) {
  const token = useToken();
  const fetchCount = useAction(api.wingman.memoryCount);
  const [count, setCount] = useState<number | null>(null);
  useFocusEffect(
    useCallback(() => {
      if (!enabled) return;
      let live = true;
      fetchCount({ token })
        .then((n) => live && setCount(n))
        .catch(() => {});
      return () => {
        live = false;
      };
    }, [enabled, token, fetchCount]),
  );
  return enabled ? count : null;
}

export function useNearbyVibes(now: number) {
  const token = useToken();
  return useQuery(api.wingman.forNearby, { token, now });
}

export function useWingmanChat(chatId: string) {
  const token = useToken();
  return useQuery(api.wingman.chat, { token, chatId: chatId as Id<"wingmanChats"> });
}

export function useTopVibe(now: number) {
  const token = useToken();
  return useQuery(api.wingman.topVibe, { token, now });
}

export function useSaveInterview() {
  const token = useToken();
  const save = useMutation(api.wingman.saveInterview);
  return (answers: { question: string; answer: string }[]) => save({ token, answers });
}

export function useRerun() {
  const token = useToken();
  const rerun = useMutation(api.wingman.rerun);
  return (userId: Id<"users">) => rerun({ token, userId });
}
