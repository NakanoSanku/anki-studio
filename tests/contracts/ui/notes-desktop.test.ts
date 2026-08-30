import { describe, expect, it } from "vitest"

import { readSource } from "../helpers/source"

const layout = readSource("app", "(app)", "notes", "layout.tsx")

describe("notes desktop workspace", () => {
  it("keeps the note-library pane wide enough for its title and actions", () => {
    expect(layout).toContain("grid-template-columns: minmax(20rem, 22rem) minmax(0, 1fr)")
    expect(layout).toContain("flex-shrink: 0")
    expect(layout).toContain("overflow: visible")
    expect(layout).toContain("white-space: nowrap")
  })

  it("does not reserve an empty scrollbar gutter when a filter has no matches", () => {
    expect(layout).toContain("scrollbar-gutter: auto")
    expect(layout).not.toContain("scrollbar-gutter: stable")
  })

  it("keeps editor and preview side by side after opening a note on desktop", () => {
    expect(layout).toContain('[data-app-view="note-detail"] #app-main div:has(> section > [data-testid="notes-card-list"])')
    expect(layout).toContain("grid-template-columns: minmax(0, 1fr) minmax(0, 1fr)")
    expect(layout).toContain('[data-app-view="note-detail"] #app-main [data-testid="card-editor-fields"]')
    expect(layout).toContain("display: flex !important")
    expect(layout).toContain("section:last-child")
    expect(layout).toContain("display: block !important")
  })

  it("restores list, editor, and preview together once three panes fit", () => {
    expect(layout).toContain("@media (min-width: 80rem)")
    expect(layout).toContain("minmax(20rem, 0.95fr) minmax(20rem, 1.05fr)")
    expect(layout).toContain('section:has(> [data-testid="notes-card-list"])')
  })
})
