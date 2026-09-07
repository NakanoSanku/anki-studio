export const MAX_ATTACHMENT_BYTES = 128 * 1024 * 1024
export const ATTACHMENT_DATA_ATTRIBUTE = "data-anki-studio-attachment"

export type AttachmentKind = "image" | "video"

export type AttachmentRef = {
  version: 1
  id: string
  kind: AttachmentKind
  name: string
  extension: string
  mediaName: string
  mimeType: string
}

type StoredAttachment = {
  id: string
  name: string
  mimeType: string
  size: number
  blob: Blob
  updatedAt: number
}

type DriveFile = {
  id?: string
  name?: string
  mimeType?: string
  size?: string
}

export type DriveMirrorResult = {
  uploaded: boolean
  message: string
}

const DB_NAME = "anki-studio.attachments.v1"
const DB_VERSION = 1
const STORE_NAME = "files"
const DRIVE_APP_PROPERTY = "anki_studio_attachment_id"
const DRIVE_API_ROOT = "https://www.googleapis.com/drive/v3"
const DRIVE_UPLOAD_ROOT = "https://www.googleapis.com/upload/drive/v3"

const IMAGE_EXTENSIONS = new Set(["avif", "bmp", "gif", "heic", "heif", "jpeg", "jpg", "png", "svg", "webp"])
const VIDEO_EXTENSIONS = new Set(["m4v", "mkv", "mov", "mp4", "ogv", "webm"])

const MIME_BY_EXTENSION: Record<string, string> = {
  avif: "image/avif",
  bmp: "image/bmp",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  svg: "image/svg+xml",
  webp: "image/webp",
  m4v: "video/x-m4v",
  mkv: "video/x-matroska",
  mov: "video/quicktime",
  mp4: "video/mp4",
  ogv: "video/ogg",
  webm: "video/webm",
}

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/avif": "avif",
  "image/bmp": "bmp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/svg+xml": "svg",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/ogg": "ogv",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "video/x-m4v": "m4v",
  "video/x-matroska": "mkv",
}

let dbPromise: Promise<IDBDatabase> | null = null

function extensionFromName(name: string): string {
  const match = name.toLowerCase().match(/\.([a-z0-9]{1,8})$/)
  return match?.[1] ?? ""
}

export function inferAttachmentKind(name: string, mimeType = ""): AttachmentKind | null {
  const normalizedMime = mimeType.toLowerCase()
  if (normalizedMime.startsWith("image/")) return "image"
  if (normalizedMime.startsWith("video/")) return "video"
  const extension = extensionFromName(name)
  if (IMAGE_EXTENSIONS.has(extension)) return "image"
  if (VIDEO_EXTENSIONS.has(extension)) return "video"
  return null
}

function extensionFor(name: string, mimeType: string, kind: AttachmentKind): string {
  const fromName = extensionFromName(name)
  if (kind === "image" && IMAGE_EXTENSIONS.has(fromName)) return fromName
  if (kind === "video" && VIDEO_EXTENSIONS.has(fromName)) return fromName
  const fromMime = EXTENSION_BY_MIME[mimeType.toLowerCase()]
  if (fromMime) return fromMime
  return kind === "image" ? "png" : "mp4"
}

function mimeFor(extension: string, mimeType: string, kind: AttachmentKind): string {
  if (mimeType.toLowerCase().startsWith(`${kind}/`)) return mimeType.toLowerCase()
  return MIME_BY_EXTENSION[extension] ?? `${kind}/${extension}`
}

function nextAttachmentId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID()
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16)
    const value = character === "x" ? random : (random & 0x3) | 0x8
    return value.toString(16)
  })
}

export function attachmentSizeError(size: number): string | null {
  if (!Number.isFinite(size) || size < 0) return "Attachment size is invalid"
  if (size <= MAX_ATTACHMENT_BYTES) return null
  return `Attachment is too large (${Math.floor(MAX_ATTACHMENT_BYTES / 1024 / 1024)} MB limit)`
}

