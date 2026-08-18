import { describe, expect, it } from "vitest"

import { DEFAULT_CARD_AUDIT_PROMPT, parseAiSettings } from "./ai-settings"

describe("parseAiSettings", () => {
  it("fills the audit prompt when older settings omit it", () => {
    const settings = parseAiSettings({
      model: "demo",
      apiKey: "",
      baseURL: "https://example.com/v1",
    })
    expect(settings.cardAuditPrompt).toBe(DEFAULT_CARD_AUDIT_PROMPT)
    expect(settings.model).toBe("demo")
  })
})
