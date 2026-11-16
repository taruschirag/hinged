const saved = new Map<string, string>();

export function saveOpener(userId: string, opener: string) {
  saved.set(userId, opener);
}

export function savedOpener(userId: string) {
  return saved.get(userId) ?? null;
}

export function clearOpener(userId: string) {
  saved.delete(userId);
}
