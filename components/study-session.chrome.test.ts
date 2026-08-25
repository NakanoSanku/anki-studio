import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "study-session.tsx"),
  "utf8"
)

describe("会话 header chrome", () => {
  it("keeps exit, one progress, and icon-only edit", () => {
    expect(source).toContain('aria-label="退出学习"')
    expect(source.match(/aria-label=\{`本轮已完成 \$\{completed\}，共 \$\{total\} 张`\}/g)).toHaveLength(1)
    expect(source).toContain('aria-label="改这条笔记"')
    expect(source).not.toMatch(/aria-label="改这条笔记"[\s\S]{0,120}>\s*改\s*</)
  })

  it("does not ship 本轮详情, duplicate mobile progress, or fullscreen", () => {
    expect(source).not.toContain("本轮详情")
    expect(source).not.toContain("全屏")
    expect(source).not.toContain("requestFullscreen")
    expect(source).not.toContain("sm:hidden")
    expect(source).not.toContain("查看本轮详情")
  })
})
