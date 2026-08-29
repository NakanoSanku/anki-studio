import { describe, expect, it } from "vitest"

import { readSource } from "../helpers/source"

const shell = readSource("components", "app-shell.tsx")
const editor = readSource("components", "card-editor.tsx")
const references = readSource("components", "reference-notes-bar.tsx")
const studio = readSource("components", "studio.tsx")

describe("notes mobile chrome", () => {
  it("locks the notes viewport and keeps the tab bar in flow", () => {
    expect(studio).toContain("lockViewport={pathname === PATHS.notes}")
    expect(shell).toContain('data-testid={lock ? "notes-shell"')
    expect(shell).toContain("fixed inset-0 overflow-hidden overscroll-none")
    expect(shell).toContain('"shrink-0 pb-[max(')
    expect(shell).toContain('"fixed inset-x-0 bottom-0 pb-[max(')
    expect(shell).toContain("env(safe-area-inset-bottom)")
    expect(shell).toContain('html.style.overflow = "hidden"')
  })

  it("scrolls inside the list box instead of the page", () => {
    expect(editor).toContain('data-testid="notes-card-list"')
    expect(editor).toContain("overflow-y-auto overscroll-contain")
    expect(editor).toContain('listOnly && "h-full min-h-0 flex-1 overflow-hidden"')
    expect(editor).toContain('"min-h-0 flex-1"')
  })

  it("moves edit/preview into one top-bar toggle and removes the body tabs", () => {
    expect(editor).toContain("useAppHeaderAction")
    expect(editor).toContain('data-testid="note-view-toggle"')
    expect(editor).toContain('aria-label={editorPane === "preview" ? "Switch to editor" : "Switch to preview"}')
    expect(editor).not.toContain('<TabsTrigger value="editor">')
    expect(editor).not.toContain('<TabsTrigger value="preview">')
  })

  it("keeps review, AI Fill, and delete actions on one compact title-row rail", () => {
    expect(editor).toContain('data-testid="note-action-rail"')
    expect(editor).toContain('className="flex shrink-0 items-center gap-1"')
    expect(editor).toContain("whitespace-nowrap")
    expect(editor).toContain('aria-label="AI Fill"')
    expect(editor).toContain(">Delete</Button>")
    expect(editor).toContain("setDeleteTargetId(selected.id)")
    expect(editor).toContain('data-testid="note-delete-confirmation"')
    expect(editor).toContain("<AlertDialogTitle>Delete note?</AlertDialogTitle>")
    expect(editor).toContain("<AlertDialogCancel>Cancel</AlertDialogCancel>")
    expect(editor).not.toContain("onClick={() => removeCard(selected.id)}")
  })

  it("uses a deterministic note return path instead of relying on browser history", () => {
    expect(shell).toContain("const noteReturnPathRef = useRef<typeof PATHS.home | typeof PATHS.notes>(PATHS.notes)")
    expect(shell).toContain("previous === PATHS.home || previous === PATHS.notes")
    expect(shell).toContain("router.replace(noteReturnPathRef.current)")
    expect(shell).not.toContain("window.history.length > 1")
    expect(shell).not.toContain("router.back()")
  })

  it("keeps reference notes inside AI flows instead of the note-list toolbar", () => {
    expect(editor).not.toContain("ReferenceNotesBar")
    expect(editor).toContain("ReferenceNotesPicker")
    expect(editor).toContain("referenceValuesForComplete")
    expect(editor).toContain("Optional style examples")
  })

  it("hides the batch dialog while the reference-notes sheet is open", () => {
    expect(editor).toContain("batchOpen && !referencePickerOpen")
  })

  it("keeps reference picker controls stable and supports full-note preview", () => {
    expect(references).toContain('aria-label="Clear reference selection"')
    expect(references).toContain("disabled={referenceIds.length === 0}")
    expect(references).not.toContain("Sparkles")
    expect(references).toContain('aria-label={`Preview ${label || "note"}`}')
    expect(references).toContain("Note preview")
    expect(references).toContain("Use as reference")
    expect(references).toContain("Pick notes whose style you want AI to follow.")
  })

  it("uses compact source-material generation with auto and manual amounts", () => {
    expect(editor).toContain("Source material")
    expect(editor).toContain("Topic, word list, article, notes…")
    expect(editor).toContain('data-testid="batch-amount-auto"')
    expect(editor).toContain('data-testid="batch-amount-manual"')
    expect(editor).toContain("Adapts to the source · up to 50 notes")
    expect(editor).toContain('count: batchAmountMode === "manual" ? Math.floor(count) : undefined')
    expect(editor).not.toContain("Generate multiple notes from a topic or pasted word list")
  })
})
