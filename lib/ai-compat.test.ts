import { describe, expect, it } from "vitest"

import { parseJsonPayload, pickCardList, pickFieldValues, readChatText } from "./ai-compat"
import { parseAiSettings } from "./ai-settings"

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
})

describe("parseAiSettings transport", () => {
  it("defaults missing transport to auto", () => {
    expect(parseAiSettings({ baseURL: "https://relay.example/v1" }).transport).toBe("auto")
    expect(parseAiSettings({ transport: "browser" }).transport).toBe("browser")
    expect(parseAiSettings({ transport: "nope" }).transport).toBe("auto")
  })
})
