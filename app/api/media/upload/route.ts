import { NextResponse } from "next/server"

import {
  DEFAULT_MEDIA_UPLOAD_ENDPOINT,
  DEFAULT_MEDIA_UPLOAD_STORAGE,
  MAX_IMAGE_UPLOAD_BYTES,
  extractImageUploadResponse,
  validateImageFile,
} from "@/lib/media-host"
import { createWindowRateLimiter, requestClientKey } from "@/lib/request-guard"
import { getGoogleAppAuthorization } from "@/lib/app-auth"

export const runtime = "nodejs"

const limiter = createWindowRateLimiter({ limit: 20, windowMs: 60_000 })

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

export async function POST(request: Request) {
  const appAuthorization = await getGoogleAppAuthorization()
  if (!appAuthorization.ok) return appAuthorization.response
  const rate = limiter(requestClientKey(request))
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many image uploads. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    )
  }

  const authorization = request.headers.get("authorization")?.trim()
  if (!authorization?.toLowerCase().startsWith("bearer ") || !authorization.slice(7).trim()) {
    return errorResponse("Configure an image hosting API token first.", 401)
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0)
  if (Number.isFinite(contentLength) && contentLength > MAX_IMAGE_UPLOAD_BYTES + 1024 * 1024) {
    return errorResponse("Images must be 10 MB or smaller.", 413)
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return errorResponse("The image upload request is invalid.", 400)
  }
  const file = form.get("file")
  if (!(file instanceof File)) return errorResponse("Choose an image file to upload.", 400)
  const fileError = validateImageFile(file)
  if (fileError) return errorResponse(fileError, 400)

  const upstream = new FormData()
  upstream.append("file", file, file.name || "image")
  const endpoint = process.env.MEDIA_UPLOAD_ENDPOINT?.trim() || DEFAULT_MEDIA_UPLOAD_ENDPOINT
  const storage = process.env.MEDIA_UPLOAD_STORAGE?.trim() || DEFAULT_MEDIA_UPLOAD_STORAGE
  try {
    const endpointUrl = new URL(endpoint)
    if (endpointUrl.protocol !== "https:") return errorResponse("The image service endpoint must use HTTPS.", 500)
  } catch {
    return errorResponse("The image service endpoint is invalid.", 500)
  }
  upstream.append("storage", storage)

  let response: Response
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: authorization },
      body: upstream,
      cache: "no-store",
    })
  } catch {
    return errorResponse("The image service is unavailable. Check your connection and try again.", 502)
  }

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const message = response.status === 401 || response.status === 403
      ? "The image hosting token was rejected."
      : response.status === 429
        ? "The image service rate limit was reached. Try again shortly."
        : `The image service returned an error (${response.status}).`
    return errorResponse(message, response.status >= 500 ? 502 : response.status)
  }
  const result = extractImageUploadResponse(payload)
  if (!result) return errorResponse("The image service returned an invalid download URL.", 502)

  return NextResponse.json({ links: result.links, storage })
}
