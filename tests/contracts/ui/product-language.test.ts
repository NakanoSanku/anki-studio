import { describe, expect, it } from "vitest"

import { readSource } from "../helpers/source"

const appShell = readSource("components", "app-shell.tsx")
const settingsForm = readSource("components", "settings-form.tsx")
const settingsOverview = readSource("components", "settings-overview.tsx")
const overview = readSource("components", "study-overview.tsx")
const templateEditor = readSource("components", "template-editor.tsx")
const codeEditor = readSource("components", "code-editor.tsx")
const promptEditor = readSource("components", "prompt-editor.tsx")
const googleAccount = readSource("components", "google-account-panel.tsx")
const googleSheets = readSource("components", "google-sheet-picker-panel.tsx")
const importPreview = readSource("components", "import-preview-dialog.tsx")
const syncConflict = readSource("components", "sync-conflict-dialog.tsx")
const bootScreen = readSource("components", "studio-loader.tsx")
const offlineBanner = readSource("components", "offline-banner.tsx")
const rootLayout = readSource("app", "layout.tsx")
const manifest = readSource("app", "manifest.ts")
const notFound = readSource("app", "not-found.tsx")
const errorPage = readSource("app", "error.tsx")
const authError = readSource("app", "auth", "error", "page.tsx")
const aiSettings = readSource("lib", "ai-settings.ts")
const productCopy = readSource("lib", "product-copy.ts")

describe("mobile hierarchy and language", () => {
  it("does not repeat settings page titles inside redundant intro cards", () => {
    expect(settingsForm).not.toContain("function SectionIntro")
    expect(settingsForm).not.toContain("<SectionIntro")
  })

  it("uses one shared primary header for Study, Notes, and Settings", () => {
    expect(appShell).toContain('if (pathname === PATHS.home) return { title: "Study", primary: true }')
    expect(appShell).toContain('if (pathname === PATHS.notes) return { title: "Notes", primary: true }')
    expect(appShell).toContain('if (pathname === PATHS.settings) return { title: "Settings", primary: true }')
    expect(appShell).toContain('data-testid="studio-mark"')
    expect(appShell).toContain('data-testid="header-deck-switcher"')
    expect(appShell).toContain('data-testid="header-sync"')
    expect(appShell).toContain("Anki Studio")
    expect(appShell).not.toContain("anki-wordmark")
    expect(appShell).not.toContain('home ? "h-[80px]')
  })

  it("uses concise English copy for the primary study experience", () => {
    expect(overview).toContain("Today")
    expect(overview).toContain("Start studying")
    expect(overview).toContain("Voice tutor")
    expect(overview).toContain("New note")
    expect(overview).not.toContain("Today’s study")
    expect(overview).not.toContain("Less friction. One clear rhythm.")
  })

  it("uses English copy in deep editing and sync surfaces", () => {
    expect(templateEditor).toContain("Fields, template code, and live preview")
    expect(templateEditor).toContain("AI edit template")
    expect(codeEditor).toContain("Tab indent · Shift+Tab outdent")
    expect(promptEditor).toContain("Insert variables")
    expect(googleAccount).toContain("Google connected")
    expect(googleSheets).toContain("Choose a Google Sheet")
    expect(googleSheets).toContain("Sync destination")
    expect(importPreview).toContain("Review before importing")
    expect(syncConflict).toContain("Both copies changed")
    expect(templateEditor).not.toContain("代码编辑")
    expect(promptEditor).not.toContain("插入变量")
    expect(googleSheets).not.toContain("选择 Google Sheet")
  })

  it("normalizes legacy operation and sync copy at presentation boundaries", () => {
    expect(productCopy).toContain('"尚未同步": "Not synced yet"')
    expect(productCopy).toContain('"已切换卡包": "Deck switched"')
    expect(productCopy).toContain("export function productStatusMessage")
    expect(settingsForm).toContain("productSyncMessage(sync.message)")
    expect(settingsForm).toContain("const syncHeadline = sync")
    expect(settingsForm).not.toContain("{sync.message}")
    expect(settingsOverview).toContain("productSyncMessage(syncMessage)")
    expect(appShell).toContain("const shownStatus = productStatusMessage(status)")
    expect(appShell).toContain("{shownStatus}")
    expect(appShell).not.toContain("{status}")
  })

  it("uses English copy in the PWA shell and fallback screens", () => {
    expect(rootLayout).toContain('<html lang="en"')
    expect(rootLayout).toContain("Create and review your own flashcards")
    expect(manifest).toContain('lang: "en"')
    expect(manifest).toContain('name: "Start studying"')
    expect(bootScreen).toContain("Preparing your study space")
    expect(offlineBanner).toContain("Offline · changes are saved on this device")
    expect(notFound).toContain("This card isn’t here")
    expect(errorPage).toContain("We hit a problem")
    expect(authError).toContain("Couldn’t connect your Google account")
  })

  it("ships English default AI prompts", () => {
    expect(aiSettings).toContain("You help users create Anki vocabulary cards")
    expect(aiSettings).toContain("Generate {{count}} unique vocabulary cards")
  })
})
