import { describe, expect, it } from "vitest"

import { readSource } from "../helpers/source"

const input = readSource("components", "ui", "input.tsx")

describe("shared input contracts", () => {
  it("keeps the shared input as a plain controlled input", () => {
    expect(input).not.toContain('startsWith("field-")')
    expect(input).not.toContain("dispatchEvent(new Event")
    expect(input).not.toContain("useState(value)")
    expect(input).toContain("{...props}")
  })
})
