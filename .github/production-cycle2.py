from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 match, found {count}")
    return text.replace(old, new, 1)


# Guard the last async reload window so an edit landing after sync completion
# cannot be replaced by an older persistent snapshot.
path = Path("components/studio.tsx")
studio = path.read_text()
studio = replace_once(
    studio,
    '''  const reloadFromStore = async () => {\n    const nextLibrary = await readLibrary()\n    const record = await getStudioStore().getRecord(nextLibrary.activeId)\n    updateLibraryState(nextLibrary)\n    setDirty(await readDirtyCount())\n    if (!record || record.deletedAt) return\n    updateDeckState(record.deck)\n    setSelectedId(readEditorState(nextLibrary.activeId, record.deck).selectedId)\n  }''',
    '''  const reloadFromStore = async (guard: () => boolean = () => true): Promise<boolean> => {\n    const nextLibrary = await readLibrary()\n    if (!guard()) return false\n    const record = await getStudioStore().getRecord(nextLibrary.activeId)\n    const nextDirty = await readDirtyCount()\n    if (!guard()) return false\n    updateLibraryState(nextLibrary)\n    setDirty(nextDirty)\n    if (!record || record.deletedAt) return true\n    updateDeckState(record.deck)\n    setSelectedId(readEditorState(nextLibrary.activeId, record.deck).selectedId)\n    return true\n  }''',
    "guarded store reload",
)
studio = replace_once(
    studio,
    '''      if (preserveLocalAfterSync) {\n        const recoveredLibrary = await persistActiveDeck(libraryRef.current, deckRef.current, { recreateMissing: true })\n        updateLibraryState(recoveredLibrary)\n        setDirty(await readDirtyCount())\n      } else {\n        await reloadFromStore()\n      }''',
    '''      if (preserveLocalAfterSync) {\n        const recoveredLibrary = await persistActiveDeck(libraryRef.current, deckRef.current, { recreateMissing: true })\n        updateLibraryState(recoveredLibrary)\n        setDirty(await readDirtyCount())\n      } else {\n        const reloaded = await reloadFromStore(isLocalStateCurrent)\n        if (!reloaded) {\n          preserveLocalAfterSync = true\n          const recoveredLibrary = await persistActiveDeck(\n            libraryRef.current,\n            deckRef.current,\n            { recreateMissing: true }\n          )\n          updateLibraryState(recoveredLibrary)\n          setDirty(await readDirtyCount())\n        }\n      }''',
    "guarded sync reload",
)
path.write_text(studio)


# TTS playback must settle interrupted promises and revoke every object URL.
path = Path("lib/tts.ts")
tts = path.read_text()
tts = replace_once(
    tts,
    "const memory = new Map<string, Blob>()\nlet currentAudio: HTMLAudioElement | null = null\n",
    '''const memory = new Map<string, Blob>()\n\ntype PlayingAudio = {\n  audio: HTMLAudioElement\n  url: string\n  resolve: () => void\n  reject: (error: Error) => void\n  settled: boolean\n}\n\nlet currentAudio: PlayingAudio | null = null\n\nfunction settleAudio(entry: PlayingAudio, error?: Error): void {\n  if (entry.settled) return\n  entry.settled = true\n  entry.audio.onended = null\n  entry.audio.onerror = null\n  entry.audio.removeAttribute("src")\n  URL.revokeObjectURL(entry.url)\n  if (currentAudio === entry) currentAudio = null\n  if (error) entry.reject(error)\n  else entry.resolve()\n}\n''',
    "tts current audio state",
)
tts = replace_once(
    tts,
    '''export async function playTtsAudio(blob: Blob) {\n  stopTtsAudio()\n  const url = URL.createObjectURL(blob)\n  const audio = new Audio(url)\n  currentAudio = audio\n  await new Promise<void>((resolve, reject) => {\n    audio.onended = () => {\n      URL.revokeObjectURL(url)\n      if (currentAudio === audio) currentAudio = null\n      resolve()\n    }\n    audio.onerror = () => {\n      URL.revokeObjectURL(url)\n      if (currentAudio === audio) currentAudio = null\n      reject(new Error("Audio playback failed"))\n    }\n    void audio.play().catch((error) => {\n      URL.revokeObjectURL(url)\n      if (currentAudio === audio) currentAudio = null\n      reject(error instanceof Error ? error : new Error("Audio playback failed"))\n    })\n  })\n}\n\nexport function stopTtsAudio() {\n  if (!currentAudio) return\n  currentAudio.pause()\n  currentAudio.src = ""\n  currentAudio = null\n}''',
    '''export async function playTtsAudio(blob: Blob) {\n  stopTtsAudio()\n  const url = URL.createObjectURL(blob)\n  const audio = new Audio(url)\n  const entry: PlayingAudio = {\n    audio,\n    url,\n    resolve: () => {},\n    reject: () => {},\n    settled: false,\n  }\n  currentAudio = entry\n  await new Promise<void>((resolve, reject) => {\n    entry.resolve = resolve\n    entry.reject = reject\n    audio.onended = () => settleAudio(entry)\n    audio.onerror = () => settleAudio(entry, new Error("Audio playback failed"))\n    void audio.play().catch((error) => {\n      settleAudio(entry, error instanceof Error ? error : new Error("Audio playback failed"))\n    })\n  })\n}\n\nexport function stopTtsAudio() {\n  const entry = currentAudio\n  if (!entry) return\n  entry.audio.pause()\n  settleAudio(entry)\n}''',
    "tts playback cleanup",
)
path.write_text(tts)


