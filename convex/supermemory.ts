import { env } from "./_generated/server";

const BASE_URL = "https://api.supermemory.ai";
export const SUPERMEMORY_TIMEOUT_MS = 3000;

export function supermemoryKey() {
  return env.SUPERMEMORY_API_KEY || null;
}

export function containerTag(userId: string) {
  return `hinged-user-${userId}`;
}

async function post(path: string, body: unknown): Promise<unknown> {
  const key = supermemoryKey();
  if (!key) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SUPERMEMORY_TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    return (await res.json()) as unknown;
  } catch (error) {
    console.warn(`Supermemory ${path} failed: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function addMemory(
  userId: string,
  content: string,
  opts: { customId?: string; metadata?: Record<string, string> } = {},
) {
  const data = await post("/v3/documents", { content, containerTag: containerTag(userId), ...opts });
  return data !== null;
}

export async function searchMemories(userId: string, q: string, limit = 3) {
  if (!q.trim()) return [];
  const data = (await post("/v4/search", { q: q.slice(0, 1000), containerTag: containerTag(userId), limit })) as {
    results?: { memory?: string; chunk?: string }[];
  } | null;
  return (data?.results ?? [])
    .map((r) => (r.memory ?? r.chunk ?? "").trim())
    .filter((text) => text !== "")
    .slice(0, limit);
}

export async function countMemories(userId: string) {
  const data = (await post("/v4/memories/list", { containerTags: [containerTag(userId)], limit: 1 })) as {
    pagination?: { totalItems?: number };
  } | null;
  const total = data?.pagination?.totalItems;
  return typeof total === "number" ? total : null;
}
