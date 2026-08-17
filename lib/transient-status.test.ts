import { describe, expect, it } from "vitest"

import { expireStatus, replaceTimer } from "./transient-status"

describe("expireStatus", () => {
  it("clears only the message that scheduled the timer", () => {
    expect(expireStatus("已导入 a.json", "已导入 a.json")).toBe("")
    expect(expireStatus("已导入 b.json", "已导入 a.json")).toBe("已导入 b.json")
  })
})

describe("replaceTimer", () => {
  it("cancels the previous timer before scheduling the next one", () => {
    const cancelled: number[] = []
    const scheduled: Array<{ id: number; delay: number }> = []
    let nextId = 1

    const first = replaceTimer(
      0,
      (fn, delay) => {
        scheduled.push({ id: nextId, delay })
        return nextId++
      },
      (id) => cancelled.push(id),
      3200,
      () => undefined
    )
    const second = replaceTimer(
      first,
      (fn, delay) => {
        scheduled.push({ id: nextId, delay })
        return nextId++
      },
      (id) => cancelled.push(id),
      3200,
      () => undefined
    )

    expect(first).toBe(1)
    expect(second).toBe(2)
    expect(cancelled).toEqual([0, 1])
    expect(scheduled.map((item) => item.delay)).toEqual([3200, 3200])
  })
})
