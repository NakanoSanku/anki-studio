import { readAiSettings, type AiSettings } from "./ai-settings"
import type { TtsField } from "./deck"

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
  const response = await fetch("/api/ai/field", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(withSettings(input)),
  })
  const data = (await response.json()) as { text?: string; error?: string }
  if (!response.ok || !data.text) {
    throw new Error(data.error || "字段生成失败")
  }
  return data.text
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
  const response = await fetch("/api/ai/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(withSettings(input)),
  })
  const data = (await response.json()) as { cards?: Record<string, string>[]; error?: string }
  if (!response.ok || !data.cards) {
    throw new Error(data.error || "批量生成失败")
  }
  return data.cards
}

export async function requestCardAi(input: CardAiInput): Promise<Record<string, string>> {
  const response = await fetch("/api/ai/card", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(withSettings(input)),
  })
  const data = (await response.json()) as { values?: Record<string, string>; error?: string }
  if (!response.ok || !data.values) {
    throw new Error(data.error || "卡片生成失败")
  }
  return data.values
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
  const response = await fetch("/api/ai/template", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(withSettings(input)),
  })
  const data = (await response.json()) as TemplateAiResult & { error?: string }
  if (!response.ok || typeof data.front !== "string" || typeof data.back !== "string" || typeof data.css !== "string") {
    throw new Error(data.error || "模板生成失败")
  }
  return { front: data.front, back: data.back, css: data.css }
}
