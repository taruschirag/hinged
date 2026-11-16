/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { interviewQuestions } from "./wingmanQuestions";

const modules = import.meta.glob("./**/*.ts");
const LAT = 37.7749;
const LNG = -122.4194;

function setup() {
  return convexTest(schema, modules);
}
type T = ReturnType<typeof setup>;

type Body = { model: string; messages?: { role: string; content: string }[]; input?: string };

function openaiMock(opts: { verdict?: string } = {}) {
  const calls: Body[] = [];
  let turn = 0;
  const fetchMock = vi.fn(async (url: string, init: { body: string }) => {
    const body = JSON.parse(init.body) as Body;
    calls.push(body);
    if (url.endsWith("/embeddings")) {
      return Response.json({ data: [{ embedding: Array.from({ length: 1536 }, (_, i) => (i % 7) / 7) }] });
    }
    const system = body.messages?.[0].content ?? "";
    let content: string;
    if (system.includes("You set up an AI wingman")) {
      content = JSON.stringify({ persona: "You love slow mornings.", shareable: "They love slow mornings and email me at a@b.co." });
    } else if (system.includes("You judge romantic chemistry")) {
      content =
        opts.verdict ??
        JSON.stringify({
          score: 140,
          whyA: ["You both love books", "Same dry humor"],
          whyB: ["Shared love of coffee", "Both night owls"],
          openerA: "Ask about the book in their bag",
          openerB: "Ask about their coffee order",
        });
    } else {
      content = "turn " + turn++;
    }
    return Response.json({ choices: [{ message: { content } }] });
  });
  vi.stubGlobal("fetch", fetchMock);
  return { calls, fetchMock };
}

async function makeUser(t: T, token: string, opts: { lat?: number } = {}) {
  const photoId = await t.run(async (ctx) => await ctx.storage.store(new Blob(["p"], { type: "image/jpeg" })));
  const id = await t.mutation(api.users.saveProfile, { token, name: `Zq${token}`, age: 25, bio: "hi", photoId });
  await t.mutation(api.users.setVisible, { token, visible: true });
  await t.mutation(api.users.updateLocation, { token, lat: opts.lat ?? LAT, lng: LNG });
  return id;
}

async function giveWingman(t: T, userId: Id<"users">, embedding?: number[]) {
  await t.run(async (ctx) => {
    await ctx.db.insert("wingmen", {
      userId,
      answers: [],
      persona: "persona",
      shareable: "shareable for " + userId,
      ...(embedding ? { embedding } : {}),
      updatedAt: Date.now(),
    });
  });
}

function vec(x: number, y: number) {
  const v = new Array<number>(1536).fill(0);
  v[0] = x;
  v[1] = y;
  return v;
}

