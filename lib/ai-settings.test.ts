import { describe, expect, it } from "vitest"

import { DEFAULT_BATCH_PROMPT, parseAiSettings } from "./ai-settings"

describe("parseAiSettings", () => {
  it("fills supported prompts and ignores removed legacy prompts", () => {
    const settings = parseAiSettings({
      model: "demo",
      apiKey: "",
      baseURL: "https://example.com/v1",
      fieldCompletePrompt: "legacy field completion",
      fieldRewritePrompt: "legacy field rewrite",
      cardRewritePrompt: "legacy card rewrite",
    })
    expect(settings.batchPrompt).toBe(DEFAULT_BATCH_PROMPT)
    expect(settings.model).toBe("demo")
    expect(settings).not.toHaveProperty("fieldCompletePrompt")
    expect(settings).not.toHaveProperty("fieldRewritePrompt")
    expect(settings).not.toHaveProperty("cardRewritePrompt")
  })
})
