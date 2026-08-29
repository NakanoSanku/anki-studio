import { parseAiSettings, validateAiSettings } from "./ai-settings"
import { describeUpstreamError, providerFetch, withProviderTimeout } from "./ai-upstream"

export async function completeChat(input: {
  settings: unknown
  system?: string
  prompt: string
  signal?: AbortSignal
}): Promise<string> {
  const settings = parseAiSettings(input.settings)
  const invalid = validateAiSettings(settings)
  if (invalid) throw new Error(invalid)

  const endpoint = `${settings.baseURL.trim().replace(/\/$/, "")}/chat/completions`
  const headers: HeadersInit = {
    Accept: "application/json",
    "Content-Type": "application/json",
  }
  if (settings.apiKey.trim()) {
    headers.Authorization = `Bearer ${settings.apiKey.trim()}`
  }

  const messages: { role: "system" | "user"; content: string }[] = []
  if (input.system?.trim()) messages.push({ role: "system", content: input.system })
  messages.push({ role: "user", content: input.prompt })

  return withProviderTimeout(async (signal) => {
    const response = await providerFetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: settings.model.trim(),
        temperature: 0.7,
        messages,
      }),
      signal,
    })
    const body = await response.text()
    if (!response.ok) {
      throw new Error(
        describeUpstreamError({
          status: response.status,
          body,
          cfRay: response.headers.get("cf-ray"),
        })
      )
    }

    let payload: unknown = null
    try {
      payload = body ? JSON.parse(body) : null
    } catch {
      throw new Error("The provider did not return JSON")
    }

    const text = readChatText(payload)
    if (!text) throw new Error("The model returned no content")
    return text
  }, input.signal)
}

export async function completeJson(input: {
  settings: unknown
  system?: string
  prompt: string
  signal?: AbortSignal
}): Promise<unknown> {
  const system = [input.system?.trim(), "只返回 JSON 对象，不要 markdown，不要解释。"]
    .filter(Boolean)
    .join("\n")
  const text = await completeChat({
    settings: input.settings,
    system,
    prompt: input.prompt,
    signal: input.signal,
  })
  const parsed = parseJsonPayload(text)
  if (parsed === undefined) throw new Error("AI 没有返回有效 JSON")
  return parsed
}

export function parseJsonPayload(text: string): unknown {
  const trimmed = text.trim()
  if (!trimmed) return undefined
  const fenced = /^```(?:json)?\s*([\s\S]*?)```$/i.exec(trimmed)
  const raw = (fenced?.[1] ?? trimmed).trim()
  try {
    return JSON.parse(raw)
  } catch {
    return parseEmbeddedJson(raw)
  }
}

export function pickFieldValues(parsed: unknown, fields: string[]): Record<string, string> {
  const root = asRecord(parsed)
  const nested = asRecord(root.values)
  const source = fields.some((field) => typeof root[field] === "string") ? root : nested
  const next: Record<string, string> = {}
  for (const field of fields) {
    const value = source[field]
    next[field] = typeof value === "string" ? value.trim() : ""
  }
  return next
}

export function pickCardList(parsed: unknown, fields: string[]): Record<string, string>[] {
  return jsonCardItems(parsed).map((item) => pickFieldValues(item, fields))
}

function jsonCardItems(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) return parsed
  const cards = asRecord(parsed).cards
  return Array.isArray(cards) ? cards : []
}

export function readChatText(payload: unknown): string {
  const choices = asRecord(payload).choices
  const choice = Array.isArray(choices) ? choices[0] : null
  const record = asRecord(choice)
  const message = asRecord(record.message)
  const content = message.content
  if (typeof content === "string" && content.trim()) return content.trim()
  if (Array.isArray(content)) {
    const text = content
      .map((part) => {
        if (typeof part === "string") return part
        const value = asRecord(part).text
        return typeof value === "string" ? value : ""
      })
      .join("")
      .trim()
    if (text) return text
  }
  return typeof record.text === "string" ? record.text.trim() : ""
}

function parseEmbeddedJson(raw: string): unknown {
  const objectStart = raw.indexOf("{")
  const objectEnd = raw.lastIndexOf("}")
  if (objectStart >= 0 && objectEnd > objectStart) {
    try {
      return JSON.parse(raw.slice(objectStart, objectEnd + 1))
    } catch {
      // try array next
    }
  }
  const arrayStart = raw.indexOf("[")
  const arrayEnd = raw.lastIndexOf("]")
  if (arrayStart >= 0 && arrayEnd > arrayStart) {
    try {
      return JSON.parse(raw.slice(arrayStart, arrayEnd + 1))
    } catch {
      return undefined
    }
  }
  return undefined
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}
