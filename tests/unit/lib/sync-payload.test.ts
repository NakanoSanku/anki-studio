import { describe, expect, it } from "vitest"

import { createDefaultDeck } from "@/lib/deck"
import { parsePutBody, parseRemoteDeckPayload, parseRemoteIndex } from "@/lib/sync-payload"

describe("parseRemoteDeckPayload", () => {
  it("parses a live deck", () => {
    const deck = createDefaultDeck()
    const payload = parseRemoteDeckPayload({ rev: 2, updatedAt: 8, deck })
    expect(payload.rev).toBe(2)
    expect(payload.deck?.name).toBe(deck.name)
    expect(payload.deletedAt).toBeNull()
  })

  it("allows a tombstone without deck", () => {
    const payload = parseRemoteDeckPayload({ rev: 3, updatedAt: 9, deletedAt: 9 })
    expect(payload.deck).toBeNull()
    expect(payload.deletedAt).toBe(9)
  })

  it("allows the empty revision used when a remote deck disappeared", () => {
    expect(parseRemoteDeckPayload({ rev: 0, updatedAt: 0, deck: null })).toMatchObject({
      rev: 0,
      deck: null,
    })
  })
})

describe("parsePutBody", () => {
  it("requires a deck unless deleting", () => {
    expect(() => parsePutBody({ expectedRev: 0 })).toThrow("缺少卡包内容")
    const body = parsePutBody({ expectedRev: 1, deletedAt: 9 })
    expect(body.deletedAt).toBe(9)
    expect(body.deck).toBeNull()
  })

  it("creates a valid default editor state when it is omitted", () => {
    const deck = createDefaultDeck()
    expect(parsePutBody({ expectedRev: 0, deck }).editorState?.selectedId).toBe(deck.cards[0]?.id)
  })
})

describe("parseRemoteIndex", () => {
  it("normalizes spreadsheet index rows", () => {
    expect(parseRemoteIndex([{
      id: "remote-deck",
      rev: 4,
      name: "旅行",
      cardCount: 12,
      updatedAt: 99,
      deletedAt: null,
    }])).toEqual([{
      id: "remote-deck",
      rev: 4,
      name: "旅行",
      cardCount: 12,
      updatedAt: 99,
      deletedAt: null,
    }])
  })

  it("rejects malformed ids", () => {
    expect(() => parseRemoteIndex([{ id: "!", rev: 1 }])).toThrow("无效卡包")
  })
})
