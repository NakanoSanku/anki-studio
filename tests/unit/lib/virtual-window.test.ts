import { describe, expect, it } from "vitest"

import { scrollToRow, visibleRange } from "@/lib/virtual-window"

describe("visibleRange", () => {
  it("windows a long list with overscan", () => {
    const range = visibleRange(2000, 440, 400, 44, 2)
    expect(range.start).toBe(8)
    expect(range.end).toBe(22)
    expect(range.padTop).toBe(352)
    expect(range.padBottom).toBe((2000 - 22) * 44)
  })

  it("accounts for a sticky header offset", () => {
    const range = visibleRange(100, 0, 200, 44, 0, 36)
    expect(range.start).toBe(0)
    expect(range.end).toBe(4)
  })
})

describe("scrollToRow", () => {
  it("only moves when the row is out of view", () => {
    expect(scrollToRow(0, 400, 2, 44)).toBeNull()
    expect(scrollToRow(0, 400, 20, 44)).toBe(20 * 44 - 400 + 44)
    expect(scrollToRow(200, 400, 0, 44)).toBe(0)
  })
})
