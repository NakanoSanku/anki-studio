import { describe, expect, it } from "vitest"

import { idAfterDelete, idAtIndex, insertItemsAfter, moveItemAfter, neighborId } from "@/lib/card-nav"

const items = [{ id: "a" }, { id: "b" }, { id: "c" }]

describe("insertItemsAfter", () => {
  it("inserts after the anchor", () => {
    expect(insertItemsAfter(items, "a", [{ id: "x" }]).map((item) => item.id)).toEqual(["a", "x", "b", "c"])
  })

  it("appends when the anchor is missing", () => {
    expect(insertItemsAfter(items, "missing", [{ id: "x" }]).map((item) => item.id)).toEqual(["a", "b", "c", "x"])
    expect(insertItemsAfter(items, null, [{ id: "x" }]).map((item) => item.id)).toEqual(["a", "b", "c", "x"])
  })
})

describe("moveItemAfter", () => {
  it("moves an existing item after the current card", () => {
    expect(moveItemAfter(items, "c", "a").map((item) => item.id)).toEqual(["a", "c", "b"])
  })

  it("keeps the item in place when it is already selected", () => {
    expect(moveItemAfter(items, "b", "b").map((item) => item.id)).toEqual(["a", "b", "c"])
  })
})

describe("idAfterDelete", () => {
  it("selects the next card, then the previous", () => {
    expect(idAfterDelete(items, "a")).toBe("b")
    expect(idAfterDelete(items, "b")).toBe("c")
    expect(idAfterDelete(items, "c")).toBe("b")
  })
})

describe("neighborId", () => {
  it("moves within bounds", () => {
    expect(neighborId(items, "b", -1)).toBe("a")
    expect(neighborId(items, "b", 1)).toBe("c")
    expect(neighborId(items, "a", -1)).toBe("a")
    expect(neighborId(items, "c", 1)).toBe("c")
  })
})

describe("idAtIndex", () => {
  it("clamps a 1-based jump", () => {
    expect(idAtIndex(items, 2)).toBe("b")
    expect(idAtIndex(items, 0)).toBe("a")
    expect(idAtIndex(items, 99)).toBe("c")
  })
})