async function chats(t: T) {
  return await t.run(async (ctx) => await ctx.db.query("wingmanChats").collect());
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv("OPENAI_API_KEY", "test-key");
  openaiMock();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("wingman interview", () => {
  test("exports five questions", () => {
    expect(interviewQuestions).toHaveLength(5);
  });

  test("getInterview is none before saving", async () => {
    const t = setup();
    await makeUser(t, "a");
    expect(await t.query(api.wingman.getInterview, { token: "a" })).toEqual({
      status: "none",
      answers: [],
      persona: null,
      shareable: null,
    });
    expect((await t.query(api.wingman.getInterview, { token: "nobody" })).status).toBe("none");
  });

  test("saveInterview stores answers and builds a scrubbed persona with an embedding", async () => {
    const { calls } = openaiMock();
    const t = setup();
    const a = await makeUser(t, "a");
    const answers = interviewQuestions.map((question) => ({ question, answer: "  I like " + question.length + "  " }));
    await t.mutation(api.wingman.saveInterview, { token: "a", answers });
    const pending = await t.query(api.wingman.getInterview, { token: "a" });
    expect(pending.status).toBe("done");
    expect(pending.persona).toBeNull();
    expect(pending.answers[0].answer).toBe("I like " + interviewQuestions[0].length);

    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const done = await t.query(api.wingman.getInterview, { token: "a" });
    expect(done.persona).toBe("You love slow mornings.");
    expect(done.shareable).toBe("They love slow mornings and email me at [hidden]");
    const row = await t.run(async (ctx) =>
      await ctx.db.query("wingmen").withIndex("by_userId", (q) => q.eq("userId", a)).unique(),
    );
    expect(row?.embedding).toHaveLength(1536);
    expect(calls.map((c) => c.model)).toEqual(["gpt-5.4-mini", "text-embedding-3-small"]);
  });

  test("saveInterview rejects empty answers and unknown users", async () => {
    const t = setup();
    await makeUser(t, "a");
    await expect(
      t.mutation(api.wingman.saveInterview, { token: "a", answers: [{ question: "q", answer: "  " }] }),
    ).rejects.toThrow(/at least one/);
    await expect(
      t.mutation(api.wingman.saveInterview, { token: "x", answers: [{ question: "q", answer: "a" }] }),
    ).rejects.toThrow(/Not signed up/);
  });

  test("without an API key the persona stays empty and nothing throws", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const { fetchMock } = openaiMock();
    const t = setup();
    await makeUser(t, "a");
    await t.mutation(api.wingman.saveInterview, { token: "a", answers: [{ question: "q", answer: "a" }] });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect((await t.query(api.wingman.getInterview, { token: "a" })).persona).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("wingman triggering", () => {
  test("updateLocation starts at most 3 chats per call, picks the most similar, and dedupes pairs", async () => {
    const t = setup();
    const a = await makeUser(t, "a");
    const others: Id<"users">[] = [];
    for (let i = 0; i < 5; i++) others.push(await makeUser(t, "p" + i));
    const far = await makeUser(t, "far", { lat: LAT + 0.01 });
    await giveWingman(t, far, vec(1, 0));
    await giveWingman(t, a, vec(1, 0));
    const sims = [vec(0, 1), vec(1, 0.1), vec(0.2, 1), vec(1, 0.2), vec(1, 0.3)];
    for (const [i, id] of others.entries()) await giveWingman(t, id, sims[i]);

    await t.mutation(api.users.updateLocation, { token: "a", lat: LAT, lng: LNG });
    let rows = await chats(t);
    expect(rows).toHaveLength(3);
    const partners = rows.map((c) => (c.userA === a ? c.userB : c.userA));
    expect(new Set(partners)).toEqual(new Set([others[1], others[3], others[4]]));
    expect(rows.every((c) => c.status === "pending")).toBe(true);

    await t.mutation(api.users.updateLocation, { token: "a", lat: LAT, lng: LNG });
    rows = await chats(t);
    expect(rows).toHaveLength(5);

    await t.mutation(api.users.updateLocation, { token: "a", lat: LAT, lng: LNG });
    expect(await chats(t)).toHaveLength(5);
    await t.mutation(api.users.updateLocation, { token: "p0", lat: LAT, lng: LNG });
    rows = await chats(t);
    expect(rows.filter((c) => c.userA === a || c.userB === a)).toHaveLength(5);
    expect(new Set(rows.map((c) => c.userA + c.userB)).size).toBe(rows.length);
    expect(rows.every((c) => c.userA < c.userB)).toBe(true);
    expect(rows.some((c) => c.userA === far || c.userB === far)).toBe(false);
  });

  test("no chats without both wingmen, or while hidden", async () => {
    const t = setup();
    const a = await makeUser(t, "a");
    const b = await makeUser(t, "b");
    await giveWingman(t, a);
    await t.mutation(api.users.updateLocation, { token: "a", lat: LAT, lng: LNG });
    expect(await chats(t)).toHaveLength(0);
    await giveWingman(t, b);
    await t.mutation(api.users.setVisible, { token: "a", visible: false });
    await t.mutation(api.users.updateLocation, { token: "a", lat: LAT, lng: LNG });
    expect(await chats(t)).toHaveLength(0);
    await t.mutation(api.users.setVisible, { token: "a", visible: true });
    await t.mutation(api.users.updateLocation, { token: "a", lat: LAT, lng: LNG });
    expect(await chats(t)).toHaveLength(1);
  });

  test("a pair chat older than 6 hours can run again", async () => {
    const t = setup();
    const a = await makeUser(t, "a");
    const b = await makeUser(t, "b");
    await giveWingman(t, a);
    await giveWingman(t, b);
    await t.mutation(api.users.updateLocation, { token: "a", lat: LAT, lng: LNG });
    const [first] = await chats(t);
    await t.run(async (ctx) => await ctx.db.patch("wingmanChats", first._id, { createdAt: Date.now() - 7 * 60 * 60 * 1000 }));
    await t.mutation(api.users.updateLocation, { token: "b", lat: LAT, lng: LNG });
    expect(await chats(t)).toHaveLength(2);
  });
});

describe("wingman chats", () => {
  async function pair(t: T) {
    const a = await makeUser(t, "a");
    const b = await makeUser(t, "b");
    await makeUser(t, "c");
    await giveWingman(t, a);
    await giveWingman(t, b);
    await t.mutation(api.users.updateLocation, { token: "a", lat: LAT, lng: LNG });
    const [row] = await chats(t);
    return { a, b, chatId: row._id, aIsA: row.userA === a };
  }

  test("runChat streams 6 alternating turns, then stores the judged result per side", async () => {
    const { calls } = openaiMock();
    const t = setup();
    const { a, b, chatId, aIsA } = await pair(t);
    expect(await t.query(api.wingman.forNearby, { token: "a", now: Date.now() })).toEqual({
      [b]: { status: "pending", score: null, why: [], opener: null, chatId },
    });

    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const mine = await t.query(api.wingman.chat, { token: "a", chatId });
    const theirs = await t.query(api.wingman.chat, { token: "b", chatId });
    expect(mine?.status).toBe("done");
    expect(mine?.score).toBe(100);
    expect(mine?.turns.map((x) => x.text)).toEqual(["turn 0", "turn 1", "turn 2", "turn 3", "turn 4", "turn 5"]);
    const firstSpeaker = aIsA ? "mine" : "theirs";
    const second = aIsA ? "theirs" : "mine";
    expect(mine?.turns.map((x) => x.speaker)).toEqual([firstSpeaker, second, firstSpeaker, second, firstSpeaker, second]);
    expect(theirs?.turns.map((x) => x.speaker)).toEqual(mine?.turns.map((x) => (x.speaker === "mine" ? "theirs" : "mine")));
    expect(mine?.why).toEqual(aIsA ? ["You both love books", "Same dry humor"] : ["Shared love of coffee", "Both night owls"]);
    expect(theirs?.opener).toBe(aIsA ? "Ask about their coffee order" : "Ask about the book in their bag");

    const nearbyA = await t.query(api.wingman.forNearby, { token: "a", now: Date.now() });
    expect(nearbyA[b]).toMatchObject({ status: "done", score: 100, chatId });
    expect((await t.query(api.wingman.forNearby, { token: "b", now: Date.now() }))[a]).toMatchObject({ status: "done" });
    expect(await t.query(api.wingman.forNearby, { token: "c", now: Date.now() })).toEqual({});
    expect(await t.query(api.wingman.topVibe, { token: "a", now: Date.now() })).toMatchObject({ count: 1 });
    expect(await t.query(api.wingman.topVibe, { token: "c", now: Date.now() })).toEqual({ count: 0, latestAt: 0 });

    const turnCalls = calls.filter((c) => c.messages?.[0].content.includes("You are an AI wingman"));
    expect(turnCalls).toHaveLength(6);
    const last = turnCalls[5].messages!;
    expect(last.filter((m) => m.role === "user").every((m) => m.content.includes("<other_wingman_message>"))).toBe(true);
    expect(last[0].content).toContain("untrusted");
    expect(JSON.stringify(calls)).not.toMatch(/Zq/);
  });

  test("other users cannot read a chat they are not part of", async () => {
    openaiMock();
    const t = setup();
    const { chatId } = await pair(t);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await t.query(api.wingman.chat, { token: "c", chatId })).toBeNull();
    expect(await t.query(api.wingman.chat, { token: "nobody", chatId })).toBeNull();
  });

  test("blocking hides the chat from both sides", async () => {
    openaiMock();
    const t = setup();
    const { b, chatId } = await pair(t);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    await t.mutation(api.users.block, { token: "a", userId: b });
    expect(await t.query(api.wingman.chat, { token: "b", chatId })).toBeNull();
    expect(await t.query(api.wingman.forNearby, { token: "a", now: Date.now() })).toEqual({});
  });

  test("a missing API key or a malformed verdict marks the chat failed", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const t = setup();
    const { chatId } = await pair(t);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await t.query(api.wingman.chat, { token: "a", chatId })).toMatchObject({ status: "failed", score: null, turns: [] });

    vi.stubEnv("OPENAI_API_KEY", "test-key");
    openaiMock({ verdict: "{\"score\": 80}" });
    await t.mutation(api.wingman.rerun, { token: "a", userId: (await t.query(api.users.me, { token: "b" }))!._id });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const rows = await chats(t);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.status === "failed")).toBe(true);
  });

  test("rerun replaces the finished chat, and refuses strangers far away", async () => {
    openaiMock();
    const t = setup();
    const { b, chatId } = await pair(t);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const next = await t.mutation(api.wingman.rerun, { token: "a", userId: b });
    expect(next).not.toEqual(chatId);
    expect(await t.mutation(api.wingman.rerun, { token: "a", userId: b })).toEqual(next);
    expect(await chats(t)).toHaveLength(2);
    expect((await t.query(api.wingman.forNearby, { token: "a", now: Date.now() }))[b].chatId).toEqual(next);

    const far = await makeUser(t, "far", { lat: LAT + 0.01 });
    await giveWingman(t, far);
    await expect(t.mutation(api.wingman.rerun, { token: "a", userId: far })).rejects.toThrow(/near you/);
    const c = (await t.query(api.users.me, { token: "c" }))!._id;
    await expect(t.mutation(api.wingman.rerun, { token: "a", userId: c })).rejects.toThrow(/wingman yet/);
  });

  test("judge output is clamped, trimmed to two lines and scrubbed of contact info", async () => {
    openaiMock({
      verdict: JSON.stringify({
        score: -5,
        whyA: ["call 415 555 0100", "x", "extra"],
        whyB: ["y", "z"],
        openerA: "\"hey @maya\"",
        openerB: "see www.example.com",
      }),
    });
    const t = setup();
    const { chatId } = await pair(t);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const row = await t.run(async (ctx) => await ctx.db.get("wingmanChats", chatId));
    expect(row).toMatchObject({ status: "done", score: 0, whyA: ["call [hidden]", "x"], openerA: "hey [hidden]", openerB: "see [hidden]" });
  });
});

