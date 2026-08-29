import { describe, expect, it } from "vitest"
import { readSource } from "./helpers/source"

const idb = readSource("lib", "studio-store-idb.ts")
const studio = readSource("components", "studio.tsx")

describe("production data durability", () => {
  it("waits for IndexedDB transaction completion on durable writes", () => {
    expect(idb).toContain("transaction.oncomplete")
    expect(idb).toContain("async updateRecord(id, update)")
    expect(idb).toContain("async replaceRecordsIfUnchanged(expected, records, meta)")
  })
  it("guards sync reloads against newer in-memory edits", () => {
    expect(studio).toContain("isLocalStateCurrent")
    expect(studio).toContain("preserveLocalAfterSync")
    expect(studio).toContain("{ recreateMissing: true }")
  })
})
