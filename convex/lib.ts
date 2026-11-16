import { ConvexError } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

export const NEARBY_RADIUS_METERS = 150;
export const LOCATION_FRESH_MS = 2 * 60 * 1000;
export const VISIBILITY_MS = 60 * 60 * 1000;
export const LIKES_PER_HOUR = 10;
const CELL_DEGREES = 0.002;

export const DEMO_OFFSETS: Array<[number, number]> = [
  [0.0002, 0.0001],
  [-0.0001, 0.0003],
  [0.0003, -0.0002],
  [-0.0003, -0.0001],
  [0.0001, -0.0004],
];

export async function userByToken(ctx: QueryCtx, token: string) {
  return await ctx.db
    .query("users")
    .withIndex("by_token", (q) => q.eq("token", token))
    .unique();
}

export async function requireUser(ctx: QueryCtx, token: string) {
  const user = await userByToken(ctx, token);
  if (!user) throw new ConvexError("Not signed up");
  return user;
}

export function cellKey(lat: number, lng: number) {
  return `${Math.floor(lat / CELL_DEGREES)}:${Math.floor(lng / CELL_DEGREES)}`;
}

export function neighborCells(lat: number, lng: number) {
  const row = Math.floor(lat / CELL_DEGREES);
  const col = Math.floor(lng / CELL_DEGREES);
  const cells: string[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) cells.push(`${row + dr}:${col + dc}`);
  }
  return cells;
}

export function distanceMeters(aLat: number, aLng: number, bLat: number, bLng: number) {
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad;
  const dLng = (bLng - aLng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

export function orderedPair(a: Id<"users">, b: Id<"users">): [Id<"users">, Id<"users">] {
  return a < b ? [a, b] : [b, a];
}

export async function findMatch(ctx: QueryCtx, a: Id<"users">, b: Id<"users">) {
  const [userA, userB] = orderedPair(a, b);
  return await ctx.db
    .query("matches")
    .withIndex("by_userA_and_userB", (q) => q.eq("userA", userA).eq("userB", userB))
    .unique();
}

export async function isBlockedEitherWay(ctx: QueryCtx, a: Id<"users">, b: Id<"users">) {
  const ab = await ctx.db
    .query("blocks")
    .withIndex("by_blockerId_and_blockedId", (q) => q.eq("blockerId", a).eq("blockedId", b))
    .unique();
  if (ab) return true;
  const ba = await ctx.db
    .query("blocks")
    .withIndex("by_blockerId_and_blockedId", (q) => q.eq("blockerId", b).eq("blockedId", a))
    .unique();
  return ba !== null;
}

export async function photoFor(ctx: QueryCtx, user: Doc<"users">) {
  if (user.photoId) return await ctx.storage.getUrl(user.photoId);
  return user.photoUrl;
}

export async function publicProfile(ctx: QueryCtx, user: Doc<"users">) {
  return {
    _id: user._id,
    name: user.name,
    age: user.age,
    bio: user.bio,
    photo: await photoFor(ctx, user),
  };
}

export async function upsertLocation(
  ctx: MutationCtx,
  userId: Id<"users">,
  lat: number,
  lng: number,
  now: number,
) {
  const existing = await ctx.db
    .query("locations")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
  const fields = { lat, lng, cell: cellKey(lat, lng), updatedAt: now };
  if (existing) await ctx.db.patch("locations", existing._id, fields);
  else await ctx.db.insert("locations", { userId, ...fields });
}

export async function createMatch(ctx: MutationCtx, a: Id<"users">, b: Id<"users">) {
  const existing = await findMatch(ctx, a, b);
  if (existing) return existing._id;
  const [userA, userB] = orderedPair(a, b);
  const now = Date.now();
  return await ctx.db.insert("matches", {
    userA,
    userB,
    createdAt: now,
    lastMessageAt: now,
    seenByA: false,
    seenByB: false,
  });
}
