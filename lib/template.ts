import { isSecureMediaUrl, type MediaField } from "./deck"

const CONDITIONAL_RE = /\{\{([#^])([^}]+)\}\}([\s\S]*?)\{\{\/\2\}\}/g
const FIELD_RE = /\{\{([^#/^][^}]*)\}\}/g

function escapeAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("\"", "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
}

export function renderMediaValue(name: string, value: string, media?: MediaField): string {
  const url = value.trim()
  if (!media || !isSecureMediaUrl(url)) return ""
  const source = escapeAttribute(url)
  if (media.kind === "image") {
    return `<img src="${source}" alt="${escapeAttribute(name)}" loading="lazy" decoding="async">`
  }
  return `<audio src="${source}" controls preload="metadata" aria-label="${escapeAttribute(name)}"></audio>`
}

export function renderTemplate(
  template: string,
  values: Record<string, string>,
  extras: Record<string, string> = {},
  mediaFields: Record<string, MediaField> = {},
): string {
  const resolve = (name: string): string => {
    if (Object.hasOwn(extras, name)) return extras[name] ?? ""
    return values[name] ?? ""
  }

  const walk = (input: string): string =>
    input
      .replace(CONDITIONAL_RE, (_, kind: string, rawName: string, inner: string) => {
        const name = rawName.trim()
        const filled = mediaFields[name]
          ? Boolean(renderMediaValue(name, resolve(name), mediaFields[name]))
          : resolve(name).trim().length > 0
        const keep = kind === "#" ? filled : !filled
        return keep ? walk(inner) : ""
      })
      .replace(FIELD_RE, (_, rawName: string) => {
        const name = rawName.trim()
        const media = mediaFields[name]
        return media ? renderMediaValue(name, resolve(name), media) : resolve(name)
      })

  return walk(template)
}

export function renderCard(
  frontTemplate: string,
  backTemplate: string,
  values: Record<string, string>,
  mediaFields: Record<string, MediaField> = {},
): { front: string; back: string } {
  const front = renderTemplate(frontTemplate, values, {}, mediaFields)
  const back = renderTemplate(backTemplate, values, { FrontSide: front }, mediaFields)
  return { front, back }
}

export function previewDocument(css: string, html: string): string {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <style>
      html, body {
        margin: 0;
        min-height: 100%;
        width: 100%;
        max-width: 100%;
        overflow-x: hidden;
        -webkit-text-size-adjust: 100%;
      }
      *, *::before, *::after {
        box-sizing: border-box;
      }
      body.card {
        max-width: 100%;
        overflow-x: hidden;
        overflow-wrap: anywhere;
      }
      img, video, svg, canvas {
        max-width: 100%;
        height: auto;
      }
      table {
        max-width: 100%;
      }
      pre {
        max-width: 100%;
        overflow: auto;
        white-space: pre-wrap;
      }
      ${css}
    </style>
  </head>
  <body class="card">${html}</body>
</html>`
}
