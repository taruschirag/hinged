import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  DEMO_OFFSETS,
  VISIBILITY_MS,
  findMatch,
  photoFor,
  requireUser,
  upsertLocation,
  userByToken,
} from "./lib";
import { triggerWingmanChats } from "./wingman";

export const me = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const user = await userByToken(ctx, token);
    if (!user) return null;
    return {
      _id: user._id,
      name: user.name,
      age: user.age,
      bio: user.bio,
      photo: await photoFor(ctx, user),
      visibleUntil: user.visibleUntil,
    };
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => await ctx.storage.generateUploadUrl(),
});

export const saveProfile = mutation({
  args: {
    token: v.string(),
    name: v.string(),
    age: v.number(),
    bio: v.string(),
    photoId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const name = args.name.trim().slice(0, 30);
    const bio = args.bio.trim().slice(0, 160);
    if (!name) throw new ConvexError("Add your first name");
    if (!Number.isInteger(args.age) || args.age < 18 || args.age > 99) {
      throw new ConvexError("You must be 18 or older");
    }
    const existing = await userByToken(ctx, args.token);
    if (existing) {
      if (args.photoId && existing.photoId && existing.photoId !== args.photoId) {
        await ctx.storage.delete(existing.photoId);
      }
      await ctx.db.patch("users", existing._id, {
        name,
        age: args.age,
        bio,
        ...(args.photoId ? { photoId: args.photoId } : {}),
      });
      return existing._id;
    }
    if (!args.photoId) throw new ConvexError("Add a photo so people can recognise you");
    return await ctx.db.insert("users", {
      token: args.token,
      name,
      age: args.age,
      bio,
      photoId: args.photoId,
      photoUrl: null,
      visibleUntil: 0,
      demoOwnerId: null,
      demoLikesBack: false,
    });
  },
});

export const setVisible = mutation({
  args: { token: v.string(), visible: v.boolean() },
  handler: async (ctx, { token, visible }) => {
    const user = await requireUser(ctx, token);
    const visibleUntil = visible ? Date.now() + VISIBILITY_MS : 0;
    await ctx.db.patch("users", user._id, { visibleUntil });
    return visibleUntil;
  },
});

export const updateLocation = mutation({
  args: { token: v.string(), lat: v.number(), lng: v.number() },
  handler: async (ctx, { token, lat, lng }) => {
    const user = await requireUser(ctx, token);
    const now = Date.now();
    await upsertLocation(ctx, user._id, lat, lng, now);
    const bots = await ctx.db
      .query("users")
      .withIndex("by_demoOwnerId", (q) => q.eq("demoOwnerId", user._id))
      .take(DEMO_OFFSETS.length);
    for (const [i, bot] of bots.entries()) {
      const [dLat, dLng] = DEMO_OFFSETS[i];
      await upsertLocation(ctx, bot._id, lat + dLat, lng + dLng, now);
    }
    await triggerWingmanChats(ctx, user, now);
  },
});

export const block = mutation({
  args: { token: v.string(), userId: v.id("users") },
  handler: async (ctx, { token, userId }) => {
    const me = await requireUser(ctx, token);
    if (me._id === userId) return;
    const existing = await ctx.db
      .query("blocks")
      .withIndex("by_blockerId_and_blockedId", (q) =>
        q.eq("blockerId", me._id).eq("blockedId", userId),
      )
      .unique();
    if (!existing) await ctx.db.insert("blocks", { blockerId: me._id, blockedId: userId });
    const match = await findMatch(ctx, me._id, userId);
    if (!match) return;
    for await (const message of ctx.db
      .query("messages")
      .withIndex("by_matchId", (q) => q.eq("matchId", match._id))) {
      await ctx.db.delete("messages", message._id);
    }
    await ctx.db.delete("matches", match._id);
  },
});
