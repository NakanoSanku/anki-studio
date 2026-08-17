import { templateUsesField, ttsOf, type Deck, type TtsField, type TtsLang } from "./deck"
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

export async function ttsClipId(lang: TtsLang, slow: boolean, text: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${lang}|${slow ? 1 : 0}|${text}`)
  const digest = await crypto.subtle.digest("SHA-1", bytes)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("")
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
    request.onerror = () => reject(request.error ?? new Error("无法打开语音缓存"))
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
      request.onerror = () => reject(request.error ?? new Error("读取语音缓存失败"))
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
      request.onerror = () => reject(request.error ?? new Error("写入语音缓存失败"))
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
    throw new Error(data?.error || `语音接口 ${response.status}`)
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
  if (!text) throw new Error("没有可朗读的文本")
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
      reject(new Error("音频播放失败"))
    }
    void audio.play().catch((error) => {
      URL.revokeObjectURL(url)
      if (currentAudio === audio) currentAudio = null
      reject(error instanceof Error ? error : new Error("音频播放失败"))
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

export function ttsFieldsOnSide(deck: Deck, side: "front" | "back"): string[] {
  const template = side === "front" ? deck.front : deck.back
  const names: string[] = []
  for (const name of Object.keys(ttsOf(deck))) {
    if (templateUsesField(template, name)) names.push(name)
  }
  if (side === "back" && /\{\{\s*FrontSide\s*\}\}/.test(deck.back)) {
    for (const name of Object.keys(ttsOf(deck))) {
      if (templateUsesField(deck.front, name) && !names.includes(name)) names.push(name)
    }
  }
  return names
}
