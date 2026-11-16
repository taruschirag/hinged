import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    token: v.string(),
    name: v.string(),
    age: v.number(),
    bio: v.string(),
    photoId: v.union(v.id("_storage"), v.null()),
    photoUrl: v.union(v.string(), v.null()),
    visibleUntil: v.number(),
    demoOwnerId: v.union(v.id("users"), v.null()),
    demoLikesBack: v.boolean(),
  })
    .index("by_token", ["token"])
    .index("by_demoOwnerId", ["demoOwnerId"]),

  locations: defineTable({
    userId: v.id("users"),
    lat: v.number(),
    lng: v.number(),
    cell: v.string(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_cell_and_updatedAt", ["cell", "updatedAt"]),

  likes: defineTable({
    fromId: v.id("users"),
    toId: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_fromId_and_toId", ["fromId", "toId"])
    .index("by_fromId_and_createdAt", ["fromId", "createdAt"])
    .index("by_toId_and_createdAt", ["toId", "createdAt"]),

  matches: defineTable({
    userA: v.id("users"),
    userB: v.id("users"),
    createdAt: v.number(),
    lastMessageAt: v.number(),
    seenByA: v.boolean(),
    seenByB: v.boolean(),
  })
    .index("by_userA_and_lastMessageAt", ["userA", "lastMessageAt"])
    .index("by_userB_and_lastMessageAt", ["userB", "lastMessageAt"])
    .index("by_userA_and_userB", ["userA", "userB"]),

  messages: defineTable({
    matchId: v.id("matches"),
    senderId: v.id("users"),
    body: v.string(),
  }).index("by_matchId", ["matchId"]),

  blocks: defineTable({
    blockerId: v.id("users"),
    blockedId: v.id("users"),
  })
    .index("by_blockerId_and_blockedId", ["blockerId", "blockedId"])
    .index("by_blockedId", ["blockedId"]),
});