export function createAttachmentRef(
  file: { name: string; type: string; size: number },
  id = nextAttachmentId()
): AttachmentRef {
  const sizeError = attachmentSizeError(file.size)
  if (sizeError) throw new Error(sizeError)
  const kind = inferAttachmentKind(file.name, file.type)
  if (!kind) throw new Error("Only image and video attachments are supported")
  const extension = extensionFor(file.name, file.type, kind)
  const name = file.name.trim() || `attachment.${extension}`
  return {
    version: 1,
    id,
    kind,
    name,
    extension,
    mediaName: `anki-studio-${id}.${extension}`,
    mimeType: mimeFor(extension, file.type, kind),
  }
}

export function encodeAttachmentValue(ref: AttachmentRef): string {
  const encodedName = encodeURIComponent(ref.name)
  return `[[attachment:v1:${ref.kind}:${encodedName}:${ref.id}:${ref.extension}]]`
}

export function parseAttachmentValue(value: string): AttachmentRef | null {
  const match = value.trim().match(/^\[\[attachment:v1:(image|video):([^:]+):([0-9a-f-]{36}):([a-z0-9]{1,8})\]\]$/i)
  if (!match) return null
  const kind = match[1]!.toLowerCase() as AttachmentKind
  const extension = match[4]!.toLowerCase()
  if (kind === "image" && !IMAGE_EXTENSIONS.has(extension)) return null
  if (kind === "video" && !VIDEO_EXTENSIONS.has(extension)) return null
  let name: string
  try {
    name = decodeURIComponent(match[2]!)
  } catch {
    return null
  }
  if (!name.trim()) return null
  const id = match[3]!.toLowerCase()
  return {
    version: 1,
    id,
    kind,
    name,
    extension,
    mediaName: `anki-studio-${id}.${extension}`,
    mimeType: MIME_BY_EXTENSION[extension] ?? `${kind}/${extension}`,
  }
}

function escapeAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
}

export function attachmentPreviewHtml(value: string): string {
  const ref = parseAttachmentValue(value)
  if (!ref) return value
  const payload = escapeAttribute(encodeURIComponent(value.trim()))
  const label = escapeAttribute(ref.name)
  if (ref.kind === "image") {
    return `<img ${ATTACHMENT_DATA_ATTRIBUTE}="${payload}" alt="${label}" />`
  }
  return `<video ${ATTACHMENT_DATA_ATTRIBUTE}="${payload}" aria-label="${label}" controls playsinline preload="metadata"></video>`
}

export function attachmentAnkiHtml(value: string): string {
  const ref = parseAttachmentValue(value)
  if (!ref) return value
  const mediaName = escapeAttribute(ref.mediaName)
  const label = escapeAttribute(ref.name)
  if (ref.kind === "image") return `<img src="${mediaName}" alt="${label}" />`
  return `<video src="${mediaName}" aria-label="${label}" controls playsinline preload="metadata"></video>`
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error("Attachment storage request failed"))
  })
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error("Attachment storage transaction failed"))
    transaction.onabort = () => reject(transaction.error ?? new Error("Attachment storage transaction was aborted"))
  })
}

function openAttachmentDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("Attachment storage is unavailable in this browser"))
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: "id" })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error("Couldn’t open attachment storage"))
  })
  return dbPromise
}

export async function storeAttachmentBlob(ref: AttachmentRef, blob: Blob): Promise<void> {
  const sizeError = attachmentSizeError(blob.size)
  if (sizeError) throw new Error(sizeError)
  const db = await openAttachmentDb()
  const transaction = db.transaction(STORE_NAME, "readwrite")
  transaction.objectStore(STORE_NAME).put({
    id: ref.id,
    name: ref.name,
    mimeType: ref.mimeType,
    size: blob.size,
    blob,
    updatedAt: Date.now(),
  } satisfies StoredAttachment)
  await transactionDone(transaction)
}

export async function getStoredAttachment(ref: AttachmentRef): Promise<StoredAttachment | null> {
  if (typeof indexedDB === "undefined") return null
  const db = await openAttachmentDb()
  const transaction = db.transaction(STORE_NAME, "readonly")
  const result = await requestResult(transaction.objectStore(STORE_NAME).get(ref.id)) as StoredAttachment | undefined
  await transactionDone(transaction)
  return result ?? null
}

