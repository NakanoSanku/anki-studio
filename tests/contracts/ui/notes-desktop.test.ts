import { describe, expect, it } from "vitest"

import { readSource } from "../helpers/source"

const layout = readSource("app", "(app)", "notes", "layout.tsx")

describe("notes desktop workspace", () => {
  it("uses two panes at large widths and three panes at extra-large widths", () => {
    expect(layout).toContain("@media (min-width: 64rem)")
    expect(layout).toContain("grid-template-columns: minmax(15rem, 18rem) minmax(0, 1fr)")
    expect(layout).toContain("@media (min-width: 80rem)")
    expect(layout).toContain("minmax(20rem, 0.95fr) minmax(20rem, 1.05fr)")
  })

  it("keeps the detail editor-preview toggle available until all three panes fit", () => {
    expect(layout).toContain('[data-app-view="note-detail"] [data-testid="note-view-toggle"]')
    expect(layout).toContain('[data-testid="card-editor-fields"].hidden')
    expect(layout).toContain("section:last-child.hidden")
    expect(layout).toContain("display: none !important")
  })

  it("keeps list controls visible and gives each desktop pane its own scroll area", () => {
    expect(layout).toContain('section:has(> [data-testid="notes-card-list"]) > div:first-child')
    expect(layout).toContain('[data-testid="notes-card-list"]')
    expect(layout).toContain("height: auto !important")
    expect(layout).toContain("overscroll-behavior: contain")
    expect(layout).toContain("scrollbar-gutter: stable")
  })
})
