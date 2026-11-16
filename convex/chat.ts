import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import { requireUser, userByToken } from "./lib";

export const list = query({
  args: { token: v.string(), matchId: v.id("matches") },
  handler: async (ctx, { token, matchId }) => {
    const me = await userByToken(ctx, token);
    const match = await ctx.db.get("matches", matchId);
    if (!me || !match || (match.userA !== me._id && match.userB !== me._id)) return [];
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_matchId", (q) => q.eq("matchId", matchId))
      .order("desc")
      .take(200);
    return messages.reverse().map((m) => ({
      _id: m._id,
      body: m.body,
      at: m._creationTime,
      mine: m.senderId === me._id,
    }));
  },
});

export const send = mutation({
  args: { token: v.string(), matchId: v.id("matches"), body: v.string() },
  handler: async (ctx, { token, matchId, body }) => {
    const me = await requireUser(ctx, token);
    const match = await ctx.db.get("matches", matchId);
    if (!match || (match.userA !== me._id && match.userB !== me._id)) {
      throw new ConvexError("This match no longer exists");
    }
    const text = body.trim().slice(0, 500);
    if (!text) return;
    await ctx.db.insert("messages", { matchId, senderId: me._id, body: text });
    await ctx.db.patch("matches", matchId, { lastMessageAt: Date.now() });

    const otherId = match.userA === me._id ? match.userB : match.userA;
    const other = await ctx.db.get("users", otherId);
    if (other?.demoOwnerId === me._id) {
      await ctx.scheduler.runAfter(2000, internal.demo.reply, { matchId, botId: other._id });
    }
  },
});