async function removeStoredAttachment(ref: AttachmentRef): Promise<void> {
  if (typeof indexedDB === "undefined") return
  const db = await openAttachmentDb()
  const transaction = db.transaction(STORE_NAME, "readwrite")
  transaction.objectStore(STORE_NAME).delete(ref.id)
  await transactionDone(transaction)
}

async function driveAccessToken(): Promise<string | null> {
  try {
    const response = await fetch("/api/google-drive/token", {
      headers: { Accept: "application/json" },
      cache: "no-store",
    })
    if (!response.ok) return null
    const data = await response.json() as { accessToken?: unknown }
    return typeof data.accessToken === "string" && data.accessToken.trim() ? data.accessToken.trim() : null
  } catch {
    return null
  }
}

async function findDriveFile(ref: AttachmentRef, token: string): Promise<DriveFile | null> {
  const query = `appProperties has { key='${DRIVE_APP_PROPERTY}' and value='${ref.id}' } and trashed = false`
  const params = new URLSearchParams({
    q: query,
    pageSize: "1",
    fields: "files(id,name,mimeType,size)",
  })
  const response = await fetch(`${DRIVE_API_ROOT}/files?${params}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    cache: "no-store",
  })
  if (!response.ok) throw new Error(`Google Drive lookup failed (${response.status})`)
  const data = await response.json() as { files?: DriveFile[] }
  return data.files?.[0] ?? null
}

export async function mirrorAttachmentToDrive(ref: AttachmentRef, blob: Blob): Promise<DriveMirrorResult> {
  const token = await driveAccessToken()
  if (!token) {
    return {
      uploaded: false,
      message: "Saved on this device. Connect Google Drive to sync this attachment across devices.",
    }
  }

  try {
    const existing = await findDriveFile(ref, token)
    if (existing?.id) return { uploaded: true, message: "Saved locally and synced to Google Drive." }

    const boundary = `anki-studio-${ref.id}`
    const metadata = JSON.stringify({
      name: ref.mediaName,
      mimeType: ref.mimeType,
      appProperties: { [DRIVE_APP_PROPERTY]: ref.id },
    })
    const prefix = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${ref.mimeType}\r\n\r\n`
    const suffix = `\r\n--${boundary}--`
    const body = new Blob([prefix, blob, suffix], { type: `multipart/related; boundary=${boundary}` })
    const response = await fetch(`${DRIVE_UPLOAD_ROOT}/files?uploadType=multipart&fields=id`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    })
    if (!response.ok) throw new Error(`Google Drive upload failed (${response.status})`)
    return { uploaded: true, message: "Saved locally and synced to Google Drive." }
  } catch (error) {
    return {
      uploaded: false,
      message: error instanceof Error
        ? `Saved on this device. ${error.message}`
        : "Saved on this device. Google Drive upload failed.",
    }
  }
}

export async function resolveAttachmentBlob(ref: AttachmentRef): Promise<Blob> {
  const stored = await getStoredAttachment(ref)
  if (stored?.blob) return stored.blob

  const token = await driveAccessToken()
  if (!token) throw new Error(`Attachment “${ref.name}” is not stored on this device and Google Drive is not connected`)
  const remote = await findDriveFile(ref, token)
  if (!remote?.id) throw new Error(`Attachment “${ref.name}” could not be found in Google Drive`)
  const response = await fetch(`${DRIVE_API_ROOT}/files/${encodeURIComponent(remote.id)}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  if (!response.ok) throw new Error(`Attachment download failed (${response.status})`)
  const blob = await response.blob()
  const sizeError = attachmentSizeError(blob.size)
  if (sizeError) throw new Error(sizeError)
  await storeAttachmentBlob(ref, blob)
  return blob
}

export async function removeAttachment(ref: AttachmentRef): Promise<void> {
  await removeStoredAttachment(ref).catch(() => undefined)
  const token = await driveAccessToken()
  if (!token) return
  try {
    const remote = await findDriveFile(ref, token)
    if (!remote?.id) return
    await fetch(`${DRIVE_API_ROOT}/files/${encodeURIComponent(remote.id)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
  } catch {
    // Best-effort cleanup. The card reference is already gone locally.
  }
}
