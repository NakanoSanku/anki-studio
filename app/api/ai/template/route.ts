import { generateText, Output } from "ai"
import { z } from "zod"

import {
  formatFieldNotes,
  formatTemplateFields,
  formatTtsFields,
  type TemplateAiInput,
} from "@/lib/ai"
import { resolveLanguageModel } from "@/lib/ai-model"
import { parseAiSettings, renderPrompt } from "@/lib/ai-settings"

const MAX_INSTRUCTION = 2000

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

export async function POST(request: Request) {
  let body: TemplateAiInput
  try {
    body = (await request.json()) as TemplateAiInput
  } catch {
    return Response.json({ error: "请求无效" }, { status: 400 })
  }

  const instruction = typeof body.instruction === "string" ? body.instruction.trim() : ""
  if (!instruction) return Response.json({ error: "请填写修改说明" }, { status: 400 })
  if (instruction.length > MAX_INSTRUCTION) {
    return Response.json({ error: "修改说明过长" }, { status: 400 })
  }
  if (body.pane !== "front" && body.pane !== "back" && body.pane !== "css") {
    return Response.json({ error: "参数无效" }, { status: 400 })
  }
  if (body.target !== "current" && body.target !== "html" && body.target !== "all") {
    return Response.json({ error: "参数无效" }, { status: 400 })
  }
  if (!Array.isArray(body.fields) || body.fields.some((field) => typeof field !== "string" || !field.trim())) {
    return Response.json({ error: "字段列表无效" }, { status: 400 })
  }

  const fields = [...new Set(body.fields.map((field) => field.trim()))]
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

  try {
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
    if (!output) {
      return Response.json({ error: "AI 没有返回有效结果" }, { status: 502 })
    }

    const nextFront = unwrapCode(output.front)
    const nextBack = unwrapCode(output.back)
    const nextCss = unwrapCode(output.css)

    return Response.json({
      front: body.target === "current" && body.pane !== "front" ? front : nextFront || front,
      back: body.target === "current" && body.pane !== "back" ? back : nextBack || back,
      css:
        body.target === "html" || (body.target === "current" && body.pane !== "css")
          ? css
          : nextCss || css,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "模板生成失败"
    return Response.json({ error: message }, { status: 502 })
  }
}
