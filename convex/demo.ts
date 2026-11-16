import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalMutation, mutation, type MutationCtx } from "./_generated/server";
import { DEMO_OFFSETS, createMatch, requireUser, upsertLocation } from "./lib";
import { deleteWingmanData, startChat } from "./wingman";

const BOTS = [
  { name: "Maya", age: 26, bio: "Reading the same book as you, apparently.", photo: "https://randomuser.me/api/portraits/women/44.jpg", likesBack: true, likesFirst: true, persona: "A bookworm with a soft spot for slow mornings and bad puns.", shareable: "They read two novels at once, love long walks to new bakeries, and collect recommendations for sci-fi with heart. Their humor is dry and a little nerdy. They hope to meet someone curious who will argue about plot twists over coffee." },
  { name: "Leo", age: 28, bio: "Headphones on, but I'll take them off for you.", photo: "https://randomuser.me/api/portraits/men/32.jpg", likesBack: true, likesFirst: false, persona: "A music nerd who hides a sentimental streak behind headphones.", shareable: "They are always hunting for a new album to obsess over and love tiny live gigs. They cook big pasta dinners for friends on Sundays and laugh at absurd, deadpan jokes. They hope for someone who will swap playlists and actually listen." },
  { name: "Priya", age: 25, bio: "Coffee in hand, window seat always.", photo: "https://randomuser.me/api/portraits/women/68.jpg", likesBack: true, likesFirst: false, persona: "A coffee snob and window-seat daydreamer.", shareable: "They sketch people-watching scenes in a notebook, are learning to make the perfect pour-over, and love rainy-day museums. They laugh easily, especially at witty banter. They hope to meet someone thoughtful who likes noticing small details." },
  { name: "Sam", age: 30, bio: "Ask me about the dog on my phone wallpaper.", photo: "https://randomuser.me/api/portraits/men/75.jpg", likesBack: false, likesFirst: false, persona: "A dog person through and through, outdoorsy and easygoing.", shareable: "They spend weekends hiking with their scruffy rescue dog and love trying street food. Their humor is goofy and self-deprecating. They hope for someone up for spontaneous adventures and muddy boots." },
  { name: "Ava", age: 27, bio: "Commuting to a job I actually like.", photo: "https://randomuser.me/api/portraits/women/21.jpg", likesBack: false, likesFirst: false, persona: "A cheerful planner who genuinely enjoys their work and their weekends.", shareable: "They are into climbing, board game nights and trying every brunch spot. Their humor is quick and playful. They hope to meet someone kind and ambitious who does not take themselves too seriously." },
];

const REPLIES = [
  "Haha hi! I saw you look over earlier 👀",
  "Okay this is way less awkward than I expected",
  "Want to grab a coffee at the next stop?",
  "I'm the one by the window btw",
  "😄",
];

async function removeBots(ctx: MutationCtx, ownerId: Id<"users">) {
  const bots = await ctx.db
    .query("users")
    .withIndex("by_demoOwnerId", (q) => q.eq("demoOwnerId", ownerId))
    .take(20);
  for (const bot of bots) {
    for (const index of ["by_fromId_and_createdAt", "by_toId_and_createdAt"] as const) {
      const field = index === "by_fromId_and_createdAt" ? "fromId" : "toId";
      for await (const like of ctx.db
        .query("likes")
        .withIndex(index, (q) => q.eq(field, bot._id))) {
        await ctx.db.delete("likes", like._id);
      }
    }
    for (const index of ["by_userA_and_lastMessageAt", "by_userB_and_lastMessageAt"] as const) {
      const field = index === "by_userA_and_lastMessageAt" ? "userA" : "userB";
      for await (const match of ctx.db
        .query("matches")
        .withIndex(index, (q) => q.eq(field, bot._id))) {
        for await (const message of ctx.db
          .query("messages")
          .withIndex("by_matchId", (q) => q.eq("matchId", match._id))) {
          await ctx.db.delete("messages", message._id);
        }
        await ctx.db.delete("matches", match._id);
      }
    }
    const loc = await ctx.db
      .query("locations")
      .withIndex("by_userId", (q) => q.eq("userId", bot._id))
      .unique();
    if (loc) await ctx.db.delete("locations", loc._id);
    await deleteWingmanData(ctx, bot._id);
    await ctx.db.delete("users", bot._id);
  }
}

export const start = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const me = await requireUser(ctx, token);
    const loc = await ctx.db
      .query("locations")
      .withIndex("by_userId", (q) => q.eq("userId", me._id))
      .unique();
    if (!loc) throw new ConvexError("Turn on visibility first so we know where you are");
    await removeBots(ctx, me._id);
    const now = Date.now();
    const myWingman = await ctx.db
      .query("wingmen")
      .withIndex("by_userId", (q) => q.eq("userId", me._id))
      .unique();
    for (const [i, bot] of BOTS.entries()) {
      const botId = await ctx.db.insert("users", {
        token: crypto.randomUUID(),
        name: bot.name,
        age: bot.age,
        bio: bot.bio,
        photoId: null,
        photoUrl: bot.photo,
        visibleUntil: now + 24 * 60 * 60 * 1000,
        demoOwnerId: me._id,
        demoLikesBack: bot.likesBack,
      });
      const [dLat, dLng] = DEMO_OFFSETS[i];
      await upsertLocation(ctx, botId, loc.lat + dLat, loc.lng + dLng, now);
      if (bot.likesFirst) {
        await ctx.scheduler.runAfter(6000, internal.demo.likeBack, { botId, userId: me._id });
      }
      await ctx.db.insert("wingmen", {
        userId: botId,
        answers: [],
        persona: bot.persona,
        shareable: bot.shareable,
        updatedAt: now,
      });
      if (myWingman?.shareable) await startChat(ctx, me._id, botId, 1500 + i * 4000, now);
    }
  },
});

export const stop = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const me = await requireUser(ctx, token);
    await removeBots(ctx, me._id);
  },
});

export const likeBack = internalMutation({
  args: { botId: v.id("users"), userId: v.id("users") },
  handler: async (ctx, { botId, userId }) => {
    const bot = await ctx.db.get("users", botId);
    if (!bot) return;
    const existing = await ctx.db
      .query("likes")
      .withIndex("by_fromId_and_toId", (q) => q.eq("fromId", botId).eq("toId", userId))
      .unique();
    if (!existing) await ctx.db.insert("likes", { fromId: botId, toId: userId, createdAt: Date.now() });
    const reverse = await ctx.db
      .query("likes")
      .withIndex("by_fromId_and_toId", (q) => q.eq("fromId", userId).eq("toId", botId))
      .unique();
    if (reverse) await createMatch(ctx, userId, botId);
  },
});

export const reply = internalMutation({
  args: { matchId: v.id("matches"), botId: v.id("users") },
  handler: async (ctx, { matchId, botId }) => {
    const match = await ctx.db.get("matches", matchId);
    if (!match) return;
    const sent = await ctx.db
      .query("messages")
      .withIndex("by_matchId", (q) => q.eq("matchId", matchId))
      .take(200);
    const botCount = sent.filter((m) => m.senderId === botId).length;
    await ctx.db.insert("messages", {
      matchId,
      senderId: botId,
      body: REPLIES[botCount % REPLIES.length],
    });
    await ctx.db.patch("matches", matchId, { lastMessageAt: Date.now() });
  },
});
