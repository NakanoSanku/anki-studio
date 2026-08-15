import { generateText, Output } from "ai"
import { z } from "zod"

import { formatFieldNotes, type BatchAiInput } from "@/lib/ai"
import { resolveLanguageModel } from "@/lib/ai-model"
import { parseAiSettings, renderPrompt } from "@/lib/ai-settings"

function cardSchema(fields: string[]) {
  const shape: Record<string, z.ZodString> = {}
  for (const field of fields) {
    shape[field] = z.string()
  }
  return z.object(shape)
}

export async function POST(request: Request) {
  let body: BatchAiInput
  try {
    body = (await request.json()) as BatchAiInput
  } catch {
    return Response.json({ error: "请求无效" }, { status: 400 })
  }

  const topic = typeof body.topic === "string" ? body.topic.trim() : ""
  const count = Number(body.count)
  const fields = Array.isArray(body.fields) ? [...new Set(body.fields.filter((field) => typeof field === "string" && field.trim()))] : []
  const existingKeys = Array.isArray(body.existingKeys)
    ? body.existingKeys.filter((key) => typeof key === "string" && key.trim())
    : []

  if (!topic) {
    return Response.json({ error: "请填写生成主题或词表" }, { status: 400 })
  }
  if (!Number.isFinite(count) || count < 1 || count > 50) {
    return Response.json({ error: "生成数量需要在 1 到 50 之间" }, { status: 400 })
  }
  if (fields.length === 0) {
    return Response.json({ error: "字段列表无效" }, { status: 400 })
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

  try {
    const result = await generateText({
      model: resolveLanguageModel(settings),
      system: `${settings.systemPrompt}\n返回 JSON，cards 是对象数组，每个对象的键必须是这些字段：${fields.join("、")}。`,
      prompt,
      output: Output.object({
        schema: z.object({
          cards: z.array(cardSchema(fields)),
        }),
      }),
    })

    const cards = result.output?.cards ?? []
    if (cards.length === 0) {
      return Response.json({ error: "AI 没有返回卡片" }, { status: 502 })
    }

    return Response.json({
      cards: cards.map((card) => {
        const values: Record<string, string> = {}
        for (const field of fields) {
          values[field] = card[field]?.trim() ?? ""
        }
        return values
      }),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "批量生成失败"
    return Response.json({ error: message }, { status: 502 })
  }
}
