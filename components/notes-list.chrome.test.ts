import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const root = join(dirname(fileURLToPath(import.meta.url)))
const shell = readFileSync(join(root, "app-shell.tsx"), "utf8")
const editor = readFileSync(join(root, "card-editor.tsx"), "utf8")
const studio = readFileSync(join(root, "studio.tsx"), "utf8")

describe("笔记列表 chrome", () => {
  it("locks the notes viewport and keeps the tab bar in flow", () => {
    expect(studio).toContain("lockViewport={pathname === PATHS.notes}")
    expect(shell).toContain('data-testid={lock ? "notes-shell"')
    expect(shell).toContain("fixed inset-0 overflow-hidden overscroll-none")
    expect(shell).toContain('lock ? "shrink-0" : "fixed inset-x-0 bottom-0"')
    expect(shell).toContain("html.style.overflow = \"hidden\"")
  })

  it("scrolls inside the list box instead of the page", () => {
    expect(editor).toContain('data-testid="notes-card-list"')
    expect(editor).toContain("overflow-y-auto overscroll-contain")
    expect(editor).toContain('listOnly && "h-full min-h-0 flex-1 overflow-hidden"')
    expect(editor).toContain('"min-h-0 flex-1"')
  })
})
