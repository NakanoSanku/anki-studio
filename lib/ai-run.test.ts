import { describe, expect, it } from "vitest"

import { runAuditAi } from "./ai-run"
import { createCard } from "./deck"

describe("runAuditAi", () => {
  it("rejects an empty instruction before calling the model", async () => {
    await expect(
      runAuditAi({
        instruction: "  ",
        cards: [createCard(["Word"], { Word: "alpha" })],
        fields: ["Word"],
      })
    ).rejects.toThrow("请填写审核说明")
  })

  it("rejects an oversized chunk", async () => {
    await expect(
      runAuditAi({
        instruction: "rewrite",
        cards: Array.from({ length: 6 }, (_, index) => createCard(["Word"], { Word: `w${index}` })),
        fields: ["Word"],
      })
    ).rejects.toThrow("单次审核数量过多")
  })
})
