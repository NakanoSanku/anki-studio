import { z } from "zod"

import {
  formatCardContext,
  formatFieldNotes,
  formatReferenceNotes,
  formatTemplateFields,
  formatTtsFields,
  type BatchAiInput,
  type CardAiInput,
  type TemplateAiInput,
  type TemplateAiResult,
} from "./ai"
import { completeChat, completeJson, pickCardList, pickFieldValues } from "./ai-compat"
import { applyPromptWithReferences, parseAiSettings, renderPrompt } from "./ai-settings"

export class AiRequestError extends Error {
  readonly status = 400
}

function requireFields(fields: unknown): string[] {
  if (!Array.isArray(fields) || fields.length === 0 || fields.some((field) => typeof field !== "string" || !field.trim())) {
    throw new AiRequestError("字段列表无效")
  }
  return [...new Set(fields.map((field) => field.trim()))]
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
  const text = await completeChat({
    settings: settingsRaw,
    prompt: "Reply with the single word OK.",
  })
  if (!text.trim()) throw new Error("模型没有返回内容")
}

export async function runCardAi(body: CardAiInput): Promise<Record<string, string>> {
  const { fields, values } = body
  const uniqueFields = requireFields(fields)
  const current = values ?? {}
  const emptyFields = uniqueFields.filter((field) => !current[field]?.trim())
  if (emptyFields.length === 0) {
    throw new AiRequestError("这张卡片没有需要补全的空字段")
  }
  const notes = body.notes ?? {}
  const context = formatCardContext(uniqueFields, current, notes)
  const settings = parseAiSettings(body.settings)
  const prompt = applyPromptWithReferences(
    settings.cardCompletePrompt,
    {
      context,
      key: uniqueFields[0] ?? "",
      fields: uniqueFields.join("、"),
      notes: formatFieldNotes(uniqueFields, notes),
    },
    formatReferenceNotes(uniqueFields, body.references ?? [])
  )

  const parsed = await completeJson({
    settings,
    system: `${settings.systemPrompt}\n按给定字段返回 JSON 对象，值必须是字符串。`,
    prompt,
  })
  const output = pickFieldValues(parsed, uniqueFields)

  const next: Record<string, string> = {}
  for (const field of emptyFields) {
    const generated = output[field] ?? ""
    if (generated) next[field] = generated
  }
  if (Object.keys(next).length === 0) throw new Error("AI 没有返回可补全内容")
  return next
}

export async function runBatchAi(body: BatchAiInput): Promise<Record<string, string>[]> {
  const topic = typeof body.topic === "string" ? body.topic.trim() : ""
  const count = body.count == null ? null : Number(body.count)
  const fields = requireFields(body.fields)
  const existingKeys = Array.isArray(body.existingKeys)
    ? body.existingKeys.filter((key) => typeof key === "string" && key.trim())
    : []

  if (!topic) throw new AiRequestError("请填写关联信息")
  if (count !== null && (!Number.isFinite(count) || count < 1 || count > 50)) {
    throw new AiRequestError("生成数量需要在 1 到 50 之间")
  }

  const amountRule = count === null
    ? "as many distinct, useful notes as the source material supports, up to 50; do not pad the result or omit clear standalone items just to satisfy a quota"
    : String(Math.floor(count))
  const settings = parseAiSettings(body.settings)
  const notes = body.notes ?? {}
  const prompt = applyPromptWithReferences(
    settings.batchPrompt,
    {
      topic,
      count: amountRule,
      fields: fields.join("、"),
      key: fields[0] ?? "",
      existing: existingKeys.length > 0 ? existingKeys.join("、") : "（无）",
      field: fields[0] ?? "",
      current: "",
      context: formatFieldNotes(fields, notes),
      note: notes[fields[0] ?? ""]?.trim() || "（无）",
      notes: formatFieldNotes(fields, notes),
    },
    formatReferenceNotes(fields, body.references ?? [])
  )

  const parsed = await completeJson({
    settings,
    system: `${settings.systemPrompt}\n返回 JSON，cards 是对象数组，每个对象的键必须是这些字段：${fields.join("、")}。`,
    prompt,
  })
  const cards = pickCardList(parsed, fields)
  if (cards.length === 0) throw new Error("AI 没有返回卡片")
  const limit = count === null ? 50 : Math.floor(count)
  return cards.slice(0, limit)
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
    references: "",
  })

  const parsed = await completeJson({
    settings,
    system: `${settings.systemPrompt}\n返回 JSON，键必须是 front、back、css，值是完整模板字符串。`,
    prompt,
  })
  const output = z
    .object({
      front: z.string().optional(),
      back: z.string().optional(),
      css: z.string().optional(),
    })
    .safeParse(parsed)
  if (!output.success) throw new Error("AI 没有返回有效结果")

  const nextFront = unwrapCode(output.data.front ?? "")
  const nextBack = unwrapCode(output.data.back ?? "")
  const nextCss = unwrapCode(output.data.css ?? "")
  return {
    front: body.target === "current" && body.pane !== "front" ? front : nextFront || front,
    back: body.target === "current" && body.pane !== "back" ? back : nextBack || back,
    css:
      body.target === "html" || (body.target === "current" && body.pane !== "css")
        ? css
        : nextCss || css,
  }
}
