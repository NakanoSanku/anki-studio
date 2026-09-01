import { describe, expect, it } from "vitest"

import { readSource } from "../helpers/source"

const input = readSource("components", "ui", "input.tsx")

describe("deferred input commit contracts", () => {
  it("lets the synthetic commit event reach the controlled onChange handler", () => {
    expect(input).toContain("const committingRef = React.useRef(false)")
    expect(input).toContain("committingRef.current = true")
    expect(input).toContain("if (deferCardFieldCommit && !committingRef.current)")
    expect(input).toContain('element.dispatchEvent(new Event("input", { bubbles: true }))')
  })
})
