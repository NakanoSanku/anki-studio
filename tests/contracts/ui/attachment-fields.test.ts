import { describe, expect, it } from "vitest"

import { readSource, sourceExists } from "../helpers/source"

const tsconfig = readSource("tsconfig.json")
const editor = readSource("components", "card-editor-attachments.tsx")
const runtime = readSource("components", "attachment-runtime.tsx")
const template = readSource("lib", "template-attachments.ts")
const apkg = readSource("lib", "apkg-attachments.ts")
const tokenRoute = readSource("app", "api", "google-drive", "token", "route.ts")

describe("attachment field integration", () => {
  it("routes runtime imports through attachment wrappers without replacing the source-contract files", () => {
    expect(tsconfig).toContain('"@/components/card-editor": ["./components/card-editor-attachments.tsx"]')
    expect(tsconfig).toContain('"@/components/card-preview": ["./components/card-preview-attachments.tsx"]')
    expect(tsconfig).toContain('"@/components/study-session": ["./components/study-session-attachments.tsx"]')
    expect(tsconfig).toContain('"@/lib/apkg": ["./lib/apkg-attachments.ts"]')
    expect(tsconfig).toContain('"@/lib/template": ["./lib/template-attachments.ts"]')
    expect(sourceExists("components", "card-editor.tsx")).toBe(true)
    expect(sourceExists("components", "card-preview.tsx")).toBe(true)
    expect(sourceExists("components", "study-session.tsx")).toBe(true)
  })

  it("offers image/video fields, local/Drive resolution, and APKG media injection", () => {
    expect(editor).toContain('accept="image/*,video/*"')
    expect(editor).toContain("storeAttachmentBlob")
    expect(editor).toContain("mirrorAttachmentToDrive")
    expect(runtime).toContain("resolveAttachmentBlob")
    expect(runtime).toContain("URL.createObjectURL")
    expect(template).toContain("attachmentPreviewHtml")
    expect(apkg).toContain("attachmentAnkiHtml")
    expect(apkg).toContain('zip.file("media", JSON.stringify(media))')
    expect(tokenRoute).toContain("getGoogleSheetsAuthorization")
    expect(tokenRoute).toContain('"Cache-Control": "no-store"')
  })
})
