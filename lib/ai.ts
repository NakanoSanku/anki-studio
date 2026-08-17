import { readAiSettings, type AiSettings } from "./ai-settings"
import { describeUpstreamError, runWithTransport } from "./ai-upstream"
import type { TtsField } from "./deck"

async function postAi<T>(
  url: string,
  body: unknown,
  pick: (data: Record<string, unknown>) => T | undefined,
  fallback: string
): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const raw = await response.text()
  let data: Record<string, unknown> = {}
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as unknown
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        data = parsed as Record<string, unknown>
      }
    } catch {
      throw new Error(
        describeUpstreamError({
          status: response.status,
          body: raw,
          cfRay: response.headers.get("cf-ray"),
        })
      )
    }
  }
  const value = pick(data)
  if (!response.ok || value === undefined) {
    throw new Error(typeof data.error === "string" && data.error ? data.error : fallback)
  }
  return value
}

async function viaTransport<T>(
  settings: AiSettings,
  serverCall: () => Promise<T>,
  browserCall: () => Promise<T>
): Promise<T> {
  const { value } = await runWithTransport(settings, serverCall, browserCall)
  return value
}

export type AiAction = "complete" | "rewrite"

export type FieldAiInput = {
  action: AiAction
  field: string
  fields: string[]
  values: Record<string, string>
  notes?: Record<string, string>
  settings?: AiSettings
}

export type CardAiInput = {
  action: AiAction
  fields: string[]
  values: Record<string, string>
  notes?: Record<string, string>
  settings?: AiSettings
}

function withSettings<T extends { settings?: AiSettings }>(input: T) {
  return { ...input, settings: input.settings ?? readAiSettings() }
}

export function formatFieldNotes(fields: string[], notes: Record<string, string> = {}): string {
  const lines = fields
    .map((field) => {
      const note = notes[field]?.trim()
      return note ? `${field}: ${note}` : ""
    })
    .filter(Boolean)
  return lines.length > 0 ? lines.join("\n") : "（无）"
}

export function formatCardContext(
  fields: string[],
  values: Record<string, string>,
  notes: Record<string, string> = {}
): string {
  return fields
    .map((field) => {
      const value = values[field]?.trim() || "（空）"
      const note = notes[field]?.trim()
      return note ? `${field}: ${value}\n  备注: ${note}` : `${field}: ${value}`
    })
    .join("\n")
}

export function formatTtsFields(fieldTts: Record<string, TtsField> = {}): string {
  const lines = Object.entries(fieldTts).map(([name, tts]) => {
    const lang = tts.lang === "th" ? "泰语" : "英语"
    return `${name}: 朗读「${tts.source}」· ${lang}${tts.slow ? " · 慢速" : ""}`
  })
  return lines.length > 0 ? lines.join("\n") : "（无）"
}

export function formatTemplateFields(fields: string[], fieldTts: Record<string, TtsField> = {}): string {
  if (fields.length === 0) return "（无）"
  return fields
    .map((field) => (fieldTts[field] ? `${field}（TTS）` : `${field}（文本）`))
    .join("、")
}

export async function requestFieldAi(input: FieldAiInput): Promise<string> {
  const payload = withSettings(input)
  return viaTransport(
    payload.settings,
    () =>
      postAi(
        "/api/ai/field",
        payload,
        (data) => (typeof data.text === "string" ? data.text : undefined),
        "字段生成失败"
      ),
    async () => (await import("./ai-run")).runFieldAi(payload)
  )
}

export type BatchAiInput = {
  topic: string
  count: number
  fields: string[]
  existingKeys: string[]
  notes?: Record<string, string>
  settings?: AiSettings
}

export async function requestBatchAi(input: BatchAiInput): Promise<Record<string, string>[]> {
  const payload = withSettings(input)
  return viaTransport(
    payload.settings,
    () =>
      postAi(
        "/api/ai/batch",
        payload,
        (data) => (Array.isArray(data.cards) ? (data.cards as Record<string, string>[]) : undefined),
        "批量生成失败"
      ),
    async () => (await import("./ai-run")).runBatchAi(payload)
  )
}

export async function requestCardAi(input: CardAiInput): Promise<Record<string, string>> {
  const payload = withSettings(input)
  return viaTransport(
    payload.settings,
    () =>
      postAi(
        "/api/ai/card",
        payload,
        (data) =>
          data.values && typeof data.values === "object"
            ? (data.values as Record<string, string>)
            : undefined,
        "卡片生成失败"
      ),
    async () => (await import("./ai-run")).runCardAi(payload)
  )
}

export type TemplateAiTarget = "current" | "html" | "all"

export type TemplateAiInput = {
  instruction: string
  target: TemplateAiTarget
  pane: "front" | "back" | "css"
  fields: string[]
  notes?: Record<string, string>
  fieldTts?: Record<string, TtsField>
  front: string
  back: string
  css: string
  sample?: string
  settings?: AiSettings
}

export type TemplateAiResult = {
  front: string
  back: string
  css: string
}

export async function requestTemplateAi(input: TemplateAiInput): Promise<TemplateAiResult> {
  const payload = withSettings(input)
  return viaTransport(
    payload.settings,
    () =>
      postAi(
        "/api/ai/template",
        payload,
        (data) =>
          typeof data.front === "string" && typeof data.back === "string" && typeof data.css === "string"
            ? { front: data.front, back: data.back, css: data.css }
            : undefined,
        "模板生成失败"
      ),
    async () => (await import("./ai-run")).runTemplateAi(payload)
  )
}
