from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 match, found {count}")
    return text.replace(old, new, 1)


# ---- Bounded request-body parsing and a truly bounded in-memory limiter ----
Path("lib/request-guard.ts").write_text(r'''type WindowEntry = { startedAt: number; count: number }

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
''')

# Public utility routes must enforce the limit even when Content-Length is absent.
path = Path("app/api/tts/route.ts")
tts = path.read_text()
tts = replace_once(
    tts,
    'import { contentLengthExceeds, createWindowRateLimiter, requestClientKey } from "@/lib/request-guard"',
    'import { createWindowRateLimiter, readJsonBodyWithLimit, RequestBodyTooLargeError, requestClientKey } from "@/lib/request-guard"',
    "tts body reader import",
)
tts = replace_once(
    tts,
    '''export async function POST(request: Request) {\n  if (contentLengthExceeds(request, MAX_BODY_BYTES)) {\n    return Response.json({ error: "Request body is too large" }, { status: 413 })\n  }\n  const rate = allowRequest(requestClientKey(request))''',
    '''export async function POST(request: Request) {\n  const rate = allowRequest(requestClientKey(request))''',
    "tts content-length precheck",
)
tts = replace_once(
    tts,
    '''  let body: { text?: unknown; lang?: unknown; slow?: unknown }\n  try {\n    body = (await request.json()) as { text?: unknown; lang?: unknown; slow?: unknown }\n  } catch {\n    return Response.json({ error: "Invalid request" }, { status: 400 })\n  }''',
    '''  let body: { text?: unknown; lang?: unknown; slow?: unknown }\n  try {\n    body = await readJsonBodyWithLimit<{ text?: unknown; lang?: unknown; slow?: unknown }>(\n      request,\n      MAX_BODY_BYTES\n    )\n  } catch (error) {\n    return Response.json(\n      { error: error instanceof RequestBodyTooLargeError ? "Request body is too large" : "Invalid request" },\n      { status: error instanceof RequestBodyTooLargeError ? 413 : 400 }\n    )\n  }''',
    "tts bounded json",
)
path.write_text(tts)

path = Path("app/api/gemini-live/token/route.ts")
gemini = path.read_text()
gemini = replace_once(
    gemini,
    'import { contentLengthExceeds, createWindowRateLimiter, requestClientKey } from "@/lib/request-guard"',
    'import { createWindowRateLimiter, readJsonBodyWithLimit, RequestBodyTooLargeError, requestClientKey } from "@/lib/request-guard"',
    "gemini body reader import",
)
gemini = replace_once(
    gemini,
    '''export async function POST(request: Request) {\n  if (contentLengthExceeds(request, MAX_BODY_BYTES)) {\n    return Response.json({ error: "Request body is too large" }, { status: 413 })\n  }\n  const rate = allowRequest(requestClientKey(request))''',
    '''export async function POST(request: Request) {\n  const rate = allowRequest(requestClientKey(request))''',
    "gemini content-length precheck",
)
gemini = replace_once(
    gemini,
    '''  let body: { apiKey?: unknown }\n  try {\n    body = (await request.json()) as { apiKey?: unknown }\n  } catch {\n    return Response.json({ error: "Invalid request" }, { status: 400 })\n  }''',
    '''  let body: { apiKey?: unknown }\n  try {\n    body = await readJsonBodyWithLimit<{ apiKey?: unknown }>(request, MAX_BODY_BYTES)\n  } catch (error) {\n    return Response.json(\n      { error: error instanceof RequestBodyTooLargeError ? "Request body is too large" : "Invalid request" },\n      { status: error instanceof RequestBodyTooLargeError ? 413 : 400 }\n    )\n  }''',
    "gemini bounded json",
)
path.write_text(gemini)

# Bound authenticated sync writes before parsing a user-controlled deck payload.
path = Path("app/api/sync/decks/[id]/route.ts")
sync_route = path.read_text()
sync_route = replace_once(
    sync_route,
    'import { isDeckId } from "@/lib/studio-store"',
    'import { isDeckId } from "@/lib/studio-store"\nimport { readJsonBodyWithLimit, RequestBodyTooLargeError } from "@/lib/request-guard"',
    "sync body reader import",
)
sync_route = replace_once(
    sync_route,
    'export const dynamic = "force-dynamic"\n',
    'export const dynamic = "force-dynamic"\n\nconst MAX_SYNC_REQUEST_BYTES = 10 * 1024 * 1024\n',
    "sync body size",
)
sync_route = replace_once(
    sync_route,
    '''  let body: unknown\n  try {\n    body = await request.json()\n  } catch {\n    return jsonError("Invalid JSON request", 400)\n  }''',
    '''  let body: unknown\n  try {\n    body = await readJsonBodyWithLimit(request, MAX_SYNC_REQUEST_BYTES)\n  } catch (error) {\n    return jsonError(\n      error instanceof RequestBodyTooLargeError ? "Sync request is too large" : "Invalid JSON request",\n      error instanceof RequestBodyTooLargeError ? 413 : 400\n    )\n  }''',
    "sync bounded json",
)
path.write_text(sync_route)

