import { getCardTemplate, templateUsesField, ttsOf, type Deck, type TtsField, type TtsLang } from "./deck"
import { RateGate } from "./rate-gate"

export const TTS_GAP_MS = 1500
const MAX_CHUNK = 180
const DB_NAME = "anki-studio.tts.v1"
const STORE = "clips"

const memory = new Map<string, Blob>()
let currentAudio: HTMLAudioElement | null = null

export function normalizeTtsText(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF\u2060\u2063]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

export function chunkTtsText(text: string): string[] {
  if (text.length <= MAX_CHUNK) return [text]
  const parts: string[] = []
  const sentences = text.split(/(?<=[.!?。！？\n])/u)
  let buffer = ""
  for (const sentence of sentences) {
    if (!sentence) continue
    if (sentence.length > MAX_CHUNK) {
      if (buffer.trim()) parts.push(buffer.trim())
      buffer = ""
      for (let i = 0; i < sentence.length; i += MAX_CHUNK) {
        parts.push(sentence.slice(i, i + MAX_CHUNK).trim())
      }
      continue
    }
    if ((buffer + sentence).length > MAX_CHUNK) {
      if (buffer.trim()) parts.push(buffer.trim())
      buffer = sentence
    } else {
      buffer += sentence
    }
  }
  if (buffer.trim()) parts.push(buffer.trim())
  return parts.filter(Boolean)
}

function rotateLeft(value: number, bits: number): number {
  return ((value << bits) | (value >>> (32 - bits))) >>> 0
}

/**
 * Small SHA-1 implementation used only as a compatibility fallback when
 * Web Crypto is unavailable (for example on an HTTP self-hosted origin or
 * in a restricted WebView). Keeping SHA-1 here preserves existing TTS cache
 * IDs and exported audio filenames exactly.
 */
export function sha1Hex(bytes: Uint8Array): string {
  const bitLength = bytes.length * 8
  const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64
  const padded = new Uint8Array(paddedLength)
  padded.set(bytes)
  padded[bytes.length] = 0x80

  const view = new DataView(padded.buffer)
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000), false)
  view.setUint32(paddedLength - 4, bitLength >>> 0, false)

  let h0 = 0x67452301
  let h1 = 0xefcdab89
  let h2 = 0x98badcfe
  let h3 = 0x10325476
  let h4 = 0xc3d2e1f0
  const words = new Uint32Array(80)

  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let i = 0; i < 16; i += 1) {
      words[i] = view.getUint32(offset + i * 4, false)
    }
    for (let i = 16; i < 80; i += 1) {
      words[i] = rotateLeft(words[i - 3] ^ words[i - 8] ^ words[i - 14] ^ words[i - 16], 1)
    }

    let a = h0
    let b = h1
    let c = h2
    let d = h3
    let e = h4

    for (let i = 0; i < 80; i += 1) {
      let f: number
      let k: number
      if (i < 20) {
        f = (b & c) | (~b & d)
        k = 0x5a827999
      } else if (i < 40) {
        f = b ^ c ^ d
        k = 0x6ed9eba1
      } else if (i < 60) {
        f = (b & c) | (b & d) | (c & d)
        k = 0x8f1bbcdc
      } else {
        f = b ^ c ^ d
        k = 0xca62c1d6
      }

      const next = (rotateLeft(a, 5) + f + e + k + words[i]) >>> 0
      e = d
      d = c
      c = rotateLeft(b, 30)
      b = a
      a = next
    }

    h0 = (h0 + a) >>> 0
    h1 = (h1 + b) >>> 0
    h2 = (h2 + c) >>> 0
    h3 = (h3 + d) >>> 0
    h4 = (h4 + e) >>> 0
  }

  return [h0, h1, h2, h3, h4].map((value) => value.toString(16).padStart(8, "0")).join("")
}

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("")
}

