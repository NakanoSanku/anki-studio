import { readAiSettings, type AiSettings } from "./ai-settings"
import { withBrowserCorsHint } from "./ai-upstream"
import type { TtsField } from "./deck"

export type CardAiInput = {
  fields: string[]
  values: Record<string, string>
  notes?: Record<string, string>
  references?: Record<string, string>[]
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

export function formatReferenceNotes(
  fields: string[],
  notes: Array<Record<string, string>>
): string {
  if (notes.length === 0) return ""
  return notes
    .map((values, index) => {
      const lines = fields
        .map((field) => {
          const value = values[field]?.trim()
          return value ? `${field}: ${value}` : ""
        })
        .filter(Boolean)
      return `【${index + 1}】\n${lines.join("\n") || "（空）"}`
    })
    .join("\n\n")
}

export function referenceValuesForComplete(
  notes: Array<{ id: string; values: Record<string, string> }>,
  currentId: string
): Array<Record<string, string>> {
  return notes.filter((note) => note.id !== currentId).map((note) => note.values)
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

export type BatchAiInput = {
  topic: string
  count?: number
  fields: string[]
  existingKeys: string[]
  notes?: Record<string, string>
  references?: Record<string, string>[]
  settings?: AiSettings
}

export async function requestBatchAi(input: BatchAiInput): Promise<Record<string, string>[]> {
  const payload = withSettings(input)
  return withBrowserCorsHint(async () => (await import("./ai-run")).runBatchAi(payload))
}

export async function requestCardAi(input: CardAiInput): Promise<Record<string, string>> {
  const payload = withSettings(input)
  return withBrowserCorsHint(async () => (await import("./ai-run")).runCardAi(payload))
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
  return withBrowserCorsHint(async () => (await import("./ai-run")).runTemplateAi(payload))
}