describe("wingman quotas and privacy", () => {
  test("editing the interview withdraws the old shareable summary until it is rebuilt", async () => {
    const t = setup();
    const a = await makeUser(t, "a");
    const b = await makeUser(t, "b");
    await giveWingman(t, a, vec(1, 0));
    await giveWingman(t, b);
    await t.mutation(api.wingman.saveInterview, { token: "a", answers: [{ question: "q", answer: "new" }] });
    const row = await t.run(async (ctx) =>
      await ctx.db.query("wingmen").withIndex("by_userId", (q) => q.eq("userId", a)).unique(),
    );
    expect(row).toMatchObject({ persona: null, shareable: null });
    expect(row?.embedding).toBeUndefined();
    await t.mutation(api.users.updateLocation, { token: "a", lat: LAT, lng: LNG });
    expect(await chats(t)).toHaveLength(0);
    await expect(t.mutation(api.wingman.rerun, { token: "a", userId: b })).rejects.toThrow(/Set up your wingman/);
  });

  test("the hourly cap counts both participants and survives reruns and demo restarts", async () => {
    const t = setup();
    const a = await makeUser(t, "a");
    const b = await makeUser(t, "b");
    await giveWingman(t, a);
    await giveWingman(t, b);
    await t.run(async (ctx) => {
      for (let i = 0; i < 12; i++) await ctx.db.insert("wingmanUsage", { userId: b, createdAt: Date.now() });
    });
    await t.mutation(api.users.updateLocation, { token: "a", lat: LAT, lng: LNG });
    expect(await chats(t)).toHaveLength(0);
    await expect(t.mutation(api.wingman.rerun, { token: "a", userId: b })).rejects.toThrow(/breather/);

    await t.mutation(api.demo.start, { token: "a" });
    await t.mutation(api.demo.start, { token: "a" });
    await t.mutation(api.demo.start, { token: "a" });
    const used = await t.run(async (ctx) =>
      (await ctx.db.query("wingmanUsage").withIndex("by_userId_and_createdAt", (q) => q.eq("userId", a)).collect()).length,
    );
    expect(used).toBe(12);
    expect(await chats(t)).toHaveLength(2);
  });
});