export async function ttsClipId(lang: TtsLang, slow: boolean, text: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${lang}|${slow ? 1 : 0}|${text}`)
  const subtle = globalThis.crypto?.subtle
  if (subtle) {
    try {
      const digest = await subtle.digest("SHA-1", bytes)
      return bytesToHex(new Uint8Array(digest))
    } catch {
      // Some restricted browser contexts expose SubtleCrypto but reject digest().
      // Fall through to the deterministic JavaScript implementation below.
    }
  }
  return sha1Hex(bytes)
}

export function ttsFilename(lang: TtsLang, slow: boolean, id: string): string {
  return `tts_${lang}_${slow ? "s" : "n"}_${id}.mp3`
}

export function parseTtsFilename(name: string): { lang: TtsLang; slow: boolean; id: string } | null {
  const match = /^tts_(en|th)_(s|n)_([a-f0-9]{40})\.mp3$/i.exec(name)
  if (!match) return null
  return {
    lang: match[1] === "th" ? "th" : "en",
    slow: match[2] === "s",
    id: match[3].toLowerCase(),
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error("Unable to open the TTS cache"))
  })
}

export async function cacheGet(id: string): Promise<Blob | null> {
  const hit = memory.get(id)
  if (hit) return hit
  if (typeof indexedDB === "undefined") return null
  const db = await openDb()
  try {
    const buffer = await new Promise<ArrayBuffer | undefined>((resolve, reject) => {
      const request = db.transaction(STORE, "readonly").objectStore(STORE).get(id)
      request.onsuccess = () => resolve(request.result as ArrayBuffer | undefined)
      request.onerror = () => reject(request.error ?? new Error("Unable to read the TTS cache"))
    })
    if (!buffer) return null
    const blob = new Blob([buffer], { type: "audio/mpeg" })
    memory.set(id, blob)
    return blob
  } finally {
    db.close()
  }
}

export async function cacheSet(id: string, data: ArrayBuffer | Blob): Promise<Blob> {
  const buffer = data instanceof Blob ? await data.arrayBuffer() : data
  const blob = new Blob([buffer], { type: "audio/mpeg" })
  memory.set(id, blob)
  if (typeof indexedDB === "undefined") return blob
  const db = await openDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const request = db.transaction(STORE, "readwrite").objectStore(STORE).put(buffer, id)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error ?? new Error("Unable to write the TTS cache"))
    })
  } finally {
    db.close()
  }
  return blob
}

const gate = new RateGate(TTS_GAP_MS)

async function fetchTtsChunk(text: string, lang: TtsLang, slow: boolean, signal?: AbortSignal): Promise<ArrayBuffer> {
  const response = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, lang, slow }),
    signal,
  })
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(data?.error || `TTS request failed (${response.status})`)
  }
  return response.arrayBuffer()
}

export type TtsClip = {
  id: string
  filename: string
  blob: Blob
}

export async function getTtsClip(input: {
  text: string
  lang: TtsLang
  slow: boolean
  signal?: AbortSignal
}): Promise<TtsClip> {
  const text = normalizeTtsText(input.text)
  if (!text) throw new Error("There is no text to read")
  const id = await ttsClipId(input.lang, input.slow, text)
  const filename = ttsFilename(input.lang, input.slow, id)
  const cached = await cacheGet(id)
  if (cached) return { id, filename, blob: cached }

  const chunks = chunkTtsText(text)
  const parts: ArrayBuffer[] = []
  for (const chunk of chunks) {
    if (input.signal?.aborted) throw new DOMException("Aborted", "AbortError")
    parts.push(await gate.enqueue(() => fetchTtsChunk(chunk, input.lang, input.slow, input.signal)))
  }
  const blob = await cacheSet(id, new Blob(parts, { type: "audio/mpeg" }))
  return { id, filename, blob }
}

export async function playTtsAudio(blob: Blob) {
  stopTtsAudio()
  const url = URL.createObjectURL(blob)
  const audio = new Audio(url)
  currentAudio = audio
  await new Promise<void>((resolve, reject) => {
    audio.onended = () => {
      URL.revokeObjectURL(url)
      if (currentAudio === audio) currentAudio = null
      resolve()
    }
    audio.onerror = () => {
      URL.revokeObjectURL(url)
      if (currentAudio === audio) currentAudio = null
      reject(new Error("Audio playback failed"))
    }
    void audio.play().catch((error) => {
      URL.revokeObjectURL(url)
      if (currentAudio === audio) currentAudio = null
      reject(error instanceof Error ? error : new Error("Audio playback failed"))
    })
  })
}

export function stopTtsAudio() {
  if (!currentAudio) return
  currentAudio.pause()
  currentAudio.src = ""
  currentAudio = null
}

export type TtsJob = {
  id: string
  filename: string
  text: string
  lang: TtsLang
  slow: boolean
}

export async function listTtsJobs(deck: Deck, cards: Deck["cards"] = deck.cards): Promise<TtsJob[]> {
  const seen = new Set<string>()
  const jobs: TtsJob[] = []
  for (const card of cards) {
    for (const tts of Object.values(ttsOf(deck))) {
      const text = normalizeTtsText(card.values[tts.source] ?? "")
      if (!text) continue
      const id = await ttsClipId(tts.lang, tts.slow, text)
      if (seen.has(id)) continue
      seen.add(id)
      jobs.push({
        id,
        filename: ttsFilename(tts.lang, tts.slow, id),
        text,
        lang: tts.lang,
        slow: tts.slow,
      })
    }
  }
  return jobs
}

export async function resolveTtsFieldValue(tts: TtsField, values: Record<string, string>): Promise<string> {
  const text = normalizeTtsText(values[tts.source] ?? "")
  if (!text) return ""
  const id = await ttsClipId(tts.lang, tts.slow, text)
  return `[sound:${ttsFilename(tts.lang, tts.slow, id)}]`
}

export function ttsFieldsOnSide(deck: Deck, side: "front" | "back", templateId?: string): string[] {
  const cardTemplate = getCardTemplate(deck, templateId)
  const template = side === "front" ? cardTemplate.front : cardTemplate.back
  const names: string[] = []
  for (const name of Object.keys(ttsOf(deck))) {
    if (templateUsesField(template, name)) names.push(name)
  }
  if (side === "back" && /\{\{\s*FrontSide\s*\}\}/.test(cardTemplate.back)) {
    for (const name of Object.keys(ttsOf(deck))) {
      if (templateUsesField(cardTemplate.front, name) && !names.includes(name)) names.push(name)
    }
  }
  return names
}
