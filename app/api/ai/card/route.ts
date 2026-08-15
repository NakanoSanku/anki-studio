import { generateText, Output } from "ai"
import { z } from "zod"

import { formatCardContext, formatFieldNotes, type CardAiInput } from "@/lib/ai"
import { resolveLanguageModel } from "@/lib/ai-model"
import { parseAiSettings, renderPrompt } from "@/lib/ai-settings"

function valuesSchema(fields: string[]) {
  const shape: Record<string, z.ZodString> = {}
  for (const field of fields) {
    shape[field] = z.string()
  }
  return z.object(shape)
}

export async function POST(request: Request) {
  let body: CardAiInput
  try {
    body = (await request.json()) as CardAiInput
  } catch {
    return Response.json({ error: "请求无效" }, { status: 400 })
  }

  const { action, fields, values } = body
  if (
    (action !== "complete" && action !== "rewrite") ||
    !Array.isArray(fields) ||
    fields.length === 0 ||
    fields.some((field) => typeof field !== "string" || !field.trim())
  ) {
    return Response.json({ error: "参数无效" }, { status: 400 })
  }

  const uniqueFields = [...new Set(fields)]
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

  try {
    const result = await generateText({
      model: resolveLanguageModel(settings),
      system: `${settings.systemPrompt}\n按给定字段返回 JSON 对象，值必须是字符串。`,
      prompt,
      output: Output.object({
        schema: valuesSchema(uniqueFields),
      }),
    })

    const output = result.output
    if (!output) {
      return Response.json({ error: "AI 没有返回有效结果" }, { status: 502 })
    }

    const next: Record<string, string> = { ...current }
    for (const field of uniqueFields) {
      const generated = output[field]?.trim() ?? ""
      if (action === "complete" && current[field]?.trim()) {
        continue
      }
      if (generated) {
        next[field] = generated
      }
    }

    return Response.json({ values: next })
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI 调用失败"
    return Response.json({ error: message }, { status: 502 })
  }
}
