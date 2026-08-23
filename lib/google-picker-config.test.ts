import { describe, expect, it } from "vitest"

import { readGooglePickerConfiguration } from "./google-picker-config"

describe("Google Picker configuration", () => {
  it("requires the browser key and numeric Cloud project number", () => {
    expect(readGooglePickerConfiguration({})).toEqual({
      state: "invalid",
      issue: "Google Picker 缺少 GOOGLE_PICKER_API_KEY、GOOGLE_CLOUD_PROJECT_NUMBER",
    })
  })

  it("returns runtime Picker settings when complete", () => {
    expect(readGooglePickerConfiguration({
      GOOGLE_PICKER_API_KEY: "AIza-a-browser-key-long-enough",
      GOOGLE_CLOUD_PROJECT_NUMBER: "123456789012",
    })).toEqual({
      state: "ready",
      developerKey: "AIza-a-browser-key-long-enough",
      appId: "123456789012",
    })
  })
})
