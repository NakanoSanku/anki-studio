import { describe, expect, it } from "vitest"

import {
  applyPromptWithReferences,
  DEFAULT_BATCH_PROMPT,
  DEFAULT_CARD_COMPLETE_PROMPT,
  parseAiSettings,
} from "./ai-settings"

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

describe("applyPromptWithReferences", () => {
  it("fills the placeholder in the default complete prompt", () => {
    const prompt = applyPromptWithReferences(
      DEFAULT_CARD_COMPLETE_PROMPT,
      { notes: "无", context: "Word: foo" },
      "【1】\nWord: bar"
    )
    expect(prompt).toContain("【1】\nWord: bar")
    expect(prompt).not.toContain("{{references}}")
  })

  it("appends a references block when a custom prompt has no placeholder", () => {
    const prompt = applyPromptWithReferences(
      "只补全空字段。\n{{context}}",
      { context: "Word: foo" },
      "【1】\nWord: bar"
    )
    expect(prompt.startsWith("只补全空字段。\nWord: foo")).toBe(true)
    expect(prompt).toContain("参考笔记（学写法，不要照抄词条）：")
    expect(prompt).toContain("【1】\nWord: bar")
  })

  it("does not append a block when there are no reference notes", () => {
    const prompt = applyPromptWithReferences("只补全空字段。", {}, "")
    expect(prompt).toBe("只补全空字段。")
  })
})