# Bound the entire AI request, including reading the response body, and keep
# timeout errors distinct from CORS/network errors.
Path("lib/ai-upstream.ts").write_text(r'''import { extractModelIds, validateProviderEndpoint } from "./ai-settings"

export const AI_FETCH_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
export const AI_REQUEST_TIMEOUT_MS = 90_000

export function providerFetch(input: RequestInfo | URL, init?: RequestInit) {
  const headers = new Headers(init?.headers)
  if (typeof window === "undefined") {
    headers.set("User-Agent", AI_FETCH_UA)
  }
  if (!headers.has("Accept")) headers.set("Accept", "application/json")
  return fetch(input, { ...init, headers, cache: "no-store" })
}

export async function withProviderTimeout<T>(
  work: (signal: AbortSignal) => Promise<T>,
  externalSignal?: AbortSignal,
  timeoutMs = AI_REQUEST_TIMEOUT_MS
): Promise<T> {
  if (externalSignal?.aborted) {
    throw externalSignal.reason instanceof Error
      ? externalSignal.reason
      : new DOMException("Aborted", "AbortError")
  }

  const controller = new AbortController()
  let timedOut = false
  const onExternalAbort = () => controller.abort(externalSignal?.reason)
  externalSignal?.addEventListener("abort", onExternalAbort, { once: true })
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, Math.max(1, timeoutMs))

  try {
    return await work(controller.signal)
  } catch (error) {
    if (timedOut && !externalSignal?.aborted) {
      throw new Error("AI request timed out. Try again.")
    }
    throw error
  } finally {
    clearTimeout(timer)
    externalSignal?.removeEventListener("abort", onExternalAbort)
  }
}

export function isCloudflareBlocked(error: string): boolean {
  return /cloudflare|\bcf-ray\b|cf-mitigated|ray [a-f0-9]+-[a-z]{3}|Cloudflare blocked/i.test(error)
}

export function isBrowserNetworkError(error: string): boolean {
  return /failed to fetch|networkerror|load failed|failed to load|network request failed|\bcors\b|cross-origin/i.test(error)
}

export function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const name = "name" in error ? String(error.name) : ""
  const message = "message" in error ? String(error.message) : ""
  return name === "AbortError" || /the user aborted|operation was aborted|signal is aborted/i.test(message)
}

export async function withBrowserCorsHint<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work()
  } catch (error) {
    if (isAbortError(error)) throw error
    const message = error instanceof Error ? error.message : String(error)
    if (isBrowserNetworkError(message)) {
      throw new Error("The browser could not reach the AI provider. Enable CORS on the provider endpoint and try again.")
    }
    throw error
  }
}

export async function listProviderModels(settings: { baseURL: string; apiKey: string }): Promise<string[]> {
  const invalid = validateProviderEndpoint(settings.baseURL)
  if (invalid) throw new Error(invalid)

  const endpoint = `${settings.baseURL.trim().replace(/\/$/, "")}/models`
  const headers: HeadersInit = { Accept: "application/json" }
  if (settings.apiKey.trim()) headers.Authorization = `Bearer ${settings.apiKey.trim()}`

  return withProviderTimeout(async (signal) => {
    const response = await providerFetch(endpoint, { headers, signal })
    const body = await response.text()
    if (!response.ok) {
      throw new Error(
        describeUpstreamError({
          status: response.status,
          body,
          cfRay: response.headers.get("cf-ray"),
        })
      )
    }

    let payload: unknown = null
    try {
      payload = body ? JSON.parse(body) : null
    } catch {
      throw new Error("The provider did not return JSON")
    }

    const models = extractModelIds(payload)
    if (models.length === 0) throw new Error("The provider did not return any available models")
    return models
  })
}

export function describeUpstreamError(input: {
  status: number
  body: string
  cfRay?: string | null
}): string {
  const raw = input.body.trim()
  if (raw) {
    try {
      const payload = JSON.parse(raw) as unknown
      const message = readJsonError(payload)
      if (message) {
        const blocked = Boolean(input.cfRay) || isCloudflareBlocked(message)
        if (blocked) {
          const ray = input.cfRay ? ` · Ray ${input.cfRay}` : ""
          return `HTTP ${input.status}: Cloudflare blocked the provider request${ray}`
        }
        return `HTTP ${input.status}: ${message}`
      }
    } catch {
      // HTML / plain text from a gateway
    }
  }

  const text = raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
  const blocked = Boolean(input.cfRay)
    || /cloudflare|attention required|just a moment|sorry, you have been blocked|error 10\d\d|cf-mitigated/i.test(raw)
  if (blocked) {
    const ray = input.cfRay ? ` · Ray ${input.cfRay}` : ""
    return `HTTP ${input.status}: Cloudflare blocked the provider request${ray}`
  }
  if (text) return `HTTP ${input.status}: ${text.slice(0, 180)}`
  return `HTTP ${input.status}`
}

function readJsonError(payload: unknown): string {
  if (!payload || typeof payload !== "object") return ""
  const error = (payload as { error?: unknown }).error
  if (typeof error === "string" && error.trim()) return error.trim()
  if (error && typeof error === "object") {
    const message = (error as { message?: unknown }).message
    if (typeof message === "string" && message.trim()) return message.trim()
  }
  const message = (payload as { message?: unknown }).message
  return typeof message === "string" ? message.trim() : ""
}
''')

