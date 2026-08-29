import { describe, expect, it } from "vitest"

import { readSource } from "../helpers/source"

const overview = readSource("components", "settings-overview.tsx")
const form = readSource("components", "settings-form.tsx")
const ai = readSource("components", "ai-settings-panel.tsx")
const gemini = readSource("components", "gemini-live-setup.tsx")
const template = readSource("components", "template-editor.tsx")

const cjk = /[\u3400-\u9fff]/u

describe("compact settings hierarchy", () => {
  it("keeps the settings overview to destinations and current values", () => {
    expect(overview).not.toContain("Tune the way you learn")
    expect(overview).not.toContain("Local first")
    expect(overview).not.toContain("Private by default")
    expect(overview).not.toContain("FolderCog")
    expect(overview).not.toContain("BrainCircuit")
    expect(form).not.toContain("<Icon")
  })

  it("keeps AI settings compact without marketing copy or prompt decorations", () => {
    expect(ai).not.toContain("A quiet AI assistant")
    expect(ai).not.toContain("Connect an OpenAI-compatible endpoint")
    expect(ai).not.toContain("Using default prompt")
    expect(ai).not.toContain("WandSparkles")
    expect(ai).toContain(">Provider</h2>")
    expect(ai).toContain(">Prompts</h2>")
    expect(gemini).toContain('data-testid="gemini-live-compact"')
  })

  it("uses a compact highlighted AI action in the template editor", () => {
    expect(template).toContain(">Ask AI</Button>")
    expect(template).toContain("border-energy/30 bg-energy/15")
    expect(template).not.toContain(">AI edit</Button>")
  })

  it("keeps settings UI source free of Chinese interface copy", () => {
    expect(overview).not.toMatch(cjk)
    expect(form).not.toMatch(cjk)
    expect(ai).not.toMatch(cjk)
    expect(gemini).not.toMatch(cjk)
  })
})
