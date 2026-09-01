import { parseAiSettings, validateAiSettings, type AiSettings } from "./ai-settings"
import {
  describeUpstreamError,
  GEMINI_API_CLIENT,
  isGeminiNativeEndpoint,
  providerFetch,
  withProviderTimeout,
} from "./ai-upstream"

type CompletionInput = {
  settings: unknown
  system?: string
  prompt: string
  signal?: AbortSignal
}

export async function completeChat(input: CompletionInput): Promise<string> {
  return completeText(input, false)
}

export async function completeJson(input: CompletionInput): Promise<unknown> {
  const system = [input.system?.trim(), "只返回 JSON 对象，不要 markdown，不要解释。"]
    .filter(Boolean)
    .join("\n")
  const text = await completeText({ ...input, system }, true)
  const parsed = parseJsonPayload(text)
  if (parsed === undefined) throw new Error("AI 没有返回有效 JSON")
  return parsed
}

async function completeText(input: CompletionInput, jsonMode: boolean): Promise<string> {
  const settings = parseAiSettings(input.settings)
  const invalid = validateAiSettings(settings)
  if (invalid) throw new Error(invalid)

  if (isGeminiNativeEndpoint(settings.baseURL)) {
    return completeGeminiInteraction(settings, input, jsonMode)
  }
  return completeOpenAiChat(settings, input)
}

async function completeOpenAiChat(settings: AiSettings, input: CompletionInput): Promise<string> {
  const endpoint = `${settings.baseURL.trim().replace(/\/$/, "")}/chat/completions`
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  }
  if (settings.apiKey.trim()) {
    headers.Authorization = `Bearer ${settings.apiKey.trim()}`
  }

  const messages: { role: "system" | "user"; content: string }[] = []
  if (input.system?.trim()) messages.push({ role: "system", content: input.system })
  messages.push({ role: "user", content: input.prompt })

  return requestCompletion(
    endpoint,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: settings.model.trim(),
        temperature: 0.7,
        messages,
      }),
    },
    input.signal
  )
}

async function completeGeminiInteraction(
  settings: AiSettings,
  input: CompletionInput,
  jsonMode: boolean
): Promise<string> {
  const endpoint = `${settings.baseURL.trim().replace(/\/$/, "")}/interactions`
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "x-goog-api-client": GEMINI_API_CLIENT,
  }
  if (settings.apiKey.trim()) headers["x-goog-api-key"] = settings.apiKey.trim()

  const requestBody: Record<string, unknown> = {
    model: settings.model.trim().replace(/^models\//, ""),
    input: input.prompt,
    store: false,
  }
  if (input.system?.trim()) requestBody.system_instruction = input.system.trim()
  if (jsonMode) {
    requestBody.response_format = {
      type: "text",
      mime_type: "application/json",
    }
  }

  return requestCompletion(
    endpoint,
    {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody),
    },
    input.signal
  )
}

async function requestCompletion(
  endpoint: string,
  init: RequestInit,
  externalSignal?: AbortSignal
): Promise<string> {
  return withProviderTimeout(async (signal) => {
    const response = await providerFetch(endpoint, { ...init, signal })
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
  }, externalSignal)
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
  const root = asRecord(payload)
  const choices = root.choices
  const choice = Array.isArray(choices) ? choices[0] : null
  const record = asRecord(choice)
  const message = asRecord(record.message)
  const content = message.content
  if (typeof content === "string" && content.trim()) return content.trim()
  if (Array.isArray(content)) {
    const text = readTextParts(content)
    if (text) return text
  }
  if (typeof record.text === "string" && record.text.trim()) return record.text.trim()

  if (typeof root.output_text === "string" && root.output_text.trim()) return root.output_text.trim()
  const steps = Array.isArray(root.steps) ? root.steps : []
  for (let index = steps.length - 1; index >= 0; index -= 1) {
    const step = asRecord(steps[index])
    if (step.type !== "model_output" || !Array.isArray(step.content)) continue
    const text = readTextParts(step.content)
    if (text) return text
  }

  const candidates = Array.isArray(root.candidates) ? root.candidates : []
  const candidate = asRecord(candidates[0])
  const candidateContent = asRecord(candidate.content).parts
  return Array.isArray(candidateContent) ? readTextParts(candidateContent) : ""
}

function readTextParts(parts: unknown[]): string {
  return parts
    .map((part) => {
      if (typeof part === "string") return part
      const value = asRecord(part).text
      return typeof value === "string" ? value : ""
    })
    .join("")
    .trim()
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
