import { describe, expect, it } from "vitest"

import { readSource } from "../helpers/source"

const appShell = readSource("components", "app-shell.tsx")
const settingsForm = readSource("components", "settings-form.tsx")
const overview = readSource("components", "study-overview.tsx")
const templateEditor = readSource("components", "template-editor.tsx")
const codeEditor = readSource("components", "code-editor.tsx")
const promptEditor = readSource("components", "prompt-editor.tsx")
const googleSheets = readSource("components", "google-sheet-picker-panel.tsx")
const importPreview = readSource("components", "import-preview-dialog.tsx")
const syncConflict = readSource("components", "sync-conflict-dialog.tsx")
const aiSettings = readSource("lib", "ai-settings.ts")

describe("mobile hierarchy and language", () => {
  it("does not repeat settings page titles inside redundant intro cards", () => {
    expect(settingsForm).not.toContain("function SectionIntro")
    expect(settingsForm).not.toContain("<SectionIntro")
  })

  it("gives the home wordmark stronger hierarchy", () => {
    expect(appShell).toContain('home ? "h-[80px]')
    expect(appShell).toContain('text-[25px] min-[390px]:text-[27px] sm:text-[29px]')
  })

  it("uses English copy for the primary study experience", () => {
    expect(overview).toContain("Today’s study")
    expect(overview).toContain("Start studying")
    expect(overview).toContain("New note")
  })

  it("uses English copy in deep editing and sync surfaces", () => {
    expect(templateEditor).toContain("Fields, template code, and live preview")
    expect(templateEditor).toContain("AI edit template")
    expect(codeEditor).toContain("Tab indent · Shift+Tab outdent")
    expect(promptEditor).toContain("Insert variables")
    expect(googleSheets).toContain("Choose a Google Sheet")
    expect(importPreview).toContain("Review before importing")
    expect(syncConflict).toContain("Both copies changed")
    expect(templateEditor).not.toContain("代码编辑")
    expect(promptEditor).not.toContain("插入变量")
    expect(googleSheets).not.toContain("选择 Google Sheet")
  })

  it("ships English default AI prompts", () => {
    expect(aiSettings).toContain("You help users create Anki vocabulary cards")
    expect(aiSettings).toContain("Generate {{count}} unique vocabulary cards")
  })
})
