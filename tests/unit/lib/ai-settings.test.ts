import { describe, expect, it } from "vitest"

import {
  applyPromptWithReferences,
  DEFAULT_BATCH_PROMPT,
  DEFAULT_CARD_COMPLETE_PROMPT,
  DEFAULT_SYSTEM_PROMPT,
  parseAiSettings,
} from "@/lib/ai-settings"

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

  it("ships English default prompts", () => {
    expect(DEFAULT_SYSTEM_PROMPT).toContain("Anki vocabulary cards")
    expect(DEFAULT_CARD_COMPLETE_PROMPT).toContain("Fill only the fields")
    expect(DEFAULT_BATCH_PROMPT).toContain("Generate {{count}} unique vocabulary cards")
  })
})

describe("applyPromptWithReferences", () => {
  it("fills the placeholder in the default complete prompt", () => {
    const prompt = applyPromptWithReferences(
      DEFAULT_CARD_COMPLETE_PROMPT,
      { notes: "None", context: "Word: foo" },
      "[1]\nWord: bar"
    )
    expect(prompt).toContain("[1]\nWord: bar")
    expect(prompt).not.toContain("{{references}}")
  })

  it("appends an English references block when a custom prompt has no placeholder", () => {
    const prompt = applyPromptWithReferences(
      "Fill only empty fields.\n{{context}}",
      { context: "Word: foo" },
      "[1]\nWord: bar"
    )
    expect(prompt.startsWith("Fill only empty fields.\nWord: foo")).toBe(true)
    expect(prompt).toContain("Reference notes (match style, do not copy entries):")
    expect(prompt).toContain("[1]\nWord: bar")
  })

  it("does not append a block when there are no reference notes", () => {
    const prompt = applyPromptWithReferences("Fill only empty fields.", {}, "")
    expect(prompt).toBe("Fill only empty fields.")
  })
})
