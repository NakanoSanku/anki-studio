import { describe, expect, it } from "vitest"

import { readSource } from "../helpers/source"

const aiSettings = readSource("components", "ai-settings-panel.tsx")
const codeEditor = readSource("components", "code-editor.tsx")
const dialog = readSource("components", "ui", "dialog.tsx")
const sheet = readSource("components", "ui", "sheet.tsx")
const studySettings = readSource("components", "study-settings-panel.tsx")
const textarea = readSource("components", "ui", "textarea.tsx")
const cardPreview = readSource("components", "card-preview.tsx")
const googleAccount = readSource("components", "google-account-panel.tsx")
const googleSheets = readSource("components", "google-sheet-picker-panel.tsx")
const settingsForm = readSource("components", "settings-form.tsx")
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

  it("keeps compact dialogs inside iPhone-width viewports", () => {
    expect(dialog).toContain("grid min-w-0 w-full max-h-[calc(100dvh-1.5rem)]")
    expect(dialog).toContain("overflow-x-hidden")
    expect(dialog).toContain("overflow-y-auto")
    expect(dialog).toContain("[&>*]:min-w-0")
    expect(dialog).toContain("p-4")
    expect(dialog).toContain("min-[400px]:p-5")
    expect(textarea).toContain("min-w-0 w-full max-w-full resize-y")
  })

  it("keeps the connected sync surface focused on account, destination, and sync action", () => {
    expect(settingsForm).toContain("mx-auto max-w-2xl space-y-2.5")
    expect(settingsForm).toContain("Sync status")
    expect(googleAccount).toContain("Google connected")
    expect(googleAccount).not.toContain("Sheets authorized")
    expect(googleAccount).not.toContain("Ready to sync")
    expect(googleSheets).toContain("Sync destination")
    expect(googleSheets).toContain("Open spreadsheet")
    expect(googleSheets).not.toContain("Inventory")
    expect(googleSheets).not.toContain("Check structure")
    expect(googleSheets).not.toContain("Google Drive <ExternalLink")
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

  it("keeps the retention slider free of scale labels", () => {
    expect(studySettings).toContain("const RETENTION_MIN = 70")
    expect(studySettings).toContain("const RETENTION_MAX = 99")
    expect(studySettings).not.toContain("RETENTION_MARKS")
    expect(studySettings).not.toContain("retentionMarkPosition")
    expect(studySettings).not.toContain('data-testid="retention-scale"')
    expect(studySettings).not.toContain("data-retention-mark")
  })

  it("does not render a decorative dot inside the card preview canvas", () => {
    expect(cardPreview).toContain('title="Card preview"')
    expect(cardPreview).not.toContain("absolute left-4 top-4 z-10 size-2 rounded-full bg-energy")
  })

  it("renders preview TTS controls inside the card using the Study button treatment", () => {
    expect(cardPreview).toContain("data-preview-tts")
    expect(cardPreview).toContain('sandbox="allow-same-origin"')
    expect(cardPreview).toContain("getTtsClip")
    expect(cardPreview).toContain("playTtsAudio")
    expect(cardPreview).toContain("background:#e8f3ff;color:#194f83")
    expect(cardPreview).not.toContain("TtsPlayButton")
    expect(cardPreview).not.toContain("ttsFieldsOnSide")
    expect(cardPreview).not.toContain(">Audio</span>")
  })

  it("lets viewport previews use the whole page instead of nesting another card shell", () => {
    expect(cardPreview).toContain("h-[calc(100dvh-5.75rem)]")
    expect(cardPreview).toContain("rounded-none border-0 bg-transparent p-0 shadow-none")
    expect(cardPreview).toContain('fillViewport ? "flex-1 rounded-[20px]"')
  })

  it("prevents generated preview documents from overflowing horizontally", () => {
    expect(template).toContain("*, *::before, *::after")
    expect(template).toContain("box-sizing: border-box")
    expect(template).toContain("max-width: 100%")
    expect(template).toContain("overflow-x: hidden")
  })
})
