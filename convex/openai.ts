import { env } from "./_generated/server";

export const CHAT_MODEL = "gpt-5.4-mini";
export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMENSIONS = 1536;
const BASE_URL = "https://api.openai.com/v1";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export function openaiKey() {
  return env.OPENAI_API_KEY || null;
}

async function post(key: string, path: string, body: unknown) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`OpenAI ${path} failed with ${res.status}`);
  return (await res.json()) as unknown;
}

export async function complete(key: string, messages: ChatMessage[], json = false) {
  const data = (await post(key, "/chat/completions", {
    model: CHAT_MODEL,
    messages,
    reasoning_effort: "low",
    max_completion_tokens: 2000,
    ...(json ? { response_format: { type: "json_object" } } : {}),
  })) as { choices?: { message?: { content?: string | null } }[] };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("OpenAI returned no content");
  return content;
}

export async function embed(key: string, input: string) {
  const data = (await post(key, "/embeddings", { model: EMBEDDING_MODEL, input })) as {
    data?: { embedding?: number[] }[];
  };
  const embedding = data.data?.[0]?.embedding;
  if (!embedding || embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error("OpenAI returned no embedding");
  }
  return embedding;
}
