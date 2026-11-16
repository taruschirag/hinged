/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const LAT = 37.7749;
const LNG = -122.4194;

function setup() {
  return convexTest(schema, modules);
}

type T = ReturnType<typeof setup>;

async function storePhoto(t: T) {
  return await t.run(async (ctx) => await ctx.storage.store(new Blob(["photo"], { type: "image/jpeg" })));
}

async function makeUser(
  t: T,
  token: string,
  opts: { lat?: number; lng?: number; visible?: boolean; located?: boolean } = {},
) {
  const photoId = await storePhoto(t);
  const id = await t.mutation(api.users.saveProfile, { token, name: token, age: 25, bio: "hi", photoId });
  if (opts.visible ?? true) await t.mutation(api.users.setVisible, { token, visible: true });
  if (opts.located ?? true) {
    await t.mutation(api.users.updateLocation, { token, lat: opts.lat ?? LAT, lng: opts.lng ?? LNG });
  }
  return id;
}

async function listNearby(t: T, token: string) {
  return await t.query(api.nearby.list, { token, now: Date.now() });
}

async function nearbyNames(t: T, token: string) {
  return (await listNearby(t, token)).people.map((p) => p.name);
}

async function count(t: T, table: "users" | "likes" | "matches" | "messages" | "locations") {
  return await t.run(async (ctx) => (await ctx.db.query(table).collect()).length);
}

afterEach(() => {
  vi.useRealTimers();
});

describe("users.saveProfile", () => {
  test("creates a profile with a stored photo", async () => {
    const t = setup();
    const photoId = await storePhoto(t);
    await t.mutation(api.users.saveProfile, { token: "a", name: "  Alex  ", age: 18, bio: "hello", photoId });
    const me = await t.query(api.users.me, { token: "a" });
    expect(me).toMatchObject({ name: "Alex", age: 18, bio: "hello", visibleUntil: 0 });
    expect(me?.photo).toEqual(expect.any(String));
  });

  test("rejects under 18 and non-integer ages", async () => {
    const t = setup();
    const photoId = await storePhoto(t);
    await expect(
      t.mutation(api.users.saveProfile, { token: "a", name: "Alex", age: 17, bio: "", photoId }),
    ).rejects.toThrow(/18 or older/);
    await expect(
      t.mutation(api.users.saveProfile, { token: "a", name: "Alex", age: 20.5, bio: "", photoId }),
    ).rejects.toThrow(/18 or older/);
    expect(await t.query(api.users.me, { token: "a" })).toBeNull();
  });

  test("requires a name", async () => {
    const t = setup();
    const photoId = await storePhoto(t);
    await expect(
      t.mutation(api.users.saveProfile, { token: "a", name: "   ", age: 25, bio: "", photoId }),
    ).rejects.toThrow(/first name/);
  });

  test("requires a photo on create but not on update", async () => {
    const t = setup();
    await expect(
      t.mutation(api.users.saveProfile, { token: "a", name: "Alex", age: 25, bio: "" }),
    ).rejects.toThrow(/photo/);
    const photoId = await storePhoto(t);
    const id = await t.mutation(api.users.saveProfile, { token: "a", name: "Alex", age: 25, bio: "", photoId });
    const again = await t.mutation(api.users.saveProfile, { token: "a", name: "Alexa", age: 26, bio: "new" });
    expect(again).toEqual(id);
    expect(await t.query(api.users.me, { token: "a" })).toMatchObject({ name: "Alexa", age: 26, bio: "new" });
  });
});

