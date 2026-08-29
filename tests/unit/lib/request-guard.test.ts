import { describe, expect, it } from "vitest"
import { contentLengthExceeds, createWindowRateLimiter, requestClientKey } from "@/lib/request-guard"

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