path = Path("lib/ai-compat.ts")
ai_compat = path.read_text()
ai_compat = replace_once(
    ai_compat,
    'import { describeUpstreamError, providerFetch } from "./ai-upstream"',
    'import { describeUpstreamError, providerFetch, withProviderTimeout } from "./ai-upstream"',
    "ai timeout import",
)
old_fetch = '''  const response = await providerFetch(endpoint, {\n    method: "POST",\n    headers,\n    body: JSON.stringify({\n      model: settings.model.trim(),\n      temperature: 0.7,\n      messages,\n    }),\n    signal: input.signal,\n  })\n  const body = await response.text()\n  if (!response.ok) {\n    throw new Error(\n      describeUpstreamError({\n        status: response.status,\n        body,\n        cfRay: response.headers.get("cf-ray"),\n      })\n    )\n  }\n\n  let payload: unknown = null\n  try {\n    payload = body ? JSON.parse(body) : null\n  } catch {\n    throw new Error("接口没有返回 JSON")\n  }\n\n  const text = readChatText(payload)\n  if (!text) throw new Error("模型没有返回内容")\n  return text'''
new_fetch = '''  return withProviderTimeout(async (signal) => {\n    const response = await providerFetch(endpoint, {\n      method: "POST",\n      headers,\n      body: JSON.stringify({\n        model: settings.model.trim(),\n        temperature: 0.7,\n        messages,\n      }),\n      signal,\n    })\n    const body = await response.text()\n    if (!response.ok) {\n      throw new Error(\n        describeUpstreamError({\n          status: response.status,\n          body,\n          cfRay: response.headers.get("cf-ray"),\n        })\n      )\n    }\n\n    let payload: unknown = null\n    try {\n      payload = body ? JSON.parse(body) : null\n    } catch {\n      throw new Error("The provider did not return JSON")\n    }\n\n    const text = readChatText(payload)\n    if (!text) throw new Error("The model returned no content")\n    return text\n  }, input.signal)'''
ai_compat = replace_once(ai_compat, old_fetch, new_fetch, "complete chat timeout")
path.write_text(ai_compat)

