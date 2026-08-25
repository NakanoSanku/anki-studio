import { describe, expect, it } from "vitest"

import { createCard, createDefaultDeck } from "./deck"
import { isPristineLocalLibrary, isPristineStarterDeck, planSync } from "./sync-plan"
import type { DeckRecord } from "./studio-store"

const fields = ["Word", "Translation"]

function record(partial: Partial<DeckRecord> & Pick<DeckRecord, "id">): DeckRecord {
  const deck = {
    ...createDefaultDeck(),
    name: partial.deck?.name ?? "卡包",
    fields,
    cards: [createCard(fields, { Word: partial.id, Translation: "x" })],
  }
  return {
    id: partial.id,
    deck: partial.deck ?? deck,
    rev: partial.rev ?? 0,
    dirty: partial.dirty ?? false,
    updatedAt: partial.updatedAt ?? 1,
    deletedAt: partial.deletedAt,
  }
}

describe("isPristineStarterDeck", () => {
  it("matches the default sample deck", () => {
    expect(isPristineStarterDeck(createDefaultDeck())).toBe(true)
  })

  it("rejects an edited starter", () => {
    const deck = createDefaultDeck()
    deck.cards[0]!.values.Translation = "改了"
    expect(isPristineStarterDeck(deck)).toBe(false)
  })
})

describe("isPristineLocalLibrary", () => {
  it("is true for a fresh default library", () => {
    const deck = createDefaultDeck()
    expect(
      isPristineLocalLibrary(
        [{ id: "a", deck, rev: 0, dirty: false, updatedAt: 1 }],
        { hasSynced: false, hasLocalEdits: false }
      )
    ).toBe(true)
  })

  it("is false after local edits or a completed sync", () => {
    const deck = createDefaultDeck()
    expect(
      isPristineLocalLibrary([{ id: "a", deck, rev: 0, dirty: true, updatedAt: 1 }], {
        hasSynced: false,
        hasLocalEdits: false,
      })
    ).toBe(false)
    expect(
      isPristineLocalLibrary([{ id: "a", deck, rev: 0, dirty: false, updatedAt: 1 }], {
        hasSynced: true,
        hasLocalEdits: false,
      })
    ).toBe(false)
  })
})

describe("planSync", () => {
  it("pulls a remote-only deck and pushes a new local deck", () => {
    const actions = planSync(
      [record({ id: "local", dirty: true, rev: 0 })],
      [{ id: "remote", rev: 2, name: "云", cardCount: 1, updatedAt: 9 }]
    )
    expect(actions).toEqual([
      { type: "push", id: "local" },
      { type: "pull", id: "remote" },
    ])
  })

  it("pushes when local is dirty at the same rev", () => {
    const actions = planSync(
      [record({ id: "d", dirty: true, rev: 3 })],
      [{ id: "d", rev: 3, name: "卡包", cardCount: 1, updatedAt: 1 }]
    )
    expect(actions).toEqual([{ type: "push", id: "d" }])
  })

  it("pulls when remote is newer and local is clean", () => {
    const actions = planSync(
      [record({ id: "d", dirty: false, rev: 3 })],
      [{ id: "d", rev: 4, name: "卡包", cardCount: 1, updatedAt: 2 }]
    )
    expect(actions).toEqual([{ type: "pull", id: "d" }])
  })

  it("conflicts when both sides changed the same deck", () => {
    const actions = planSync(
      [record({ id: "d", dirty: true, rev: 3, updatedAt: 10 })],
      [{ id: "d", rev: 4, name: "云端名", cardCount: 2, updatedAt: 20 }]
    )
    expect(actions).toHaveLength(1)
    expect(actions[0]).toMatchObject({
      type: "conflict",
      conflict: { id: "d", remoteRev: 4, remoteDeleted: false, localDeleted: false },
    })
  })

  it("conflicts when local edits meet a remote delete", () => {
    const actions = planSync(
      [record({ id: "d", dirty: true, rev: 1 })],
      [{ id: "d", rev: 2, name: "卡包", cardCount: 0, updatedAt: 8, deletedAt: 8 }]
    )
    expect(actions[0]?.type).toBe("conflict")
    if (actions[0]?.type === "conflict") {
      expect(actions[0].conflict.remoteDeleted).toBe(true)
    }
  })

  it("applies a remote tombstone when local is clean", () => {
    const actions = planSync(
      [record({ id: "d", dirty: false, rev: 1 })],
      [{ id: "d", rev: 2, name: "卡包", cardCount: 0, updatedAt: 8, deletedAt: 8 }]
    )
    expect(actions).toEqual([
      { type: "apply-tombstone", id: "d", remoteRev: 2, remoteUpdatedAt: 8 },
    ])
  })

  it("pushes a local tombstone at the same rev", () => {
    const actions = planSync(
      [record({ id: "d", dirty: true, rev: 4, deletedAt: 9 })],
      [{ id: "d", rev: 4, name: "卡包", cardCount: 1, updatedAt: 4 }]
    )
    expect(actions).toEqual([{ type: "push-tombstone", id: "d" }])
  })

  it("skips an unseen remote tombstone", () => {
    expect(
      planSync([], [{ id: "gone", rev: 1, name: "x", cardCount: 0, updatedAt: 1, deletedAt: 1 }])
    ).toEqual([])
  })

  it("uploads a clean never-synced starter deck", () => {
    expect(planSync([record({ id: "fresh", dirty: false, rev: 0 })], [])).toEqual([
      { type: "push", id: "fresh" },
    ])
  })
})