describe("wingman demo", () => {
  test("demo.start gives bots wingmen and schedules staggered chats only when I have a wingman", async () => {
    openaiMock();
    const t = setup();
    const a = await makeUser(t, "a");
    await t.mutation(api.demo.start, { token: "a" });
    expect(await chats(t)).toHaveLength(0);
    const botWingmen = await t.run(async (ctx) => await ctx.db.query("wingmen").collect());
    expect(botWingmen).toHaveLength(5);
    expect(botWingmen.every((w) => w.shareable)).toBe(true);

    await giveWingman(t, a);
    await t.mutation(api.demo.start, { token: "a" });
    const rows = await chats(t);
    expect(rows).toHaveLength(5);
    await t.mutation(api.users.updateLocation, { token: "a", lat: LAT, lng: LNG });
    expect(await chats(t)).toHaveLength(5);

    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const vibes = await t.query(api.wingman.forNearby, { token: "a", now: Date.now() });
    expect(Object.values(vibes).map((x) => x.status)).toEqual(["done", "done", "done", "done", "done"]);

    await t.mutation(api.demo.stop, { token: "a" });
    expect(await chats(t)).toHaveLength(0);
    expect(await t.run(async (ctx) => (await ctx.db.query("wingmanTurns").collect()).length)).toBe(0);
    expect(await t.run(async (ctx) => (await ctx.db.query("wingmen").collect()).length)).toBe(1);
  });
});

test("internal persona build ignores stale versions", async () => {
  const { fetchMock } = openaiMock();
  const t = setup();
  const a = await makeUser(t, "a");
  await giveWingman(t, a);
  await t.action(internal.wingman.buildPersona, { userId: a, updatedAt: 1 });
  expect(fetchMock).not.toHaveBeenCalled();
});