# Shared best-effort server-side abuse guard for unauthenticated utility routes.
Path("lib/request-guard.ts").write_text(r'''type WindowEntry = { startedAt: number; count: number }

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
''')

# Harden the public TTS utility endpoint against oversized bodies, abusive bursts,
# and indefinitely hanging upstream requests.
path = Path("app/api/tts/route.ts")
tts_route = path.read_text()
tts_route = replace_once(
    tts_route,
    'import { RateGate } from "@/lib/rate-gate"',
    'import { RateGate } from "@/lib/rate-gate"\nimport { contentLengthExceeds, createWindowRateLimiter, requestClientKey } from "@/lib/request-guard"',
    "tts route guard import",
)
tts_route = replace_once(
    tts_route,
    'const MIN_GAP_MS = 400\n',
    'const MIN_GAP_MS = 400\nconst MAX_BODY_BYTES = 4096\nconst UPSTREAM_TIMEOUT_MS = 15_000\nconst allowRequest = createWindowRateLimiter({ limit: 60, windowMs: 60_000 })\n',
    "tts route limits",
)
tts_route = replace_once(
    tts_route,
    '      cache: "no-store",\n    })',
    '      cache: "no-store",\n      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),\n    })',
    "tts upstream timeout",
)
tts_route = replace_once(
    tts_route,
    '''export async function POST(request: Request) {\n  let body: { text?: unknown; lang?: unknown; slow?: unknown }''',
    '''export async function POST(request: Request) {\n  if (contentLengthExceeds(request, MAX_BODY_BYTES)) {\n    return Response.json({ error: "Request body is too large" }, { status: 413 })\n  }\n  const rate = allowRequest(requestClientKey(request))\n  if (!rate.allowed) {\n    return Response.json(\n      { error: "Too many TTS requests. Try again shortly." },\n      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }\n    )\n  }\n\n  let body: { text?: unknown; lang?: unknown; slow?: unknown }''',
    "tts route rate limit",
)
path.write_text(tts_route)

# Gemini Live token minting also gets a small body budget and upstream timeout.
path = Path("app/api/gemini-live/token/route.ts")
gemini = path.read_text()
gemini = replace_once(
    gemini,
    'import { GEMINI_LIVE_MODEL } from "@/lib/gemini-live-settings"',
    'import { GEMINI_LIVE_MODEL } from "@/lib/gemini-live-settings"\nimport { contentLengthExceeds, createWindowRateLimiter, requestClientKey } from "@/lib/request-guard"',
    "gemini guard import",
)
gemini = replace_once(
    gemini,
    'const NEW_SESSION_WINDOW_MS = 60 * 1000\n',
    'const NEW_SESSION_WINDOW_MS = 60 * 1000\nconst MAX_BODY_BYTES = 4096\nconst UPSTREAM_TIMEOUT_MS = 15_000\nconst allowRequest = createWindowRateLimiter({ limit: 30, windowMs: 60_000 })\n',
    "gemini limits",
)
gemini = replace_once(
    gemini,
    '''export async function POST(request: Request) {\n  let body: { apiKey?: unknown }''',
    '''export async function POST(request: Request) {\n  if (contentLengthExceeds(request, MAX_BODY_BYTES)) {\n    return Response.json({ error: "Request body is too large" }, { status: 413 })\n  }\n  const rate = allowRequest(requestClientKey(request))\n  if (!rate.allowed) {\n    return Response.json(\n      { error: "Too many token requests. Try again shortly." },\n      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }\n    )\n  }\n\n  let body: { apiKey?: unknown }''',
    "gemini rate limit",
)
gemini = replace_once(
    gemini,
    '      cache: "no-store",\n    })',
    '      cache: "no-store",\n      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),\n    })',
    "gemini upstream timeout",
)
path.write_text(gemini)

