type WindowEntry = { startedAt: number; count: number }

export function contentLengthExceeds(request: Request, maximumBytes: number): boolean {
  const raw = request.headers.get("content-length")
  if (!raw) return false
  const value = Number(raw)
  return Number.isFinite(value) && value > maximumBytes
}

export function requestClientKey(request: Request): string {
  const direct = request.headers.get("cf-connecting-ip")?.trim()
    || request.headers.get("x-real-ip")?.trim()
  if (direct) return direct.slice(0, 128)
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  return (forwarded || "unknown").slice(0, 128)
}

export function createWindowRateLimiter(input: {
  limit: number
  windowMs: number
  maxEntries?: number
}) {
  const entries = new Map<string, WindowEntry>()
  const maxEntries = input.maxEntries ?? 5000

  return (key: string, now = Date.now()): { allowed: boolean; retryAfterSeconds: number } => {
    if (entries.size > maxEntries) {
      for (const [entryKey, entry] of entries) {
        if (now - entry.startedAt >= input.windowMs) entries.delete(entryKey)
        if (entries.size <= maxEntries) break
      }
    }

    const current = entries.get(key)
    if (!current || now - current.startedAt >= input.windowMs) {
      entries.set(key, { startedAt: now, count: 1 })
      return { allowed: true, retryAfterSeconds: 0 }
    }
    if (current.count >= input.limit) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((input.windowMs - (now - current.startedAt)) / 1000)),
      }
    }
    current.count += 1
    return { allowed: true, retryAfterSeconds: 0 }
  }
}
