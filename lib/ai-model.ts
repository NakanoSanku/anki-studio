import { createOpenAICompatible } from "@ai-sdk/openai-compatible"

import { parseAiSettings, validateAiSettings } from "./ai-settings"

export function resolveLanguageModel(raw: unknown) {
  const settings = parseAiSettings(raw)
  const error = validateAiSettings(settings)
  if (error) throw new Error(error)

  const provider = createOpenAICompatible({
    name: "custom",
    apiKey: settings.apiKey.trim() || undefined,
    baseURL: settings.baseURL.trim().replace(/\/$/, ""),
  })
  return provider(settings.model.trim())
}
