import { afterEach, describe, expect, it, vi } from "vitest"

import {
  describeUpstreamError,
  isBrowserNetworkError,
  isCloudflareBlocked,
  withBrowserCorsHint,
  withProviderTimeout,
} from "@/lib/ai-upstream"

describe("describeUpstreamError", () => {
  it("reads OpenAI-style JSON errors", () => {
    expect(
      describeUpstreamError({
        status: 403,
        body: JSON.stringify({ error: { message: "Insufficient quota" } }),
      })
    ).toBe("HTTP 403: Insufficient quota")
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
  it("matches Cloudflare intercept text", () => {
    expect(
      isCloudflareBlocked("HTTP 403: Cloudflare blocked the provider request · Ray a2c5e4fdac18e047-IAD")
    ).toBe(true)
    expect(isCloudflareBlocked("HTTP 403: Insufficient quota")).toBe(false)
  })
})

describe("withBrowserCorsHint", () => {
  it("rewrites browser CORS failures", async () => {
    await expect(withBrowserCorsHint(() => Promise.reject(new Error("Failed to fetch")))).rejects.toThrow(
      "Enable CORS"
    )
    expect(isBrowserNetworkError("Failed to fetch")).toBe(true)
  })

  it("keeps provider errors unchanged", async () => {
    await expect(
      withBrowserCorsHint(() => Promise.reject(new Error("HTTP 401: Incorrect API key")))
    ).rejects.toThrow("HTTP 401: Incorrect API key")
  })
})


afterEach(() => {
  vi.useRealTimers()
})

describe("withProviderTimeout", () => {
  it("aborts a stalled request with a clear timeout error", async () => {
    vi.useFakeTimers()
    const pending = withProviderTimeout(
      (signal) => new Promise<void>((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true })
      }),
      undefined,
      25
    )
    const assertion = expect(pending).rejects.toThrow("AI request timed out")
    await vi.advanceTimersByTimeAsync(25)
    await assertion
  })
})