# ---- Bound CSV/JSON preview imports before file.arrayBuffer() ----
path = Path("lib/import-preview.ts")
preview = path.read_text()
preview = replace_once(
    preview,
    'export type ImportKind = "csv" | "json"\n',
    'export type ImportKind = "csv" | "json"\nexport const MAX_TEXT_PREVIEW_BYTES = 20 * 1024 * 1024\n\nexport function textImportSizeError(size: number): string | null {\n  return size > MAX_TEXT_PREVIEW_BYTES ? "Import file is too large (20 MB limit)" : null\n}\n',
    "text import budget helper",
)
preview = replace_once(
    preview,
    '''  if (!lower.endsWith(".json") && !lower.endsWith(".csv")) {\n    throw new Error("只支持校验 .json 或 .csv")\n  }\n\n  const bytes = new Uint8Array(await file.arrayBuffer())''',
    '''  if (!lower.endsWith(".json") && !lower.endsWith(".csv")) {\n    throw new Error("只支持校验 .json 或 .csv")\n  }\n  const sizeError = textImportSizeError(file.size)\n  if (sizeError) return emptyPreview(kind, file.name, sizeError)\n\n  const bytes = new Uint8Array(await file.arrayBuffer())''',
    "text import size check",
)
path.write_text(preview)

# ---- Bound Google network calls so sync/auth cannot spin indefinitely ----
path = Path("lib/google-sheets-sync.ts")
sheets = path.read_text()
sheets = replace_once(
    sheets,
    'export const MAX_SYNC_PAYLOAD_BYTES = 8 * 1024 * 1024\n',
    'export const MAX_SYNC_PAYLOAD_BYTES = 8 * 1024 * 1024\nexport const SHEETS_REQUEST_TIMEOUT_MS = 30_000\n',
    "sheets timeout constant",
)
sheets = replace_once(
    sheets,
    '''          cache: "no-store",\n        }\n      )''',
    '''          cache: "no-store",\n          signal: AbortSignal.timeout(SHEETS_REQUEST_TIMEOUT_MS),\n        }\n      )''',
    "sheets request timeout",
)
sheets = replace_once(
    sheets,
    '''    body: JSON.stringify({\n      properties: {\n        title: title.trim() || "Anki Studio · Flashcard Sync",\n      },\n    }),\n  })''',
    '''    body: JSON.stringify({\n      properties: {\n        title: title.trim() || "Anki Studio · Flashcard Sync",\n      },\n    }),\n    signal: AbortSignal.timeout(SHEETS_REQUEST_TIMEOUT_MS),\n  })''',
    "create spreadsheet timeout",
)
path.write_text(sheets)

path = Path("lib/google-auth.ts")
auth = path.read_text()
auth = replace_once(
    auth,
    'const ACCESS_TOKEN_REFRESH_MARGIN_MS = 60_000\n',
    'const ACCESS_TOKEN_REFRESH_MARGIN_MS = 60_000\nconst GOOGLE_TOKEN_TIMEOUT_MS = 15_000\n',
    "google token timeout constant",
)
auth = replace_once(
    auth,
    '''      cache: "no-store",\n    })''',
    '''      cache: "no-store",\n      signal: AbortSignal.timeout(GOOGLE_TOKEN_TIMEOUT_MS),\n    })''',
    "google token timeout",
)
path.write_text(auth)

path = Path("app/api/google-sheets/list/route.ts")
drive = path.read_text()
drive = replace_once(
    drive,
    '''      cache: "no-store",\n    })''',
    '''      cache: "no-store",\n      signal: AbortSignal.timeout(15_000),\n    })''',
    "drive list timeout",
)
path.write_text(drive)

# ---- Correct backup copy: JSON is a complete backup of the active deck, not the whole library ----
path = Path("components/deck-tools-panel.tsx")
panel = path.read_text()
panel = replace_once(
    panel,
    'JSON · full project backup',
    'JSON · current deck backup',
    "json export label",
)
path.write_text(panel)

path = Path("README.md")
readme = path.read_text()
readme = readme.replace("JSON project backups", "JSON active-deck backups")
readme = readme.replace("| JSON project backup | Included | Included | Included |", "| JSON active-deck backup | Included | Included | Included for the active deck |")
path.write_text(readme)

# ---- Default no-store policy for API responses carrying auth/sync/token data ----
path = Path("next.config.ts")
config = path.read_text()
config = replace_once(
    config,
    '''      {\n        source: "/sw.js",''',
    '''      {\n        source: "/api/:path*",\n        headers: [\n          { key: "Cache-Control", value: "no-store, max-age=0" },\n        ],\n      },\n      {\n        source: "/sw.js",''',
    "api no-store header",
)
path.write_text(config)