# Bound import memory use before reading user-controlled text/ZIP data and reject
# ZIPs whose declared uncompressed size is unreasonable.
path = Path("lib/apkg.ts")
apkg = path.read_text()
marker = 'const FIELD_SEP = "\\x1f"\n'
apkg = replace_once(
    apkg,
    marker,
    marker + '''export const MAX_TEXT_IMPORT_BYTES = 20 * 1024 * 1024\nexport const MAX_ANKI_PACKAGE_BYTES = 128 * 1024 * 1024\nconst MAX_ANKI_COLLECTION_BYTES = 64 * 1024 * 1024\nconst MAX_ANKI_UNCOMPRESSED_BYTES = 512 * 1024 * 1024\nconst MAX_ANKI_ZIP_ENTRIES = 20_000\nconst MAX_TTS_MEDIA_BYTES = 16 * 1024 * 1024\n\ntype SizedZipObject = JSZip.JSZipObject & {\n  _data?: { uncompressedSize?: number }\n}\n\nfunction declaredZipSize(file: JSZip.JSZipObject | null): number | null {\n  const value = Number((file as SizedZipObject | null)?._data?.uncompressedSize)\n  return Number.isFinite(value) && value >= 0 ? value : null\n}\n\nexport function importFileSizeError(name: string, size: number): string | null {\n  const lower = name.toLowerCase()\n  const maximum = lower.endsWith(".apkg") || lower.endsWith(".colpkg")\n    ? MAX_ANKI_PACKAGE_BYTES\n    : MAX_TEXT_IMPORT_BYTES\n  return size > maximum ? `Import file is too large (${Math.ceil(maximum / 1024 / 1024)} MB limit)` : null\n}\n''',
    "import size constants",
)
apkg = replace_once(
    apkg,
    '''export async function importApkg(buffer: ArrayBuffer): Promise<ImportResult> {\n  const zip = await JSZip.loadAsync(buffer)\n  const colFile = zip.file("collection.anki2") ?? zip.file("collection.anki21")''',
    '''export async function importApkg(buffer: ArrayBuffer): Promise<ImportResult> {\n  if (buffer.byteLength > MAX_ANKI_PACKAGE_BYTES) {\n    throw new Error("Anki package is too large to import")\n  }\n  const zip = await JSZip.loadAsync(buffer)\n  const entries = Object.values(zip.files)\n  if (entries.length > MAX_ANKI_ZIP_ENTRIES) {\n    throw new Error("Anki package contains too many files")\n  }\n  let declaredTotal = 0\n  for (const entry of entries) {\n    const size = declaredZipSize(entry)\n    if (size == null) continue\n    declaredTotal += size\n    if (declaredTotal > MAX_ANKI_UNCOMPRESSED_BYTES) {\n      throw new Error("Anki package expands beyond the safe import limit")\n    }\n  }\n\n  const colFile = zip.file("collection.anki2") ?? zip.file("collection.anki21")''',
    "apkg archive budget",
)
apkg = replace_once(
    apkg,
    '''  if (!colFile) {\n    throw new Error("卡包里没有 collection 数据库")\n  }\n\n  const SQL = await loadSql()''',
    '''  if (!colFile) {\n    throw new Error("卡包里没有 collection 数据库")\n  }\n  const declaredCollectionSize = declaredZipSize(colFile)\n  if (declaredCollectionSize != null && declaredCollectionSize > MAX_ANKI_COLLECTION_BYTES) {\n    throw new Error("Anki collection database is too large to import")\n  }\n\n  const SQL = await loadSql()''',
    "apkg collection budget",
)
apkg = replace_once(
    apkg,
    '''          const bin = zip.file(index)\n          if (!parsed || !bin) continue\n          await cacheSet(parsed.id, await bin.async("arraybuffer"))''',
    '''          const bin = zip.file(index)\n          if (!parsed || !bin) continue\n          const mediaSize = declaredZipSize(bin)\n          if (mediaSize != null && mediaSize > MAX_TTS_MEDIA_BYTES) {\n            throw new Error("Anki package contains an oversized TTS media file")\n          }\n          await cacheSet(parsed.id, await bin.async("arraybuffer"))''',
    "apkg media budget",
)
apkg = replace_once(
    apkg,
    '''export async function importDeckFile(file: File, current: Deck): Promise<ImportResult> {\n  const name = file.name.toLowerCase()''',
    '''export async function importDeckFile(file: File, current: Deck): Promise<ImportResult> {\n  const sizeError = importFileSizeError(file.name, file.size)\n  if (sizeError) throw new Error(sizeError)\n  const name = file.name.toLowerCase()''',
    "import file budget",
)
path.write_text(apkg)

