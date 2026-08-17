import { generateText, Output } from "ai"
import { z } from "zod"

import {
  formatCardContext,
  formatFieldNotes,
  formatTemplateFields,
  formatTtsFields,
  type BatchAiInput,
  type CardAiInput,
  type FieldAiInput,
  type TemplateAiInput,
  type TemplateAiResult,
} from "./ai"
import { resolveLanguageModel } from "./ai-model"
import { parseAiSettings, renderPrompt } from "./ai-settings"

export class AiRequestError extends Error {
  readonly status = 400
}

function requireFields(fields: unknown): string[] {
  if (!Array.isArray(fields) || fields.length === 0 || fields.some((field) => typeof field !== "string" || !field.trim())) {
    throw new AiRequestError("字段列表无效")
  }
  return [...new Set(fields.map((field) => field.trim()))]
}

function valuesSchema(fields: string[]) {
  const shape: Record<string, z.ZodString> = {}
  for (const field of fields) shape[field] = z.string()
  return z.object(shape)
}

const paneLabels = {
  front: "正面模板",
  back: "背面模板",
  css: "样式 CSS",
} as const

function unwrapCode(value: string): string {
  const trimmed = value.trim()
  const fenced = /^```(?:html|css|xml|text)?\s*([\s\S]*?)```$/i.exec(trimmed)
  return (fenced?.[1] ?? trimmed).replace(/\s+$/u, "")
}

export async function runTestAi(settingsRaw: unknown): Promise<void> {
  const { text } = await generateText({
    model: resolveLanguageModel(settingsRaw),
    prompt: "Reply with the single word OK.",
  })
  if (!text.trim()) throw new Error("模型没有返回内容")
}

export async function runFieldAi(body: FieldAiInput): Promise<string> {
  const { action, field, fields, values } = body
  if ((action !== "complete" && action !== "rewrite") || typeof field !== "string" || !fields?.includes(field)) {
    throw new AiRequestError("参数无效")
  }
  const uniqueFields = requireFields(fields)
  const settings = parseAiSettings(body.settings)
  const notes = body.notes ?? {}
  const context = formatCardContext(uniqueFields, values ?? {}, notes)
  const current = values?.[field]?.trim() ?? ""
  const vars = {
    field,
    current: current || "（空）",
    context,
    key: uniqueFields[0] ?? "",
    fields: uniqueFields.join("、"),
    note: notes[field]?.trim() || "（无）",
    notes: formatFieldNotes(uniqueFields, notes),
  }
  const prompt =
    action === "rewrite"
      ? renderPrompt(settings.fieldRewritePrompt, vars)
      : renderPrompt(settings.fieldCompletePrompt, vars)

  const { text } = await generateText({
    model: resolveLanguageModel(settings),
    system: settings.systemPrompt,
    prompt,
  })
  const next = text.trim()
  if (!next) throw new Error("AI 没有返回内容")
  return next
}

export async function runCardAi(body: CardAiInput): Promise<Record<string, string>> {
  const { action, fields, values } = body
  if (action !== "complete" && action !== "rewrite") throw new AiRequestError("参数无效")
  const uniqueFields = requireFields(fields)
  const current = values ?? {}
  const notes = body.notes ?? {}
  const context = formatCardContext(uniqueFields, current, notes)
  const settings = parseAiSettings(body.settings)
  const vars = {
    field: uniqueFields[0] ?? "",
    current: current[uniqueFields[0] ?? ""]?.trim() || "（空）",
    context,
    key: uniqueFields[0] ?? "",
    fields: uniqueFields.join("、"),
    note: notes[uniqueFields[0] ?? ""]?.trim() || "（无）",
    notes: formatFieldNotes(uniqueFields, notes),
  }
  const prompt =
    action === "rewrite"
      ? renderPrompt(settings.cardRewritePrompt, vars)
      : renderPrompt(settings.cardCompletePrompt, vars)

  const result = await generateText({
    model: resolveLanguageModel(settings),
    system: `${settings.systemPrompt}\n按给定字段返回 JSON 对象，值必须是字符串。`,
    prompt,
    output: Output.object({ schema: valuesSchema(uniqueFields) }),
  })
  const output = result.output
  if (!output) throw new Error("AI 没有返回有效结果")

  const next: Record<string, string> = { ...current }
  for (const field of uniqueFields) {
    const generated = output[field]?.trim() ?? ""
    if (action === "complete" && current[field]?.trim()) continue
    if (generated) next[field] = generated
  }
  return next
}

