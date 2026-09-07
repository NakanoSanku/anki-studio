import { attachmentPreviewHtml } from "./attachments"
import {
  previewDocument,
  renderCard as renderBaseCard,
  renderTemplate as renderBaseTemplate,
} from "./template"

export { previewDocument }

function previewValues(values: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(values).map(([name, value]) => [name, attachmentPreviewHtml(value)])
  )
}

export function renderTemplate(
  template: string,
  values: Record<string, string>,
  extras: Record<string, string> = {}
): string {
  return renderBaseTemplate(template, previewValues(values), previewValues(extras))
}

export function renderCard(
  frontTemplate: string,
  backTemplate: string,
  values: Record<string, string>
): { front: string; back: string } {
  return renderBaseCard(frontTemplate, backTemplate, previewValues(values))
}