# Add browser-facing response hardening without a brittle app-wide CSP.
path = Path("next.config.ts")
config = path.read_text()
config = replace_once(
    config,
    '''          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },''',
    '''          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },\n          { key: "X-DNS-Prefetch-Control", value: "off" },\n          {\n            key: "Permissions-Policy",\n            value: "camera=(), geolocation=(), payment=(), usb=(), microphone=(self)",\n          },''',
    "security headers",
)
path.write_text(config)

# Regression coverage.
path = Path("tests/unit/lib/tts.test.ts")
test = path.read_text()
test = test.replace('import { sha1Hex, ttsClipId } from "@/lib/tts"', 'import { playTtsAudio, sha1Hex, stopTtsAudio, ttsClipId } from "@/lib/tts"')
append = r'''

describe("TTS playback cleanup", () => {
  it("settles interrupted playback and revokes both object URLs", async () => {
    class FakeAudio {
      onended: (() => void) | null = null
      onerror: (() => void) | null = null
      constructor(public src: string) {}
      play() { return Promise.resolve() }
      pause() {}
      removeAttribute(name: string) { if (name === "src") this.src = "" }
    }
    const createObjectURL = vi.fn()
      .mockReturnValueOnce("blob:first")
      .mockReturnValueOnce("blob:second")
    const revokeObjectURL = vi.fn()
    vi.stubGlobal("Audio", FakeAudio)
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL })

    const first = playTtsAudio(new Blob(["a"]))
    const second = playTtsAudio(new Blob(["b"]))
    await expect(first).resolves.toBeUndefined()
    stopTtsAudio()
    await expect(second).resolves.toBeUndefined()
    expect(revokeObjectURL.mock.calls.map(([url]) => url)).toEqual(["blob:first", "blob:second"])
  })
})
'''
test += append
path.write_text(test)

path = Path("tests/unit/lib/ai-upstream.test.ts")
test = path.read_text()
test = test.replace('import { describe, expect, it } from "vitest"', 'import { afterEach, describe, expect, it, vi } from "vitest"')
test = test.replace('  withBrowserCorsHint,\n', '  withBrowserCorsHint,\n  withProviderTimeout,\n')
test = test.replace(').toBe("HTTP 403：Insufficient quota")', ').toBe("HTTP 403: Insufficient quota")')
test = test.replace('isCloudflareBlocked("HTTP 403：中转站前的 Cloudflare 拦截了请求，Ray a2c5e4fdac18e047-IAD")', 'isCloudflareBlocked("HTTP 403: Cloudflare blocked the provider request · Ray a2c5e4fdac18e047-IAD")')
test = test.replace('isCloudflareBlocked("HTTP 403：Insufficient quota")', 'isCloudflareBlocked("HTTP 403: Insufficient quota")')
test = test.replace('"未开启跨域"', '"Enable CORS"')
test = test.replace('new Error("HTTP 401：Incorrect API key")', 'new Error("HTTP 401: Incorrect API key")')
test = test.replace('.rejects.toThrow("HTTP 401：Incorrect API key")', '.rejects.toThrow("HTTP 401: Incorrect API key")')
test += r'''

afterEach(() => {
  vi.useRealTimers()
})

describe("withProviderTimeout", () => {
  it("aborts a stalled request with a clear timeout error", async () => {
    vi.useFakeTimers()
    const pending = withProviderTimeout(
      (signal) => new Promise<void>((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true })
      }),
      undefined,
      25
    )
    const assertion = expect(pending).rejects.toThrow("AI request timed out")
    await vi.advanceTimersByTimeAsync(25)
    await assertion
  })
})
'''
path.write_text(test)

