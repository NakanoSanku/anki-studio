import type { TtsLang } from "@/lib/deck"
import { RateGate } from "@/lib/rate-gate"

export const dynamic = "force-dynamic"

const MAX_TEXT = 200
const MIN_GAP_MS = 400
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"

const gate = new RateGate(MIN_GAP_MS)

function isLang(value: unknown): value is TtsLang {
  return value === "en" || value === "th"
}

async function fetchGoogle(text: string, lang: TtsLang, slow: boolean): Promise<ArrayBuffer> {
  const encoded = encodeURIComponent(text)
  const speed = slow ? "0.24" : "1"
  const urls = [
    `https://translate.googleapis.com/translate_tts?ie=UTF-8&client=gtx&tl=${lang}&q=${encoded}&ttsspeed=${speed}`,
    `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${lang}&q=${encoded}&ttsspeed=${speed}`,
  ]

  let lastError = "TTS service failed"
  for (const url of urls) {
    const response = await fetch(url, {
      headers: {
        Accept: "audio/mpeg,audio/*;q=0.9,*/*;q=0.8",
        Referer: "https://translate.google.com/",
        "User-Agent": USER_AGENT,
      },
      cache: "no-store",
    })
    if (!response.ok) {
      lastError = response.status === 403 ? "Google temporarily rejected the TTS request. Try again later." : `TTS service returned ${response.status}`
      continue
    }
    const buffer = await response.arrayBuffer()
    if (buffer.byteLength > 80) return buffer
    lastError = "TTS service returned empty audio"
  }
  throw new Error(lastError)
}

export async function POST(request: Request) {
  let body: { text?: unknown; lang?: unknown; slow?: unknown }
  try {
    body = (await request.json()) as { text?: unknown; lang?: unknown; slow?: unknown }
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 })
  }

  const text = typeof body.text === "string" ? body.text.trim() : ""
  const lang = body.lang
  if (!text) return Response.json({ error: "There is no text to read" }, { status: 400 })
  if (text.length > MAX_TEXT) return Response.json({ error: "Text segment is too long" }, { status: 400 })
  if (!isLang(lang)) return Response.json({ error: "Only English and Thai are supported" }, { status: 400 })

  try {
    const audio = await gate.enqueue(() => fetchGoogle(text, lang, Boolean(body.slow)))
    return new Response(audio, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "TTS generation failed"
    return Response.json({ error: message }, { status: 502 })
  }
}