export async function runBatchAi(body: BatchAiInput): Promise<Record<string, string>[]> {
  const topic = typeof body.topic === "string" ? body.topic.trim() : ""
  const count = Number(body.count)
  const fields = requireFields(body.fields)
  const existingKeys = Array.isArray(body.existingKeys)
    ? body.existingKeys.filter((key) => typeof key === "string" && key.trim())
    : []

  if (!topic) throw new AiRequestError("请填写生成主题或词表")
  if (!Number.isFinite(count) || count < 1 || count > 50) {
    throw new AiRequestError("生成数量需要在 1 到 50 之间")
  }

  const settings = parseAiSettings(body.settings)
  const notes = body.notes ?? {}
  const prompt = renderPrompt(settings.batchPrompt, {
    topic,
    count: String(Math.floor(count)),
    fields: fields.join("、"),
    key: fields[0] ?? "",
    existing: existingKeys.length > 0 ? existingKeys.join("、") : "（无）",
    field: fields[0] ?? "",
    current: "",
    context: formatFieldNotes(fields, notes),
    note: notes[fields[0] ?? ""]?.trim() || "（无）",
    notes: formatFieldNotes(fields, notes),
  })

  const result = await generateText({
    model: resolveLanguageModel(settings),
    system: `${settings.systemPrompt}\n返回 JSON，cards 是对象数组，每个对象的键必须是这些字段：${fields.join("、")}。`,
    prompt,
    output: Output.object({
      schema: z.object({ cards: z.array(valuesSchema(fields)) }),
    }),
  })

  const cards = result.output?.cards ?? []
  if (cards.length === 0) throw new Error("AI 没有返回卡片")
  return cards.map((card) => {
    const values: Record<string, string> = {}
    for (const field of fields) values[field] = card[field]?.trim() ?? ""
    return values
  })
}

export async function runTemplateAi(body: TemplateAiInput): Promise<TemplateAiResult> {
  const instruction = typeof body.instruction === "string" ? body.instruction.trim() : ""
  if (!instruction) throw new AiRequestError("请填写修改说明")
  if (instruction.length > 2000) throw new AiRequestError("修改说明过长")
  if (body.pane !== "front" && body.pane !== "back" && body.pane !== "css") {
    throw new AiRequestError("参数无效")
  }
  if (body.target !== "current" && body.target !== "html" && body.target !== "all") {
    throw new AiRequestError("参数无效")
  }

  const fields = requireFields(body.fields)
  const settings = parseAiSettings(body.settings)
  const notes = body.notes ?? {}
  const fieldTts = body.fieldTts ?? {}
  const front = typeof body.front === "string" ? body.front : ""
  const back = typeof body.back === "string" ? body.back : ""
  const css = typeof body.css === "string" ? body.css : ""
  const current = body.pane === "front" ? front : body.pane === "back" ? back : css

  const prompt = renderPrompt(settings.templateEditPrompt, {
    instruction,
    pane: paneLabels[body.pane],
    current: current || "（空）",
    fields: formatTemplateFields(fields, fieldTts),
    notes: formatFieldNotes(fields, notes),
    tts: formatTtsFields(fieldTts),
    sample: typeof body.sample === "string" && body.sample.trim() ? body.sample : "（无）",
    front: front || "（空）",
    back: back || "（空）",
    css: css || "（空）",
    field: "",
    key: fields[0] ?? "",
    note: "",
    context: "",
    topic: "",
    count: "",
    existing: "",
  })

  const result = await generateText({
    model: resolveLanguageModel(settings),
    system: `${settings.systemPrompt}\n返回 JSON，键必须是 front、back、css，值是完整模板字符串。`,
    prompt,
    output: Output.object({
      schema: z.object({
        front: z.string(),
        back: z.string(),
        css: z.string(),
      }),
    }),
  })

  const output = result.output
  if (!output) throw new Error("AI 没有返回有效结果")

  const nextFront = unwrapCode(output.front)
  const nextBack = unwrapCode(output.back)
  const nextCss = unwrapCode(output.css)
  return {
    front: body.target === "current" && body.pane !== "front" ? front : nextFront || front,
    back: body.target === "current" && body.pane !== "back" ? back : nextBack || back,
    css:
      body.target === "html" || (body.target === "current" && body.pane !== "css")
        ? css
        : nextCss || css,
  }
}

export function aiRouteError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback
  const status = error instanceof AiRequestError ? 400 : 502
  return Response.json({ error: message }, { status })
}
