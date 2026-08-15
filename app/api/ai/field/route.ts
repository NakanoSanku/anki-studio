import { generateText } from "ai"

import { formatCardContext, formatFieldNotes, type FieldAiInput } from "@/lib/ai"
import { resolveLanguageModel } from "@/lib/ai-model"
import { parseAiSettings, renderPrompt } from "@/lib/ai-settings"

export async function POST(request: Request) {
  let body: FieldAiInput
  try {
    body = (await request.json()) as FieldAiInput
  } catch {
    return Response.json({ error: "请求无效" }, { status: 400 })
  }

  const { action, field, fields, values } = body
  if (
    (action !== "complete" && action !== "rewrite") ||
    typeof field !== "string" ||
    !Array.isArray(fields) ||
    fields.length === 0 ||
    !fields.includes(field)
  ) {
    return Response.json({ error: "参数无效" }, { status: 400 })
  }

  const settings = parseAiSettings(body.settings)
  const notes = body.notes ?? {}
  const context = formatCardContext(fields, values ?? {}, notes)
  const current = values?.[field]?.trim() ?? ""
  const vars = {
    field,
    current: current || "（空）",
    context,
    key: fields[0] ?? "",
    fields: fields.join("、"),
    note: notes[field]?.trim() || "（无）",
    notes: formatFieldNotes(fields, notes),
  }
  const prompt =
    action === "rewrite"
      ? renderPrompt(settings.fieldRewritePrompt, vars)
      : renderPrompt(settings.fieldCompletePrompt, vars)

  try {
    const { text } = await generateText({
      model: resolveLanguageModel(settings),
      system: settings.systemPrompt,
      prompt,
    })

    const next = text.trim()
    if (!next) {
      return Response.json({ error: "AI 没有返回内容" }, { status: 502 })
    }
    return Response.json({ text: next })
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI 调用失败"
    return Response.json({ error: message }, { status: 502 })
  }
}
