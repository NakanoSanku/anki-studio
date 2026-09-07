import { describe, expect, it } from "vitest"

import {
  MAX_ATTACHMENT_BYTES,
  attachmentAnkiHtml,
  attachmentPreviewHtml,
  createAttachmentRef,
  encodeAttachmentValue,
  inferAttachmentKind,
  parseAttachmentValue,
} from "@/lib/attachments"

const id = "12345678-1234-4123-8123-123456789abc"

describe("attachment references", () => {
  it("round-trips an image as a compact field value", () => {
    const ref = createAttachmentRef({ name: "cat photo.png", type: "image/png", size: 1234 }, id)
    const value = encodeAttachmentValue(ref)

    expect(value).toBe(`[[attachment:v1:image:cat%20photo.png:${id}:png]]`)
    expect(parseAttachmentValue(value)).toEqual(ref)
    expect(ref.mediaName).toBe(`anki-studio-${id}.png`)
  })

  it("renders local preview markup without leaking a fake network src", () => {
    const ref = createAttachmentRef({ name: "cat.png", type: "image/png", size: 12 }, id)
    const html = attachmentPreviewHtml(encodeAttachmentValue(ref))

    expect(html).toContain("data-anki-studio-attachment")
    expect(html).toContain('alt="cat.png"')
    expect(html).not.toContain(" src=")
  })

  it("renders Anki-compatible image and video media names", () => {
    const image = createAttachmentRef({ name: "cat.png", type: "image/png", size: 12 }, id)
    const video = createAttachmentRef(
      { name: "clip.mp4", type: "video/mp4", size: 24 },
      "abcdefab-cdef-4abc-8def-abcdefabcdef"
    )

    expect(attachmentAnkiHtml(encodeAttachmentValue(image))).toContain(`src="${image.mediaName}"`)
    expect(attachmentAnkiHtml(encodeAttachmentValue(video))).toContain("<video")
    expect(attachmentAnkiHtml(encodeAttachmentValue(video))).toContain(`src="${video.mediaName}"`)
  })

  it("detects image and video files by MIME type or extension", () => {
    expect(inferAttachmentKind("photo.unknown", "image/webp")).toBe("image")
    expect(inferAttachmentKind("movie.webm", "")).toBe("video")
    expect(inferAttachmentKind("notes.txt", "text/plain")).toBeNull()
  })

  it("rejects unsupported files and oversized attachments", () => {
    expect(() => createAttachmentRef({ name: "notes.txt", type: "text/plain", size: 10 }, id)).toThrow(
      "Only image and video attachments are supported"
    )
    expect(() => createAttachmentRef({ name: "huge.mp4", type: "video/mp4", size: MAX_ATTACHMENT_BYTES + 1 }, id)).toThrow(
      "Attachment is too large"
    )
  })
})
