import { createOpenAICompatible } from "@ai-sdk/openai-compatible"

import { parseAiSettings, validateAiSettings } from "./ai-settings"
import { providerFetch } from "./ai-upstream"

export function resolveLanguageModel(raw: unknown) {
  const settings = parseAiSettings(raw)
  const error = validateAiSettings(settings)
  if (error) throw new Error(error)

  const provider = createOpenAICompatible({
    name: "custom",
    apiKey: settings.apiKey.trim() || undefined,
    baseURL: settings.baseURL.trim().replace(/\/$/, ""),
    fetch: providerFetch,
  })
  return provider(settings.model.trim())
}
