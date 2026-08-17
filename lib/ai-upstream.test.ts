import { describe, expect, it } from "vitest"

import { describeUpstreamError } from "./ai-upstream"

describe("describeUpstreamError", () => {
  it("reads OpenAI-style JSON errors", () => {
    expect(
      describeUpstreamError({
        status: 403,
        body: JSON.stringify({ error: { message: "Insufficient quota" } }),
      })
    ).toBe("HTTP 403：Insufficient quota")
  })

  it("recognizes a Cloudflare HTML block", () => {
    expect(
      describeUpstreamError({
        status: 403,
        body: "<html><title>Attention Required! | Cloudflare</title></html>",
        cfRay: "9a1b2c3d4e5f-SJC",
      })
    ).toContain("Cloudflare")
    expect(
      describeUpstreamError({
        status: 403,
        body: "<html><title>Attention Required! | Cloudflare</title></html>",
        cfRay: "9a1b2c3d4e5f-SJC",
      })
    ).toContain("Ray 9a1b2c3d4e5f-SJC")
  })
})
