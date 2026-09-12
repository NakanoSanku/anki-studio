export const MEDIA_HOST_SETTINGS_KEY = "anki-studio.media-host.v1"
export const MEDIA_HOST_SETTINGS_CHANGED_EVENT = "anki-studio:media-host-settings-changed"
export const DEFAULT_MEDIA_UPLOAD_ENDPOINT = "https://k-vault.kaiton.dev/api/v1/upload"
export const DEFAULT_MEDIA_UPLOAD_STORAGE = "telegram"
export const MAX_IMAGE_UPLOAD_BYTES = 10 * 1024 * 1024

export const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const
export type ImageMimeType = (typeof IMAGE_MIME_TYPES)[number]

export type ImageUploadSettings = {
  apiToken: string
}

export type ImageUploadResponse = {
  links: {
    download: string
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function parseImageUploadSettings(raw: unknown): ImageUploadSettings {
  if (!isRecord(raw)) return { apiToken: "" }
  return { apiToken: typeof raw.apiToken === "string" ? raw.apiToken : "" }
}

export function readImageUploadSettings(): ImageUploadSettings {
  if (typeof window === "undefined") return { apiToken: "" }
  try {
    const raw = localStorage.getItem(MEDIA_HOST_SETTINGS_KEY)
    return raw ? parseImageUploadSettings(JSON.parse(raw)) : { apiToken: "" }
  } catch {
    return { apiToken: "" }
  }
}

export function writeImageUploadSettings(settings: ImageUploadSettings) {
  const apiToken = settings.apiToken.trim()
  localStorage.setItem(MEDIA_HOST_SETTINGS_KEY, JSON.stringify({ apiToken }))
  window.dispatchEvent(new Event(MEDIA_HOST_SETTINGS_CHANGED_EVENT))
}

export function clearImageUploadSettings() {
  localStorage.removeItem(MEDIA_HOST_SETTINGS_KEY)
  window.dispatchEvent(new Event(MEDIA_HOST_SETTINGS_CHANGED_EVENT))
}

export function isImageMimeType(value: string): value is ImageMimeType {
  return (IMAGE_MIME_TYPES as readonly string[]).includes(value)
}

export function validateImageFile(file: File): string | null {
  if (!isImageMimeType(file.type)) return "Only JPEG, PNG, WebP, and GIF images are supported."
  if (file.size > MAX_IMAGE_UPLOAD_BYTES) return "Images must be 10 MB or smaller."
  return null
}

export function validateImageDownloadUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null
  try {
    const url = new URL(value.trim())
    if (url.protocol !== "https:") return null
    return url.toString()
  } catch {
    return null
  }
}

export function extractImageUploadResponse(payload: unknown): ImageUploadResponse | null {
  if (!isRecord(payload) || !isRecord(payload.links)) return null
  const download = validateImageDownloadUrl(payload.links.download)
  return download ? { links: { download } } : null
}

export async function uploadImage(file: File, apiToken: string, signal?: AbortSignal): Promise<string> {
  const fileError = validateImageFile(file)
  if (fileError) throw new Error(fileError)
  const token = apiToken.trim()
  if (!token) throw new Error("Configure an image hosting API token in Settings first.")

  const form = new FormData()
  form.append("file", file, file.name)
  form.append("storage", DEFAULT_MEDIA_UPLOAD_STORAGE)
  const response = await fetch("/api/media/upload", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
    signal,
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const message = isRecord(payload) && typeof payload.error === "string" ? payload.error : `Image upload failed (${response.status})`
    throw new Error(message)
  }
  const result = extractImageUploadResponse(payload)
  if (!result) throw new Error("The image service returned an invalid download URL.")
  return result.links.download
}
