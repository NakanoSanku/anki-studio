import { describe, expect, it } from "vitest"

import {
  combineTransportErrors,
  describeUpstreamError,
  isCloudflareBlocked,
  isOfficialProvider,
  resolveAiPlan,
  shouldFallbackToBrowser,
} from "./ai-upstream"

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

describe("shouldFallbackToBrowser", () => {
  it("retries generic Vercel 502/403 but not validation or auth errors", () => {
    expect(shouldFallbackToBrowser("HTTP 502：字段生成失败")).toBe(true)
    expect(shouldFallbackToBrowser("Forbidden")).toBe(true)
    expect(shouldFallbackToBrowser("请填写接口地址")).toBe(false)
    expect(shouldFallbackToBrowser("HTTP 401：Incorrect API key")).toBe(false)
  })
})

describe("resolveAiPlan", () => {
  it("uses the server on the server runtime", () => {
    expect(resolveAiPlan({ baseURL: "https://relay.example/v1" }, false)).toBe("server")
  })

  it("prefers the browser for custom relays in auto mode", () => {
    expect(resolveAiPlan({ baseURL: "https://relay.example/v1", transport: "auto" }, true)).toBe(
      "browser-then-server"
    )
  })

  it("prefers the server for official OpenAI, then falls back", () => {
    expect(resolveAiPlan({ baseURL: "https://api.openai.com/v1" }, true)).toBe("server-then-browser")
  })

  it("honors an explicit transport", () => {
    expect(resolveAiPlan({ baseURL: "https://api.openai.com/v1", transport: "browser" }, true)).toBe(
      "browser"
    )
    expect(resolveAiPlan({ baseURL: "https://relay.example/v1", transport: "server" }, true)).toBe(
      "server"
    )
  })
})

describe("isOfficialProvider", () => {
  it("recognizes OpenAI and Azure hosts", () => {
    expect(isOfficialProvider("https://api.openai.com/v1")).toBe(true)
    expect(isOfficialProvider("https://my-resource.openai.azure.com/openai")).toBe(true)
    expect(isOfficialProvider("https://api.deepseek.com/v1")).toBe(false)
  })
})

describe("combineTransportErrors", () => {
  it("explains the CF + CORS deadlock", () => {
    expect(
      combineTransportErrors(
        new Error("Failed to fetch"),
        new Error("HTTP 403：中转站前的 Cloudflare 拦截了请求，Ray abc-IAD")
      ).message
    ).toContain("未开启跨域")
  })
})
