type WindowEntry = { startedAt: number; count: number }

export class RequestBodyTooLargeError extends Error {
  constructor(readonly maximumBytes: number) {
    super(`Request body exceeds ${maximumBytes} bytes`)
    this.name = "RequestBodyTooLargeError"
  }
}

export function contentLengthExceeds(request: Request, maximumBytes: number): boolean {
  const raw = request.headers.get("content-length")
  if (!raw) return false
  const value = Number(raw)
  return Number.isFinite(value) && value > maximumBytes
}

export async function readJsonBodyWithLimit<T = unknown>(
  request: Request,
  maximumBytes: number
): Promise<T> {
  if (contentLengthExceeds(request, maximumBytes)) {
    throw new RequestBodyTooLargeError(maximumBytes)
  }
  const reader = request.body?.getReader()
  if (!reader) throw new SyntaxError("Request body is empty")

  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      if (!value) continue
      total += value.byteLength
      if (total > maximumBytes) {
        await reader.cancel().catch(() => {})
        throw new RequestBodyTooLargeError(maximumBytes)
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }

  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return JSON.parse(new TextDecoder().decode(bytes)) as T
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
  const maxEntries = Math.max(1, input.maxEntries ?? 5000)

  return (key: string, now = Date.now()): { allowed: boolean; retryAfterSeconds: number } => {
    for (const [entryKey, entry] of entries) {
      if (now - entry.startedAt >= input.windowMs) entries.delete(entryKey)
    }

    const current = entries.get(key)
    if (!current) {
      while (entries.size >= maxEntries) {
        const oldest = entries.keys().next().value as string | undefined
        if (!oldest) break
        entries.delete(oldest)
      }
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
