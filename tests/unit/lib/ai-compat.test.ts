import { afterEach, describe, expect, it, vi } from "vitest"

import {
  completeJson,
  parseJsonPayload,
  pickCardList,
  pickFieldValues,
  readChatText,
} from "@/lib/ai-compat"

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("parseJsonPayload", () => {
  it("reads fenced and embedded JSON", () => {
    expect(parseJsonPayload('```json\n{"Word":"alpha"}\n```')).toEqual({ Word: "alpha" })
    expect(parseJsonPayload('here you go\n{"Word":"beta"}\n')).toEqual({ Word: "beta" })
    expect(parseJsonPayload("not json")).toBeUndefined()
  })
})

describe("pickFieldValues", () => {
  it("reads either a flat object or a values wrapper", () => {
    expect(pickFieldValues({ Word: " alpha ", Translation: "一" }, ["Word", "Translation"])).toEqual({
      Word: "alpha",
      Translation: "一",
    })
    expect(pickFieldValues({ values: { Word: "beta" } }, ["Word", "Translation"])).toEqual({
      Word: "beta",
      Translation: "",
    })
  })
})

describe("pickCardList", () => {
  it("accepts a bare array or a cards wrapper", () => {
    expect(pickCardList([{ Word: "a" }, { Word: "b" }], ["Word"])).toEqual([{ Word: "a" }, { Word: "b" }])
    expect(pickCardList({ cards: [{ Word: "c" }] }, ["Word"])).toEqual([{ Word: "c" }])
  })
})

describe("readChatText", () => {
  it("reads OpenAI and array content", () => {
    expect(
      readChatText({
        choices: [{ message: { content: "  hello  " } }],
      })
    ).toBe("hello")
    expect(
      readChatText({
        choices: [{ message: { content: [{ text: "part" }, { text: "s" }] } }],
      })
    ).toBe("parts")
  })

  it("reads Gemini Interactions model output", () => {
    expect(
      readChatText({
        steps: [
          { type: "user_input", content: [{ type: "text", text: "hello" }] },
          {
            type: "model_output",
            content: [{ type: "text", text: "  Gemini response  " }],
          },
        ],
      })
    ).toBe("Gemini response")
  })
})

describe("Gemini native compatibility", () => {
  it("routes JSON generation through the Interactions API", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(
        JSON.stringify({
          steps: [
            {
              type: "model_output",
              content: [{ type: "text", text: '{"Word":"alpha"}' }],
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    )
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      completeJson({
        settings: {
          baseURL: "https://generativelanguage.googleapis.com/v1beta",
          apiKey: "gemini-key",
          model: "models/gemini-3.7-flash",
        },
        system: "Return the requested fields.",
        prompt: "Create one card.",
      })
    ).resolves.toEqual({ Word: "alpha" })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [input, init] = fetchMock.mock.calls[0]
    expect(String(input)).toBe("https://generativelanguage.googleapis.com/v1beta/interactions")
    const headers = new Headers(init?.headers)
    expect(headers.get("x-goog-api-key")).toBe("gemini-key")
    expect(headers.get("x-goog-api-client")).toBe("anki-studio/0.1.0")
    expect(headers.get("authorization")).toBeNull()

    const body = JSON.parse(String(init?.body)) as Record<string, unknown>
    expect(body).toMatchObject({
      model: "gemini-3.7-flash",
      input: "Create one card.",
      store: false,
      response_format: {
        type: "text",
        mime_type: "application/json",
      },
    })
    expect(String(body.system_instruction)).toContain("Return the requested fields.")
    expect(String(body.system_instruction)).toContain("只返回 JSON 对象")
  })
})
