import { describe, expect, it } from "vitest"

import { readSource } from "../helpers/source"

const switcher = readSource("components", "deck-switcher.tsx")
const tools = readSource("components", "deck-tools-panel.tsx")
const sheet = readSource("components", "ui", "sheet.tsx")
const shell = readSource("components", "app-shell.tsx")

describe("deck sheet chrome", () => {
  it("keeps the list as one deck bottom Sheet and uses Dialog / AlertDialog for writes", () => {
    expect(switcher).toContain('side="bottom"')
    expect(switcher).toMatch(/<SheetTitle[^>]*>Decks<\/SheetTitle>/)
    expect(switcher).toContain("Rename")
    expect(switcher).toContain("Duplicate")
    expect(switcher).toContain("Delete")
    expect(switcher).toContain("New deck")
    expect(switcher).toContain('aria-label="More actions"')
    expect(switcher).toContain('from "@/components/ui/dialog"')
    expect(switcher).toContain("AlertDialog")
    expect(switcher).toContain("showCloseButton={false}")
    expect(switcher).not.toContain('data-slot="deck-nested-sheet"')
    expect(switcher).not.toContain("fixed inset-0 z-[80]")
    expect(switcher).not.toContain("<SheetTitle>{nestedTitle}</SheetTitle>")
    expect(switcher).toContain('kind: "duplicate"')
    expect(switcher).toContain("nextCopyDeckName")
    expect(switcher).toContain("startNameStep")
    expect(switcher).toContain("onDuplicate(step.entry.id, name)")
    expect(switcher).not.toContain("onDuplicate(entry.id)")
    expect(switcher).toContain("event.preventDefault()")
    expect(switcher).toContain("Local data for this deck cannot be recovered.")
    expect(switcher).toContain("onEscapeKeyDown={(event) => event.preventDefault()}")
    expect(switcher).toContain("onInteractOutside={blockSheetDismiss}")
    expect(switcher).toContain("if (!next && step) return")
    expect(switcher.match(/<Sheet[\s>]/g)?.length ?? 0).toBe(1)
    expect(sheet).toContain("z-[70]")
    expect(shell).toContain('aria-label="Primary navigation"')
    expect(shell).toContain("z-50")
    expect(shell).toContain("grid-cols-3")
  })

  it("keeps deck tools focused on templates and data movement", () => {
    expect(tools).toContain("DECK_TEMPLATES_LABEL")
    expect(tools).toContain("PATHS.settingsTemplates")
    expect(tools).toContain("Import")
    expect(tools).toContain("Export")
  })
})
