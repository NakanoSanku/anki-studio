import firebaseConfig from "@/firebase-applet-config.json"

type Environment = Record<string, string | undefined>

export type GooglePickerConfiguration =
  | { state: "invalid"; issue: string }
  | { state: "ready"; developerKey: string; appId: string }

export function readGooglePickerConfiguration(
  environment: Environment = process.env
): GooglePickerConfiguration {
  const isDefaultEnv = environment === process.env
  const developerKey = environment.GOOGLE_PICKER_API_KEY?.trim()
    || environment.GOOGLE_API_KEY?.trim()
    || environment.GEMINI_API_KEY?.trim()
    || (isDefaultEnv ? firebaseConfig?.apiKey?.trim() : "")
    || ""

  let appId = environment.GOOGLE_CLOUD_PROJECT_NUMBER?.trim()
    || environment.GOOGLE_PROJECT_NUMBER?.trim()
    || (isDefaultEnv ? firebaseConfig?.messagingSenderId?.trim() : "")
    || ""

  if (!appId && environment.GOOGLE_CLIENT_ID) {
    const match = /^(\d{6,20})-/.exec(environment.GOOGLE_CLIENT_ID.trim())
    if (match?.[1]) {
      appId = match[1]
    }
  }

  if (!appId && isDefaultEnv && firebaseConfig?.oAuthClientId) {
    const match = /^(\d{6,20})-/.exec(firebaseConfig.oAuthClientId.trim())
    if (match?.[1]) {
      appId = match[1]
    }
  }

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
