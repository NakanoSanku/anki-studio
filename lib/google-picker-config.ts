type Environment = Record<string, string | undefined>

export type GooglePickerConfiguration =
  | { state: "invalid"; issue: string }
  | { state: "ready"; developerKey: string; appId: string }

export function readGooglePickerConfiguration(
  environment: Environment = process.env
): GooglePickerConfiguration {
  const developerKey = environment.GOOGLE_PICKER_API_KEY?.trim() ?? ""
  const appId = environment.GOOGLE_CLOUD_PROJECT_NUMBER?.trim() ?? ""
  const missing: string[] = []
  if (!developerKey) missing.push("GOOGLE_PICKER_API_KEY")
  if (!appId) missing.push("GOOGLE_CLOUD_PROJECT_NUMBER")
  if (missing.length > 0) {
    return { state: "invalid", issue: `Google Picker 缺少 ${missing.join("、")}` }
  }
  if (!/^\d{6,20}$/.test(appId)) {
    return { state: "invalid", issue: "GOOGLE_CLOUD_PROJECT_NUMBER 无效" }
  }
  if (developerKey.length < 20) {
    return { state: "invalid", issue: "GOOGLE_PICKER_API_KEY 无效" }
  }
  return { state: "ready", developerKey, appId }
}