describe("nearby.list", () => {
  test("is hidden when not visible", async () => {
    const t = setup();
    await makeUser(t, "a", { visible: false });
    await makeUser(t, "b");
    expect(await listNearby(t, "a")).toEqual({ status: "hidden", people: [] });
    expect(await listNearby(t, "nobody")).toEqual({ status: "hidden", people: [] });
  });

  test("is locating without a fresh location", async () => {
    const t = setup();
    const a = await makeUser(t, "a", { located: false });
    expect((await listNearby(t, "a")).status).toBe("locating");
    await t.mutation(api.users.updateLocation, { token: "a", lat: LAT, lng: LNG });
    expect((await listNearby(t, "a")).status).toBe("ok");
    await t.run(async (ctx) => {
      const loc = await ctx.db.query("locations").withIndex("by_userId", (q) => q.eq("userId", a)).unique();
      await ctx.db.patch("locations", loc!._id, { updatedAt: Date.now() - 3 * 60 * 1000 });
    });
    expect((await listNearby(t, "a")).status).toBe("locating");
  });

  test("includes visible users within ~150 m and excludes far, hidden and stale ones", async () => {
    const t = setup();
    await makeUser(t, "a");
    await makeUser(t, "close", { lat: LAT + 0.001 });
    await makeUser(t, "edge", { lng: LNG + 0.0015 });
    await makeUser(t, "far", { lat: LAT + 0.01 });
    await makeUser(t, "justOutside", { lat: LAT + 0.0015 });
    await makeUser(t, "hidden", { visible: false });
    const stale = await makeUser(t, "stale");
    await t.run(async (ctx) => {
      const loc = await ctx.db.query("locations").withIndex("by_userId", (q) => q.eq("userId", stale)).unique();
      await ctx.db.patch("locations", loc!._id, { updatedAt: Date.now() - 3 * 60 * 1000 });
    });
    const result = await listNearby(t, "a");
    expect(result.status).toBe("ok");
    expect(result.people.map((p) => p.name)).toEqual(["close", "edge"]);
    expect(result.people[0]).toMatchObject({ age: 25, bio: "hi", liked: false });
  });

  test("marks people I liked", async () => {
    const t = setup();
    await makeUser(t, "a");
    const b = await makeUser(t, "b");
    await t.mutation(api.likes.like, { token: "a", userId: b });
    expect((await listNearby(t, "a")).people).toMatchObject([{ name: "b", liked: true }]);
  });

  test("excludes matched users", async () => {
    const t = setup();
    const a = await makeUser(t, "a");
    const b = await makeUser(t, "b");
    await makeUser(t, "c");
    await t.mutation(api.likes.like, { token: "a", userId: b });
    await t.mutation(api.likes.like, { token: "b", userId: a });
    expect(await nearbyNames(t, "a")).toEqual(["c"]);
    expect(await nearbyNames(t, "b")).toEqual(["c"]);
  });

  test("excludes blocked users either way", async () => {
    const t = setup();
    await makeUser(t, "a");
    const b = await makeUser(t, "b");
    await makeUser(t, "c");
    await t.mutation(api.users.block, { token: "a", userId: b });
    expect(await nearbyNames(t, "a")).toEqual(["c"]);
    expect(await nearbyNames(t, "b")).toEqual(["c"]);
  });

  test("hides other people's demo bots", async () => {
    const t = setup();
    await makeUser(t, "a");
    await makeUser(t, "b");
    await t.mutation(api.demo.start, { token: "a" });
    expect(await nearbyNames(t, "a")).toEqual(["Ava", "b", "Leo", "Maya", "Priya", "Sam"]);
    expect(await nearbyNames(t, "b")).toEqual(["a"]);
  });
});

