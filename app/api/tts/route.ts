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

  let lastError = "语音接口失败"
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
      lastError = response.status === 403 ? "Google 暂时拒绝语音请求，请稍后再试" : `语音接口 ${response.status}`
      continue
    }
    const buffer = await response.arrayBuffer()
    if (buffer.byteLength > 80) return buffer
    lastError = "语音接口返回空音频"
  }
  throw new Error(lastError)
}

export async function POST(request: Request) {
  let body: { text?: unknown; lang?: unknown; slow?: unknown }
  try {
    body = (await request.json()) as { text?: unknown; lang?: unknown; slow?: unknown }
  } catch {
    return Response.json({ error: "请求无效" }, { status: 400 })
  }

  const text = typeof body.text === "string" ? body.text.trim() : ""
  const lang = body.lang
  if (!text) return Response.json({ error: "没有可朗读的文本" }, { status: 400 })
  if (text.length > MAX_TEXT) return Response.json({ error: "单段文本过长" }, { status: 400 })
  if (!isLang(lang)) return Response.json({ error: "只支持英语和泰语" }, { status: 400 })

  try {
    const audio = await gate.enqueue(() => fetchGoogle(text, lang, Boolean(body.slow)))
    return new Response(audio, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "语音生成失败"
    return Response.json({ error: message }, { status: 502 })
  }
}