Path("tests/unit/lib/request-guard.test.ts").write_text(r'''import { describe, expect, it } from "vitest"
import { contentLengthExceeds, createWindowRateLimiter, requestClientKey } from "@/lib/request-guard"

describe("request guard", () => {
  it("rejects declared oversized request bodies", () => {
    const request = new Request("https://example.com", { headers: { "content-length": "5000" } })
    expect(contentLengthExceeds(request, 4096)).toBe(true)
  })

  it("limits a client within a fixed window and resets after it", () => {
    const allow = createWindowRateLimiter({ limit: 2, windowMs: 1000 })
    expect(allow("client", 0).allowed).toBe(true)
    expect(allow("client", 1).allowed).toBe(true)
    expect(allow("client", 2).allowed).toBe(false)
    expect(allow("client", 1001).allowed).toBe(true)
  })

  it("prefers platform client IP headers", () => {
    const request = new Request("https://example.com", {
      headers: { "cf-connecting-ip": "203.0.113.8", "x-forwarded-for": "198.51.100.2" },
    })
    expect(requestClientKey(request)).toBe("203.0.113.8")
  })
})
''')

path = Path("tests/unit/lib/apkg-import.test.ts")
test = path.read_text()
test = test.replace(
    'import { apkgImportWarnings, exportApkg, importApkg, importDeckFile, setSqlWasmPath } from "@/lib/apkg"',
    'import { apkgImportWarnings, exportApkg, importApkg, importDeckFile, importFileSizeError, MAX_ANKI_PACKAGE_BYTES, MAX_TEXT_IMPORT_BYTES, setSqlWasmPath } from "@/lib/apkg"'
)
test = test.replace(
    'describe("importDeckFile", () => {',
    '''describe("importDeckFile", () => {\n  it("rejects oversized inputs before reading them", () => {\n    expect(importFileSizeError("huge.json", MAX_TEXT_IMPORT_BYTES + 1)).toContain("too large")\n    expect(importFileSizeError("huge.apkg", MAX_ANKI_PACKAGE_BYTES + 1)).toContain("too large")\n    expect(importFileSizeError("ok.apkg", MAX_ANKI_PACKAGE_BYTES)).toBeNull()\n  })\n'''
)
path.write_text(test)

Path("tests/contracts/production-safety.test.ts").write_text(r'''import { describe, expect, it } from "vitest"
import { readSource } from "./helpers/source"

const studio = readSource("components", "studio.tsx")
const ttsRoute = readSource("app", "api", "tts", "route.ts")
const geminiRoute = readSource("app", "api", "gemini-live", "token", "route.ts")
const nextConfig = readSource("next.config.ts")

describe("production safety gates", () => {
  it("rechecks in-memory state after asynchronous store reloads", () => {
    expect(studio).toContain("reloadFromStore(isLocalStateCurrent)")
    expect(studio).toContain("if (!guard()) return false")
  })

  it("rate limits public server utility routes and times out upstream calls", () => {
    expect(ttsRoute).toContain("createWindowRateLimiter")
    expect(ttsRoute).toContain("AbortSignal.timeout")
    expect(geminiRoute).toContain("createWindowRateLimiter")
    expect(geminiRoute).toContain("AbortSignal.timeout")
  })

  it("ships restrictive browser permission headers without disabling the microphone", () => {
    expect(nextConfig).toContain("Permissions-Policy")
    expect(nextConfig).toContain("microphone=(self)")
    expect(nextConfig).toContain("camera=()")
  })
})
''')
