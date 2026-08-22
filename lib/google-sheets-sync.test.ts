import { describe, expect, it, vi } from "vitest"

import { createDefaultDeck } from "./deck"
import {
  createGoogleSheetsSyncGateway,
  getGoogleSheetsStatus,
  putGoogleSheetsDeck,
} from "./google-sheets-sync"

const gateway = createGoogleSheetsSyncGateway({
  url: "https://script.google.com/macros/s/deployment-id/exec",
  secret: "a-secret-that-is-long-enough",
})

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })
}

describe("Google Sheets sync gateway", () => {
  it("authenticates status calls and checks the schema version", async () => {
    const fetchImpl = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      expect(JSON.parse(String(init?.body))).toMatchObject({
        action: "status",
        secret: gateway.secret,
      })
      return jsonResponse({ ok: true, schemaVersion: 1 })
    }) as unknown as typeof fetch

    await expect(getGoogleSheetsStatus(gateway, fetchImpl)).resolves.toBeUndefined()
  })

  it("preserves optimistic conflicts returned under the script lock", async () => {
    const deck = createDefaultDeck()
    const fetchImpl = vi.fn(async () => jsonResponse({
      ok: true,
      result: {
        ok: false,
        conflict: true,
        server: { rev: 3, updatedAt: 10, deck },
      },
    })) as unknown as typeof fetch

    const result = await putGoogleSheetsDeck(gateway, "remote-deck", {
      expectedRev: 2,
      deck,
    }, fetchImpl)
    expect(result).toMatchObject({ ok: false, conflict: true, server: { rev: 3 } })
  })

  it("explains a deployment that returns an HTML sign-in page", async () => {
    const fetchImpl = vi.fn(async () => new Response("<html>Sign in</html>")) as unknown as typeof fetch
    await expect(getGoogleSheetsStatus(gateway, fetchImpl)).rejects.toThrow("访问权限")
  })
})
