import { describe, expect, it } from "vitest"

import { describeUpstreamError, isCloudflareBlocked } from "./ai-upstream"

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

describe("isCloudflareBlocked", () => {
  it("matches the Vercel 502 status text", () => {
    expect(
      isCloudflareBlocked(
        "拉取模型失败：HTTP 403：中转站前的 Cloudflare 拦截了请求，Ray a2c5e4fdac18e047-IAD。Vercel 出口 IP 经常被拦，官方 API 不会"
      )
    ).toBe(true)
    expect(isCloudflareBlocked("HTTP 403：Insufficient quota")).toBe(false)
  })
})
