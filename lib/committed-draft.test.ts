import { describe, expect, it } from "vitest"

import { takeCommittedDraft } from "./committed-draft"

describe("takeCommittedDraft", () => {
  it("resets the local draft when the committed value changes", () => {
    expect(takeCommittedDraft("Term", "Word", "Wor")).toEqual({
      previous: "Term",
      value: "Term",
    })
  })

  it("keeps in-progress typing when the committed value is unchanged", () => {
    expect(takeCommittedDraft("Word", "Word", "Wor")).toEqual({
      previous: "Word",
      value: "Wor",
    })
  })
})
