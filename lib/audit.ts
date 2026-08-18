import {
  cardKeyValue,
  findDuplicateCard,
  isCardEmpty,
  normalizeCardKey,
  textFields,
  type Card,
  type Deck,
  type FieldChangeResult,
} from "./deck"
import type { EditorState } from "./editor-state"

export const AUDIT_CHUNK_SIZE = 5
export const AUDIT_MAX_COUNT = 100
export const AUDIT_INSTRUCTION_KEY = "anki-studio.audit-instruction"

export type AuditScope = "unreviewed" | "flagged" | "visible" | "all"

export type AuditCardResult = {
  id: string
  values: Record<string, string>
}

export const DEFAULT_AUDIT_INSTRUCTION = `请按这些标准审核并改写：
- 首字段（单词）保持原样，除非有明显拼写错误
- 释义准确、简洁，不要堆砌词典条目
- 例句自然，必须包含该单词
- 去掉机翻腔、空话和与单词无关的内容
已经合格的字段保持原样。`

export function readAuditInstruction(): string {
  try {
    const raw = globalThis.localStorage?.getItem(AUDIT_INSTRUCTION_KEY)
    if (typeof raw === "string" && raw.trim()) return raw
  } catch {
    // ignore
  }
  return DEFAULT_AUDIT_INSTRUCTION
}

export function writeAuditInstruction(text: string): void {
  try {
    globalThis.localStorage?.setItem(AUDIT_INSTRUCTION_KEY, text)
  } catch {
    // ignore
  }
}

export function chunkItems<T>(items: T[], size: number): T[][] {
  const chunkSize = Math.max(1, Math.floor(size))
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize))
  }
  return chunks
}

export function formatAuditCards(cards: Card[], fields: string[]): string {
  return cards
    .map((card) => {
      const lines = [`id: ${card.id}`]
      for (const field of fields) {
        lines.push(`${field}: ${card.values[field]?.trim() || "（空）"}`)
      }
      return lines.join("\n")
    })
    .join("\n\n")
}

export function selectAuditTargets(
  cards: Card[],
  fields: string[],
  input: {
    scope: AuditScope
    visibleIds: string[]
    review: Pick<EditorState, "reviewed" | "flagged">
    limit: number
  }
): Card[] {
  const limit = Math.min(AUDIT_MAX_COUNT, Math.max(1, Math.floor(input.limit)))
  const reviewed = new Set(input.review.reviewed)
  const flagged = new Set(input.review.flagged)
  const visible = new Set(input.visibleIds)
  const selected = cards.filter((card) => {
    if (isCardEmpty(card, fields)) return false
    if (input.scope === "unreviewed") return !reviewed.has(card.id)
    if (input.scope === "flagged") return flagged.has(card.id)
    if (input.scope === "visible") return visible.has(card.id)
    return true
  })
  return selected.slice(0, limit)
}

export function resolveAuditCard(
  allowed: Card[],
  fields: string[],
  incoming: AuditCardResult
): Card | undefined {
  if (incoming.id) {
    const byId = allowed.find((card) => card.id === incoming.id)
    if (byId) return byId
  }
  const key = fields[0] ? incoming.values[fields[0]] ?? "" : ""
  const needle = normalizeCardKey(key)
  if (!needle) return undefined
  return allowed.find((card) => cardKeyValue(card, fields) === needle)
}

export function mergeAuditValues(
  deck: Deck,
  cardId: string,
  incoming: Record<string, string>
): FieldChangeResult {
  const card = deck.cards.find((item) => item.id === cardId)
  if (!card) return { ok: false, error: "卡片已删除" }

  const nextValues = { ...card.values }
  let changed = false
  for (const field of textFields(deck)) {
    const generated = incoming[field]
    if (typeof generated !== "string" || !generated.trim()) continue
    if (nextValues[field] === generated) continue
    nextValues[field] = generated
    changed = true
  }
  if (!changed) return { ok: true, deck }

  const key = deck.fields[0]
  if (key && nextValues[key] !== card.values[key]) {
    if (!nextValues[key]?.trim()) {
      return { ok: false, error: "审核结果把首字段清空了" }
    }
    const duplicate = findDuplicateCard(deck.cards, deck.fields, nextValues[key] ?? "", cardId)
    if (duplicate) {
      return { ok: false, error: `已存在卡片「${nextValues[key].trim()}」` }
    }
  }

  return {
    ok: true,
    deck: {
      ...deck,
      cards: deck.cards.map((item) => (item.id === cardId ? { ...item, values: nextValues } : item)),
    },
  }
}

export function applyAuditResults(
  deck: Deck,
  allowed: Card[],
  incoming: AuditCardResult[]
): { deck: Deck; applied: string[]; unchanged: string[]; skipped: string[] } {
  const allowedIds = new Set(allowed.map((card) => card.id))
  let next = deck
  const applied: string[] = []
  const unchanged: string[] = []
  const skipped: string[] = []
  const seen = new Set<string>()

  for (const item of incoming) {
    const card = resolveAuditCard(
      next.cards.filter((entry) => allowedIds.has(entry.id)),
      next.fields,
      item
    )
    if (!card || seen.has(card.id)) {
      skipped.push(item.id || item.values[next.fields[0] ?? ""] || "")
      continue
    }
    seen.add(card.id)
    const result = mergeAuditValues(next, card.id, item.values)
    if (!result.ok) {
      skipped.push(card.id)
      continue
    }
    if (result.deck === next) unchanged.push(card.id)
    else applied.push(card.id)
    next = result.deck
  }

  return { deck: next, applied, unchanged, skipped }
}
