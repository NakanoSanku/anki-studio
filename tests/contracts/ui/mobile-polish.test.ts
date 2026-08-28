import { describe, expect, it } from "vitest"

import { readSource } from "../helpers/source"

const aiSettings = readSource("components", "ai-settings-panel.tsx")
const codeEditor = readSource("components", "code-editor.tsx")
const sheet = readSource("components", "ui", "sheet.tsx")
const studySettings = readSource("components", "study-settings-panel.tsx")
const cardPreview = readSource("components", "card-preview.tsx")
const template = readSource("lib", "template.ts")

describe("mobile visual polish regressions", () => {
  it("keeps the prompt editor bounded with a fixed action dock and hidden variable scrollbar", () => {
    expect(aiSettings).toContain("h-[92dvh] max-h-[820px] min-h-0 flex-col gap-0 overflow-hidden")
    expect(aiSettings).toContain('data-testid="prompt-variable-rail"')
    expect(aiSettings).toContain("[scrollbar-width:none]")
    expect(aiSettings).toContain('editorClassName="!h-full !min-h-0 lg:!h-full"')
    expect(aiSettings).toContain('data-testid="prompt-editor-actions"')
    expect(aiSettings).toContain("pb-[max(0.75rem,env(safe-area-inset-bottom))]")
    expect(aiSettings).not.toContain("<SheetFooter")
  })

  it("lets bottom sheets honor explicit viewport heights instead of forcing height auto", () => {
    expect(sheet).toContain("fixed z-[70] flex min-h-0 flex-col")
    expect(sheet).not.toContain("data-[side=bottom]:h-auto")
  })

  it("lets full-height CodeMirror workspaces shrink between their chrome instead of covering actions", () => {
    expect(codeEditor).toContain("flex min-h-0 min-w-0 flex-col overflow-hidden")
    expect(codeEditor).toContain("flex shrink-0 items-center justify-between")
    expect(codeEditor).toContain("h-[300px] min-h-0 min-w-0 lg:h-[440px]")
    expect(codeEditor).toContain("[&_.cm-editor]:min-h-0")
    expect(codeEditor).toContain("[&_.cm-scroller]:overflow-auto")
    expect(codeEditor).toContain("[&_.cm-scroller]:overscroll-contain")
  })

  it("positions retention labels using the same numeric scale as the slider", () => {
    expect(studySettings).toContain("const RETENTION_MIN = 70")
    expect(studySettings).toContain("const RETENTION_MAX = 99")
    expect(studySettings).toContain("function retentionMarkPosition")
    expect(studySettings).toContain("(value - RETENTION_MIN) / (RETENTION_MAX - RETENTION_MIN)")
    expect(studySettings).toContain('data-testid="retention-scale"')
    expect(studySettings).toContain("data-retention-mark={mark.value}")
    expect(studySettings).not.toContain('mt-1 flex justify-between font-mono')
  })

  it("does not render a decorative dot inside the card preview canvas", () => {
    expect(cardPreview).toContain('title="Card preview"')
    expect(cardPreview).not.toContain("absolute left-4 top-4 z-10 size-2 rounded-full bg-energy")
  })

  it("prevents generated preview documents from overflowing horizontally", () => {
    expect(template).toContain("*, *::before, *::after")
    expect(template).toContain("box-sizing: border-box")
    expect(template).toContain("max-width: 100%")
    expect(template).toContain("overflow-x: hidden")
  })
})