describe("likes", () => {
  test("rejects liking yourself", async () => {
    const t = setup();
    const a = await makeUser(t, "a");
    await expect(t.mutation(api.likes.like, { token: "a", userId: a })).rejects.toThrow(/yourself/);
  });

  test("requires the person to be nearby with a fresh location", async () => {
    const t = setup();
    await makeUser(t, "a");
    const far = await makeUser(t, "far", { lat: LAT + 0.01 });
    const unlocated = await makeUser(t, "unlocated", { located: false });
    const stale = await makeUser(t, "stale");
    await t.run(async (ctx) => {
      const loc = await ctx.db.query("locations").withIndex("by_userId", (q) => q.eq("userId", stale)).unique();
      await ctx.db.patch("locations", loc!._id, { updatedAt: Date.now() - 3 * 60 * 1000 });
    });
    for (const userId of [far, unlocated, stale]) {
      await expect(t.mutation(api.likes.like, { token: "a", userId })).rejects.toThrow(/near you/);
    }
    expect(await count(t, "likes")).toBe(0);
  });

  test("rejects liking someone hidden, or while my own location is stale", async () => {
    const t = setup();
    const a = await makeUser(t, "a");
    const hidden = await makeUser(t, "hidden");
    const b = await makeUser(t, "b");
    await t.mutation(api.users.setVisible, { token: "hidden", visible: false });
    await expect(t.mutation(api.likes.like, { token: "a", userId: hidden })).rejects.toThrow(/near you/);

    await t.run(async (ctx) => {
      const loc = await ctx.db.query("locations").withIndex("by_userId", (q) => q.eq("userId", a)).unique();
      await ctx.db.patch("locations", loc!._id, { updatedAt: Date.now() - 3 * 60 * 1000 });
    });
    await expect(t.mutation(api.likes.like, { token: "a", userId: b })).rejects.toThrow(/near you/);
    expect(await count(t, "likes")).toBe(0);
  });

  test("rejects liking someone blocked", async () => {
    const t = setup();
    await makeUser(t, "a");
    const b = await makeUser(t, "b");
    await t.mutation(api.users.block, { token: "a", userId: b });
    await expect(t.mutation(api.likes.like, { token: "a", userId: b })).rejects.toThrow(/isn't available/);
  });

  test("dedupes repeated likes", async () => {
    const t = setup();
    await makeUser(t, "a");
    const b = await makeUser(t, "b");
    expect(await t.mutation(api.likes.like, { token: "a", userId: b })).toEqual({ matchId: null });
    expect(await t.mutation(api.likes.like, { token: "a", userId: b })).toEqual({ matchId: null });
    expect(await count(t, "likes")).toBe(1);
    expect(await t.query(api.likes.secretAdmirers, { token: "b" })).toMatchObject({ count: 1 });
  });

  test("caps likes at 10 per hour", async () => {
    const t = setup();
    await makeUser(t, "a");
    const others: Id<"users">[] = [];
    for (let i = 0; i < 11; i++) others.push(await makeUser(t, `p${i}`));
    for (const userId of others.slice(0, 10)) {
      await t.mutation(api.likes.like, { token: "a", userId });
    }
    await expect(t.mutation(api.likes.like, { token: "a", userId: others[10] })).rejects.toThrow(/10 likes/);
    expect(await count(t, "likes")).toBe(10);
  });

  test("a mutual like creates exactly one match", async () => {
    const t = setup();
    const a = await makeUser(t, "a");
    const b = await makeUser(t, "b");
    expect(await t.mutation(api.likes.like, { token: "a", userId: b })).toEqual({ matchId: null });
    const { matchId } = await t.mutation(api.likes.like, { token: "b", userId: a });
    expect(matchId).not.toBeNull();
    expect(await t.mutation(api.likes.like, { token: "a", userId: b })).toEqual({ matchId });
    expect(await t.mutation(api.likes.like, { token: "b", userId: a })).toEqual({ matchId });
    expect(await count(t, "matches")).toBe(1);
    const listA = await t.query(api.matches.list, { token: "a" });
    expect(listA).toMatchObject([{ _id: matchId, other: { name: "b" }, lastMessage: null }]);
  });

  test("secretAdmirers counts pending incoming likes and drops matched or blocked ones", async () => {
    const t = setup();
    const a = await makeUser(t, "a");
    const b = await makeUser(t, "b");
    const c = await makeUser(t, "c");
    expect(await t.query(api.likes.secretAdmirers, { token: "a" })).toEqual({ count: 0, latestAt: 0 });
    await t.mutation(api.likes.like, { token: "b", userId: a });
    await t.mutation(api.likes.like, { token: "c", userId: a });
    const pending = await t.query(api.likes.secretAdmirers, { token: "a" });
    expect(pending.count).toBe(2);
    expect(pending.latestAt).toBeGreaterThan(0);
    expect(await t.query(api.likes.secretAdmirers, { token: "b" })).toEqual({ count: 0, latestAt: 0 });

    await t.mutation(api.likes.like, { token: "a", userId: b });
    expect((await t.query(api.likes.secretAdmirers, { token: "a" })).count).toBe(1);

    await t.mutation(api.users.block, { token: "a", userId: c });
    expect(await t.query(api.likes.secretAdmirers, { token: "a" })).toEqual({ count: 0, latestAt: 0 });
  });
});

describe("matches and chat", () => {
  async function matched(t: T) {
    const a = await makeUser(t, "a");
    const b = await makeUser(t, "b");
    await makeUser(t, "c");
    await t.mutation(api.likes.like, { token: "a", userId: b });
    const { matchId } = await t.mutation(api.likes.like, { token: "b", userId: a });
    return { a, b, matchId: matchId! };
  }

  test("unseen and markSeen are tracked per side", async () => {
    const t = setup();
    const { matchId } = await matched(t);
    expect(await t.query(api.matches.unseen, { token: "a" })).toMatchObject({ _id: matchId, other: { name: "b" } });
    expect(await t.query(api.matches.unseen, { token: "b" })).toMatchObject({ _id: matchId, other: { name: "a" } });
    expect(await t.query(api.matches.unseen, { token: "c" })).toBeNull();

    await t.mutation(api.matches.markSeen, { token: "c", matchId });
    expect(await t.query(api.matches.unseen, { token: "a" })).not.toBeNull();

    await t.mutation(api.matches.markSeen, { token: "a", matchId });
    expect(await t.query(api.matches.unseen, { token: "a" })).toBeNull();
    expect(await t.query(api.matches.unseen, { token: "b" })).toMatchObject({ _id: matchId });

    await t.mutation(api.matches.markSeen, { token: "b", matchId });
    expect(await t.query(api.matches.unseen, { token: "b" })).toBeNull();
  });

  test("only members can send and list messages, and sending bumps lastMessageAt", async () => {
    const t = setup();
    const { matchId } = await matched(t);
    await t.run(async (ctx) => await ctx.db.patch("matches", matchId, { lastMessageAt: 0 }));

    await expect(t.mutation(api.chat.send, { token: "c", matchId, body: "hey" })).rejects.toThrow(/no longer exists/);
    await t.mutation(api.chat.send, { token: "a", matchId, body: "   " });
    expect(await count(t, "messages")).toBe(0);

    await t.mutation(api.chat.send, { token: "a", matchId, body: "  hi there  " });
    await t.mutation(api.chat.send, { token: "b", matchId, body: "hello" });

    const match = await t.run(async (ctx) => await ctx.db.get("matches", matchId));
    expect(match!.lastMessageAt).toBeGreaterThan(0);

    expect(await t.query(api.chat.list, { token: "a", matchId })).toMatchObject([
      { body: "hi there", mine: true },
      { body: "hello", mine: false },
    ]);
    expect(await t.query(api.chat.list, { token: "b", matchId })).toMatchObject([
      { body: "hi there", mine: false },
      { body: "hello", mine: true },
    ]);
    expect(await t.query(api.chat.list, { token: "c", matchId })).toEqual([]);
    expect(await t.query(api.matches.get, { token: "c", matchId })).toBeNull();
    expect(await t.query(api.matches.get, { token: "a", matchId })).toMatchObject({
      lastMessage: { body: "hello", mine: false },
    });
  });

  test("blocking deletes the match and its messages", async () => {
    const t = setup();
    const { b, matchId } = await matched(t);
    await t.mutation(api.chat.send, { token: "a", matchId, body: "hi" });
    await t.mutation(api.chat.send, { token: "b", matchId, body: "hey" });

    await t.mutation(api.users.block, { token: "a", userId: b });
    expect(await count(t, "matches")).toBe(0);
    expect(await count(t, "messages")).toBe(0);
    expect(await t.query(api.matches.list, { token: "b" })).toEqual([]);
    await expect(t.mutation(api.chat.send, { token: "b", matchId, body: "?" })).rejects.toThrow(/no longer exists/);
    expect(await t.query(api.nearby.person, { token: "b", userId: (await t.query(api.users.me, { token: "a" }))!._id })).toBeNull();
  });
});

describe("demo", () => {
  async function botId(t: T, name: string) {
    return await t.run(async (ctx) => {
      const bots = await ctx.db.query("users").collect();
      return bots.find((u) => u.name === name)!._id;
    });
  }

  test("start requires a location", async () => {
    const t = setup();
    await makeUser(t, "a", { located: false });
    await expect(t.mutation(api.demo.start, { token: "a" })).rejects.toThrow(/visibility/);
  });

  test("start creates 5 bots near the user and restarting replaces them", async () => {
    vi.useFakeTimers();
    const t = setup();
    const a = await makeUser(t, "a");
    await t.mutation(api.demo.start, { token: "a" });
    const result = await listNearby(t, "a");
    expect(result.people.map((p) => p.name)).toEqual(["Ava", "Leo", "Maya", "Priya", "Sam"]);
    const bots = await t.run(async (ctx) =>
      await ctx.db.query("users").withIndex("by_demoOwnerId", (q) => q.eq("demoOwnerId", a)).collect(),
    );
    expect(bots).toHaveLength(5);

    await t.mutation(api.demo.start, { token: "a" });
    expect(await count(t, "users")).toBe(6);
    expect(await count(t, "locations")).toBe(6);

    await t.mutation(api.users.updateLocation, { token: "a", lat: LAT + 1, lng: LNG + 1 });
    expect((await listNearby(t, "a")).people).toHaveLength(5);
  });

  test("scheduled likeBack pings anonymously, then matches when liked", async () => {
    vi.useFakeTimers();
    const t = setup();
    await makeUser(t, "a");
    await t.mutation(api.demo.start, { token: "a" });
    expect((await t.query(api.likes.secretAdmirers, { token: "a" })).count).toBe(0);

    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect((await t.query(api.likes.secretAdmirers, { token: "a" })).count).toBe(1);
    expect(await t.query(api.matches.unseen, { token: "a" })).toBeNull();

    const maya = await botId(t, "Maya");
    const { matchId } = await t.mutation(api.likes.like, { token: "a", userId: maya });
    expect(matchId).not.toBeNull();
    expect((await t.query(api.likes.secretAdmirers, { token: "a" })).count).toBe(0);
    expect(await t.query(api.matches.unseen, { token: "a" })).toMatchObject({ other: { name: "Maya" } });
  });

  test("bots that like back match after a delay; others never do", async () => {
    vi.useFakeTimers();
    const t = setup();
    await makeUser(t, "a");
    await t.mutation(api.demo.start, { token: "a" });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const leo = await botId(t, "Leo");
    const sam = await botId(t, "Sam");
    expect(await t.mutation(api.likes.like, { token: "a", userId: leo })).toEqual({ matchId: null });
    expect(await t.mutation(api.likes.like, { token: "a", userId: sam })).toEqual({ matchId: null });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const matches = await t.query(api.matches.list, { token: "a" });
    expect(matches.map((m) => m.other.name)).toEqual(["Leo"]);
  });

  test("chatting with a bot schedules a reply", async () => {
    vi.useFakeTimers();
    const t = setup();
    await makeUser(t, "a");
    await t.mutation(api.demo.start, { token: "a" });
    const leo = await botId(t, "Leo");
    await t.mutation(api.likes.like, { token: "a", userId: leo });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const [match] = await t.query(api.matches.list, { token: "a" });

    await t.mutation(api.chat.send, { token: "a", matchId: match._id, body: "hi Leo" });
    expect(await t.query(api.chat.list, { token: "a", matchId: match._id })).toHaveLength(1);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const messages = await t.query(api.chat.list, { token: "a", matchId: match._id });
    expect(messages).toHaveLength(2);
    expect(messages[1]).toMatchObject({ mine: false, body: expect.any(String) });
  });

  test("stop removes bots and their likes, matches and messages", async () => {
    vi.useFakeTimers();
    const t = setup();
    const a = await makeUser(t, "a");
    const b = await makeUser(t, "b");
    await t.mutation(api.likes.like, { token: "b", userId: a });
    await t.mutation(api.demo.start, { token: "a" });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const leo = await botId(t, "Leo");
    const maya = await botId(t, "Maya");
    await t.mutation(api.likes.like, { token: "a", userId: maya });
    await t.mutation(api.likes.like, { token: "a", userId: leo });
    await t.mutation(api.likes.like, { token: "a", userId: await botId(t, "Sam") });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const matches = await t.query(api.matches.list, { token: "a" });
    expect(matches).toHaveLength(2);
    await t.mutation(api.chat.send, { token: "a", matchId: matches[0]._id, body: "hey" });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await count(t, "messages")).toBe(2);

    await t.mutation(api.demo.stop, { token: "a" });
    expect(await count(t, "users")).toBe(2);
    expect(await count(t, "locations")).toBe(2);
    expect(await count(t, "matches")).toBe(0);
    expect(await count(t, "messages")).toBe(0);
    const likes = await t.run(async (ctx) => await ctx.db.query("likes").collect());
    expect(likes).toMatchObject([{ fromId: b, toId: a }]);
    expect(await nearbyNames(t, "a")).toEqual(["b"]);

    await t.mutation(internal.demo.likeBack, { botId: leo, userId: a });
    expect(await count(t, "likes")).toBe(1);
  });
});
