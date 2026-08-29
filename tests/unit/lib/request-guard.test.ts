import { describe, expect, it } from "vitest"
import { contentLengthExceeds, createWindowRateLimiter, readJsonBodyWithLimit, RequestBodyTooLargeError, requestClientKey } from "@/lib/request-guard"

describe("request guard", () => {
  it("rejects declared oversized request bodies", () => {
    const request = new Request("https://example.com", { headers: { "content-length": "5000" } })
    expect(contentLengthExceeds(request, 4096)).toBe(true)
  })

  it("limits a client within a fixed window and resets after it", () => {
    const allow = createWindowRateLimiter({ limit: 2, windowMs: 1000 })
    expect(allow("client", 0).allowed).toBe(true)
    expect(allow("client", 1).allowed).toBe(true)
    expect(allow("client", 2).allowed).toBe(false)
    expect(allow("client", 1001).allowed).toBe(true)
  })

  it("prefers platform client IP headers", () => {
    const request = new Request("https://example.com", {
      headers: { "cf-connecting-ip": "203.0.113.8", "x-forwarded-for": "198.51.100.2" },
    })
    expect(requestClientKey(request)).toBe("203.0.113.8")
  })
})


  it("rejects a streamed body that exceeds the limit without Content-Length", async () => {
    const request = new Request("https://example.com", {
      method: "POST",
      body: JSON.stringify({ value: "x".repeat(128) }),
    })
    await expect(readJsonBodyWithLimit(request, 32)).rejects.toBeInstanceOf(RequestBodyTooLargeError)
  })

  it("keeps the limiter map bounded even when every entry is still active", () => {
    const allow = createWindowRateLimiter({ limit: 1, windowMs: 60_000, maxEntries: 2 })
    expect(allow("a", 0).allowed).toBe(true)
    expect(allow("b", 0).allowed).toBe(true)
    expect(allow("c", 0).allowed).toBe(true)
    // a was evicted to keep the map bounded, so it starts a fresh window.
    expect(allow("a", 1).allowed).toBe(true)
  })
