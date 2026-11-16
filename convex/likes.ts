import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import {
  LIKES_PER_HOUR,
  LOCATION_FRESH_MS,
  NEARBY_RADIUS_METERS,
  createMatch,
  distanceMeters,
  findMatch,
  isBlockedEitherWay,
  requireUser,
  userByToken,
} from "./lib";

export const like = mutation({
  args: { token: v.string(), userId: v.id("users") },
  handler: async (ctx, { token, userId }) => {
    const me = await requireUser(ctx, token);
    const now = Date.now();
    if (me._id === userId) throw new ConvexError("You can't like yourself");
    const target = await ctx.db.get("users", userId);
    if (!target || (await isBlockedEitherWay(ctx, me._id, userId))) {
      throw new ConvexError("This person isn't available");
    }

    const existingMatch = await findMatch(ctx, me._id, userId);
    if (existingMatch) return { matchId: existingMatch._id };
    const already = await ctx.db
      .query("likes")
      .withIndex("by_fromId_and_toId", (q) => q.eq("fromId", me._id).eq("toId", userId))
      .unique();
    if (already) return { matchId: null };

    const [mine, theirs] = await Promise.all(
      [me._id, userId].map((id) =>
        ctx.db
          .query("locations")
          .withIndex("by_userId", (q) => q.eq("userId", id))
          .unique(),
      ),
    );
    const close =
      mine &&
      theirs &&
      theirs.updatedAt > now - LOCATION_FRESH_MS &&
      distanceMeters(mine.lat, mine.lng, theirs.lat, theirs.lng) <= NEARBY_RADIUS_METERS;
    if (!close) throw new ConvexError("You can only like people who are near you right now");

    const recent = await ctx.db
      .query("likes")
      .withIndex("by_fromId_and_createdAt", (q) =>
        q.eq("fromId", me._id).gt("createdAt", now - 60 * 60 * 1000),
      )
      .take(LIKES_PER_HOUR);
    if (recent.length >= LIKES_PER_HOUR) {
      throw new ConvexError(`You've used your ${LIKES_PER_HOUR} likes this hour`);
    }

    await ctx.db.insert("likes", { fromId: me._id, toId: userId, createdAt: now });
    const reverse = await ctx.db
      .query("likes")
      .withIndex("by_fromId_and_toId", (q) => q.eq("fromId", userId).eq("toId", me._id))
      .unique();
    if (reverse) return { matchId: await createMatch(ctx, me._id, userId) };

    if (target.demoOwnerId === me._id && target.demoLikesBack) {
      await ctx.scheduler.runAfter(3000, internal.demo.likeBack, {
        botId: target._id,
        userId: me._id,
      });
    }
    return { matchId: null };
  },
});

export const secretAdmirers = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const me = await userByToken(ctx, token);
    if (!me) return { count: 0, latestAt: 0 };
    const incoming = await ctx.db
      .query("likes")
      .withIndex("by_toId_and_createdAt", (q) => q.eq("toId", me._id))
      .order("desc")
      .take(100);
    let count = 0;
    let latestAt = 0;
    for (const like of incoming) {
      if (await findMatch(ctx, me._id, like.fromId)) continue;
      if (await isBlockedEitherWay(ctx, me._id, like.fromId)) continue;
      count++;
      latestAt = Math.max(latestAt, like.createdAt);
    }
    return { count, latestAt };
  },
});
