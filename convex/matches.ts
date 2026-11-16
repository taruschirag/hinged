import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { publicProfile, requireUser, userByToken } from "./lib";

async function withOther(ctx: QueryCtx, me: Doc<"users">, match: Doc<"matches">) {
  const otherId = match.userA === me._id ? match.userB : match.userA;
  const other = await ctx.db.get("users", otherId);
  if (!other) return null;
  const last = await ctx.db
    .query("messages")
    .withIndex("by_matchId", (q) => q.eq("matchId", match._id))
    .order("desc")
    .first();
  return {
    _id: match._id,
    createdAt: match.createdAt,
    lastMessageAt: match.lastMessageAt,
    lastMessage: last ? { body: last.body, mine: last.senderId === me._id } : null,
    other: await publicProfile(ctx, other),
  };
}

export const list = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const me = await userByToken(ctx, token);
    if (!me) return [];
    const [asA, asB] = await Promise.all([
      ctx.db
        .query("matches")
        .withIndex("by_userA_and_lastMessageAt", (q) => q.eq("userA", me._id))
        .order("desc")
        .take(50),
      ctx.db
        .query("matches")
        .withIndex("by_userB_and_lastMessageAt", (q) => q.eq("userB", me._id))
        .order("desc")
        .take(50),
    ]);
    const all = [...asA, ...asB].sort((a, b) => b.lastMessageAt - a.lastMessageAt);
    const rows = await Promise.all(all.map((m) => withOther(ctx, me, m)));
    return rows.filter((r) => r !== null);
  },
});

export const get = query({
  args: { token: v.string(), matchId: v.id("matches") },
  handler: async (ctx, { token, matchId }) => {
    const me = await userByToken(ctx, token);
    const match = await ctx.db.get("matches", matchId);
    if (!me || !match || (match.userA !== me._id && match.userB !== me._id)) return null;
    return await withOther(ctx, me, match);
  },
});

export const unseen = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const me = await userByToken(ctx, token);
    if (!me) return null;
    const [asA, asB] = await Promise.all([
      ctx.db
        .query("matches")
        .withIndex("by_userA_and_lastMessageAt", (q) => q.eq("userA", me._id))
        .order("desc")
        .take(20),
      ctx.db
        .query("matches")
        .withIndex("by_userB_and_lastMessageAt", (q) => q.eq("userB", me._id))
        .order("desc")
        .take(20),
    ]);
    const match =
      asA.find((m) => !m.seenByA) ?? asB.find((m) => !m.seenByB) ?? null;
    if (!match) return null;
    return await withOther(ctx, me, match);
  },
});

export const markSeen = mutation({
  args: { token: v.string(), matchId: v.id("matches") },
  handler: async (ctx, { token, matchId }) => {
    const me = await requireUser(ctx, token);
    const match = await ctx.db.get("matches", matchId);
    if (!match) return;
    if (match.userA === me._id) await ctx.db.patch("matches", matchId, { seenByA: true });
    if (match.userB === me._id) await ctx.db.patch("matches", matchId, { seenByB: true });
  },
});