# ---- Regression coverage ----
path = Path("tests/unit/lib/request-guard.test.ts")
test = path.read_text()
test = test.replace(
    'import { contentLengthExceeds, createWindowRateLimiter, requestClientKey } from "@/lib/request-guard"',
    'import { contentLengthExceeds, createWindowRateLimiter, readJsonBodyWithLimit, RequestBodyTooLargeError, requestClientKey } from "@/lib/request-guard"'
)
test += r'''

  it("rejects a streamed body that exceeds the limit without Content-Length", async () => {
    const request = new Request("https://example.com", {
      method: "POST",
      body: JSON.stringify({ value: "x".repeat(128) }),
    })
    await expect(readJsonBodyWithLimit(request, 32)).rejects.toBeInstanceOf(RequestBodyTooLargeError)
  })

  it("keeps the limiter map bounded even when every entry is still active", () => {
    const allow = createWindowRateLimiter({ limit: 1, windowMs: 60_000, maxEntries: 2 })
    expect(allow("a", 0).allowed).toBe(true)
    expect(allow("b", 0).allowed).toBe(true)
    expect(allow("c", 0).allowed).toBe(true)
    // a was evicted to keep the map bounded, so it starts a fresh window.
    expect(allow("a", 1).allowed).toBe(true)
  })
'''
path.write_text(test)

path = Path("tests/unit/lib/import-preview.test.ts")
test = path.read_text()
test = test.replace(
    '  inspectImportText,\n} from "@/lib/import-preview"',
    '  inspectImportText,\n  MAX_TEXT_PREVIEW_BYTES,\n  textImportSizeError,\n} from "@/lib/import-preview"'
)
test += r'''

describe("text import size budget", () => {
  it("rejects oversized CSV/JSON previews before reading the file", () => {
    expect(textImportSizeError(MAX_TEXT_PREVIEW_BYTES)).toBeNull()
    expect(textImportSizeError(MAX_TEXT_PREVIEW_BYTES + 1)).toContain("too large")
  })
})
'''
path.write_text(test)

# Explicitly lock the migration durability behavior that cycle 1 introduced.
path = Path("tests/unit/lib/library.test.ts")
test = path.read_text()
anchor = '''  it("creates a default deck when nothing is stored", async () => {'''
extra = r'''  it("keeps legacy data until a failed migration can be retried", async () => {
    const legacy = createDefaultDeck()
    legacy.name = "Recover me"
    const id = "legacy-retry-deck"
    memory.set(LIBRARY_KEY, JSON.stringify({
      version: 1,
      activeId: id,
      decks: [{ id, name: legacy.name, cardCount: 1, updatedAt: 10 }],
    }))
    memory.set(`anki-studio.deck.${id}`, serializeDeck(legacy))

    const base = createMemoryStore()
    let failMeta = true
    setStudioStore({
      ...base,
      async setMeta(meta) {
        if (failMeta) {
          failMeta = false
          throw new Error("simulated durable-write failure")
        }
        await base.setMeta(meta)
      },
    })

    await expect(loadLibrarySession()).rejects.toThrow("simulated durable-write failure")
    expect(memory.get(LIBRARY_KEY)).toBeTruthy()
    expect(memory.get(`anki-studio.deck.${id}`)).toBeTruthy()

    setStudioStore(base)
    const retried = await loadLibrarySession()
    expect(retried.deck.name).toBe("Recover me")
    expect(memory.get(LIBRARY_KEY)).toBeUndefined()
    expect(memory.get(`anki-studio.deck.${id}`)).toBeUndefined()
  })

'''
if anchor not in test:
    raise SystemExit("library migration test anchor not found")
test = test.replace(anchor, extra + anchor, 1)
path.write_text(test)

# Timeout/no-store/bounded parsing contracts across server surfaces.
Path("tests/contracts/production-network.test.ts").write_text(r'''import { describe, expect, it } from "vitest"
import { readSource } from "./helpers/source"

const sheets = readSource("lib", "google-sheets-sync.ts")
const auth = readSource("lib", "google-auth.ts")
const syncRoute = readSource("app", "api", "sync", "decks", "[id]", "route.ts")
const ttsRoute = readSource("app", "api", "tts", "route.ts")
const geminiRoute = readSource("app", "api", "gemini-live", "token", "route.ts")
const nextConfig = readSource("next.config.ts")
const deckTools = readSource("components", "deck-tools-panel.tsx")

 describe("production network and data boundaries", () => {
  it("bounds external Google calls", () => {
    expect(sheets).toContain("SHEETS_REQUEST_TIMEOUT_MS")
    expect(sheets).toContain("AbortSignal.timeout(SHEETS_REQUEST_TIMEOUT_MS)")
    expect(auth).toContain("AbortSignal.timeout(GOOGLE_TOKEN_TIMEOUT_MS)")
  })

  it("streams bounded JSON bodies instead of trusting Content-Length", () => {
    expect(syncRoute).toContain("readJsonBodyWithLimit")
    expect(ttsRoute).toContain("readJsonBodyWithLimit")
    expect(geminiRoute).toContain("readJsonBodyWithLimit")
  })

  it("marks every API response no-store by default", () => {
    expect(nextConfig).toContain('source: "/api/:path*"')
    expect(nextConfig).toContain('"no-store, max-age=0"')
  })

  it("describes JSON export as an active-deck backup", () => {
    expect(deckTools).toContain("JSON · current deck backup")
    expect(deckTools).not.toContain("full project backup")
  })
})
''')
