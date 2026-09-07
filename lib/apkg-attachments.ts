import JSZip from "jszip"

import { exportApkg as exportBaseApkg } from "./apkg"
import {
  attachmentAnkiHtml,
  parseAttachmentValue,
  resolveAttachmentBlob,
  type AttachmentRef,
} from "./attachments"
import type { Card, Deck } from "./deck"

export {
  MAX_ANKI_PACKAGE_BYTES,
  MAX_TEXT_IMPORT_BYTES,
  apkgImportWarnings,
  importApkg,
  importDeckFile,
  importFileSizeError,
  setSqlWasmPath,
} from "./apkg"
export type { ImportResult } from "./apkg"

type ExportOptions = {
  cards?: Card[]
  onProgress?: (done: number, total: number) => void
  signal?: AbortSignal
}

function cardForAnki(card: Card): Card {
  return {
    ...card,
    values: Object.fromEntries(
      Object.entries(card.values).map(([field, value]) => [field, attachmentAnkiHtml(value)])
    ),
  }
}

function attachmentRefs(cards: Card[]): AttachmentRef[] {
  const refs = new Map<string, AttachmentRef>()
  for (const card of cards) {
    for (const value of Object.values(card.values)) {
      const ref = parseAttachmentValue(value)
      if (ref) refs.set(ref.id, ref)
    }
  }
  return [...refs.values()]
}

function parseMediaMap(raw: string): Record<string, string> {
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {}
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>)
        .filter((entry): entry is [string, string] => typeof entry[1] === "string")
    )
  } catch {
    return {}
  }
}

export async function exportApkg(deck: Deck, options?: ExportOptions): Promise<Blob> {
  const sourceCards = options?.cards ?? deck.cards
  const refs = attachmentRefs(sourceCards)
  const exportDeck: Deck = { ...deck, cards: deck.cards.map(cardForAnki) }
  const blob = await exportBaseApkg(exportDeck, {
    ...options,
    cards: sourceCards.map(cardForAnki),
  })
  if (refs.length === 0) return blob

  const zip = await JSZip.loadAsync(blob)
  const mediaFile = zip.file("media")
  const media = parseMediaMap(mediaFile ? await mediaFile.async("string") : "{}")
  const names = new Set(Object.values(media))
  let nextIndex = 0
  while (Object.hasOwn(media, String(nextIndex))) nextIndex += 1

  for (const ref of refs) {
    if (options?.signal?.aborted) throw new DOMException("Aborted", "AbortError")
    if (names.has(ref.mediaName)) continue
    const attachment = await resolveAttachmentBlob(ref)
    const index = String(nextIndex)
    nextIndex += 1
    media[index] = ref.mediaName
    names.add(ref.mediaName)
    zip.file(index, new Uint8Array(await attachment.arrayBuffer()))
  }

  zip.file("media", JSON.stringify(media))
  return zip.generateAsync({ type: "blob" })
}
