import { v } from "convex/values";
import { query } from "./_generated/server";
import {
  LOCATION_FRESH_MS,
  NEARBY_RADIUS_METERS,
  distanceMeters,
  findMatch,
  isBlockedEitherWay,
  neighborCells,
  publicProfile,
  userByToken,
} from "./lib";

export const list = query({
  args: { token: v.string(), now: v.number() },
  handler: async (ctx, { token, now }) => {
    const me = await userByToken(ctx, token);
    if (!me || me.visibleUntil < now) return { status: "hidden" as const, people: [] };
    const mine = await ctx.db
      .query("locations")
      .withIndex("by_userId", (q) => q.eq("userId", me._id))
      .unique();
    if (!mine || mine.updatedAt < now - LOCATION_FRESH_MS) {
      return { status: "locating" as const, people: [] };
    }

    const people = [];
    for (const cell of neighborCells(mine.lat, mine.lng)) {
      const nearby = await ctx.db
        .query("locations")
        .withIndex("by_cell_and_updatedAt", (q) =>
          q.eq("cell", cell).gt("updatedAt", now - LOCATION_FRESH_MS),
        )
        .take(100);
      for (const loc of nearby) {
        if (loc.userId === me._id) continue;
        if (distanceMeters(mine.lat, mine.lng, loc.lat, loc.lng) > NEARBY_RADIUS_METERS) continue;
        const user = await ctx.db.get("users", loc.userId);
        if (!user || user.visibleUntil < now) continue;
        if (user.demoOwnerId && user.demoOwnerId !== me._id) continue;
        if (await findMatch(ctx, me._id, user._id)) continue;
        if (await isBlockedEitherWay(ctx, me._id, user._id)) continue;
        const liked = await ctx.db
          .query("likes")
          .withIndex("by_fromId_and_toId", (q) => q.eq("fromId", me._id).eq("toId", user._id))
          .unique();
        people.push({ ...(await publicProfile(ctx, user)), liked: liked !== null });
      }
    }
    people.sort((a, b) => a.name.localeCompare(b.name));
    return { status: "ok" as const, people };
  },
});

export const person = query({
  args: { token: v.string(), userId: v.id("users") },
  handler: async (ctx, { token, userId }) => {
    const me = await userByToken(ctx, token);
    if (!me) return null;
    const user = await ctx.db.get("users", userId);
    if (!user || (await isBlockedEitherWay(ctx, me._id, user._id))) return null;
    const liked = await ctx.db
      .query("likes")
      .withIndex("by_fromId_and_toId", (q) => q.eq("fromId", me._id).eq("toId", user._id))
      .unique();
    const match = await findMatch(ctx, me._id, user._id);
    return {
      ...(await publicProfile(ctx, user)),
      liked: liked !== null,
      matchId: match?._id ?? null,
    };
  },
});
