import { useMutation, useQuery } from "convex/react";
import { makeFunctionReference } from "convex/server";
import type { Id } from "@convex/_generated/dataModel";
import { useToken } from "@/lib/session";

export type WingmanChatId = string;
export type InterviewAnswer = { question: string; answer: string };
export type Interview = {
  status: "none" | "done";
  answers: InterviewAnswer[];
  persona: string | null;
  shareable: string | null;
};
export type VibeStatus = "pending" | "talking" | "done" | "failed";
export type Vibe = { status: VibeStatus; score: number | null; why: string[]; opener: string | null; chatId: WingmanChatId };
export type WingmanTurn = { speaker: "mine" | "theirs"; text: string };
export type WingmanChat = { status: VibeStatus; turns: WingmanTurn[]; score: number | null; why: string[]; opener: string | null };

const wingman = {
  getInterview: makeFunctionReference<"query", { token: string }, Interview>("wingman:getInterview"),
  saveInterview: makeFunctionReference<"mutation", { token: string; answers: InterviewAnswer[] }, unknown>(
    "wingman:saveInterview",
  ),
  forNearby: makeFunctionReference<"query", { token: string; now: number }, Record<string, Vibe>>("wingman:forNearby"),
  chat: makeFunctionReference<"query", { token: string; chatId: WingmanChatId }, WingmanChat | null>("wingman:chat"),
  topVibe: makeFunctionReference<"query", { token: string; now: number }, { count: number; latestAt: number }>(
    "wingman:topVibe",
  ),
  rerun: makeFunctionReference<"mutation", { token: string; userId: Id<"users"> }, WingmanChatId>("wingman:rerun"),
};

export const interviewQuestions = [
  "What does a perfect lazy Sunday look like for you?",
  "What are you obsessed with lately: music, books, shows, food, hobbies?",
  "What makes you laugh, and how would friends describe your sense of humor?",
  "What do you hope for when you meet someone new?",
  "Anything your wingman should keep private? It will never bring these up.",
] as const;

export const STRONG_VIBE = 75;

export function isStrong(vibe: Vibe | undefined) {
  return vibe?.status === "done" && (vibe.score ?? 0) >= STRONG_VIBE;
}

export function isTalking(vibe: Vibe | undefined) {
  return vibe?.status === "pending" || vibe?.status === "talking";
}

export function useInterview() {
  const token = useToken();
  return useQuery(wingman.getInterview, { token });
}

export function useNearbyVibes(now: number) {
  const token = useToken();
  return useQuery(wingman.forNearby, { token, now });
}

export function useWingmanChat(chatId: WingmanChatId) {
  const token = useToken();
  return useQuery(wingman.chat, { token, chatId });
}

export function useTopVibe(now: number) {
  const token = useToken();
  return useQuery(wingman.topVibe, { token, now });
}

export function useSaveInterview() {
  const token = useToken();
  const save = useMutation(wingman.saveInterview);
  return (answers: InterviewAnswer[]) => save({ token, answers });
}

export function useRerun() {
  const token = useToken();
  const rerun = useMutation(wingman.rerun);
  return (userId: Id<"users">) => rerun({ token, userId });
}
