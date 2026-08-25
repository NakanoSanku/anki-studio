import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const root = join(dirname(fileURLToPath(import.meta.url)))
const switcher = readFileSync(join(root, "deck-switcher.tsx"), "utf8")
const tools = readFileSync(join(root, "deck-tools-panel.tsx"), "utf8")
const sheet = readFileSync(join(root, "ui/sheet.tsx"), "utf8")
const shell = readFileSync(join(root, "app-shell.tsx"), "utf8")

describe("卡包 sheet chrome", () => {
  it("is titled 卡包 and hosts 改名 / 复制 / 删除 / 新建", () => {
    expect(switcher).toContain("<SheetTitle>卡包</SheetTitle>")
    expect(switcher).toContain("改名")
    expect(switcher).toContain("复制")
    expect(switcher).toContain("删除")
    expect(switcher).toContain("新建")
    expect(switcher).toContain('aria-label="更多"')
    expect(switcher).not.toContain("管理卡包")
    expect(switcher).not.toContain("卡包管理")
    expect(switcher).not.toContain("当前：")
    expect(switcher).not.toContain("from \"@/components/ui/dialog\"")
    expect(switcher).not.toContain("AlertDialog")
    expect(switcher).toContain('data-slot="deck-nested-sheet"')
    expect(switcher).not.toMatch(/SheetContent[^>]*\brelative\b/)
    expect(switcher).toContain("fixed inset-0 z-[80]")
    expect(switcher).toContain("<SheetTitle>{nestedTitle}</SheetTitle>")
    expect(switcher).toContain('step?.kind === "create" ? "新建"')
    expect(switcher).toContain("isDeckNameReady")
    expect(switcher).toContain("onDuplicate(entry.id)")
    expect(switcher.match(/<Sheet[\s>]/g)?.length ?? 0).toBe(1)
    expect(sheet).toContain("z-[70]")
    expect(shell).toContain('aria-label="主要导航"')
    expect(shell).toMatch(/z-50 grid grid-cols-3/)
  })

  it("does not keep a 管理卡包 row on the 卡包 settings list", () => {
    expect(tools).toContain("DECK_TEMPLATES_LABEL")
    expect(tools).toContain("PATHS.settingsTemplates")
    expect(tools).toContain("导入")
    expect(tools).toContain("导出")
    expect(tools).toContain("onPushAnki")
    expect(tools).not.toContain("管理卡包")
  })
})
