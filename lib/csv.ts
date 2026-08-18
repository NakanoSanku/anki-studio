import { appendUniqueCards, createCard, textFields, type Deck } from "./deck"

export type CsvParseResult = {
  rows: string[][]
  unclosedQuote: boolean
}

export function parseCsvDetailed(text: string): CsvParseResult {
  const src = text.replace(/^\uFEFF/, "")
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let i = 0
  let inQuotes = false

  const pushRow = () => {
    if (row.some((cell) => cell.trim() !== "") || rows.length === 0) {
      rows.push(row)
    }
    row = []
  }

  while (i < src.length) {
    const char = src[i]
    if (inQuotes) {
      if (char === '"') {
        if (src[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i += 1
        continue
      }
      field += char
      i += 1
      continue
    }

    if (char === '"') {
      inQuotes = true
      i += 1
      continue
    }
    if (char === ",") {
      row.push(field)
      field = ""
      i += 1
      continue
    }
    if (char === "\r") {
      i += 1
      continue
    }
    if (char === "\n") {
      row.push(field)
      field = ""
      pushRow()
      i += 1
      continue
    }
    field += char
    i += 1
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field)
    pushRow()
  }

  return { rows, unclosedQuote: inQuotes }
}

export function parseCsv(text: string): string[][] {
  return parseCsvDetailed(text).rows
}

function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`
  }
  return value
}

export function serializeCsv(rows: string[][]): string {
  const body = rows.map((row) => row.map(escapeCsvField).join(",")).join("\r\n")
  return `\uFEFF${body}\r\n`
}

export function deckToCsv(deck: Deck): string {
  const header = textFields(deck)
  const data = deck.cards.map((card) => header.map((field) => card.values[field] ?? ""))
  return serializeCsv([header, ...data])
}

export function csvToDeck(text: string, current: Deck): Deck {
  const rows = parseCsv(text)
  if (rows.length === 0) {
    throw new Error("CSV 是空的")
  }

  const fields = rows[0].map((header) => header.trim())
  if (fields.length === 0 || fields.some((field) => !field)) {
    throw new Error("CSV 表头不能有空列")
  }
  if (new Set(fields).size !== fields.length) {
    throw new Error("CSV 表头字段不能重复")
  }

  const incoming = rows.slice(1).map((row) => {
    const values: Record<string, string> = {}
    fields.forEach((field, index) => {
      values[field] = row[index] ?? ""
    })
    return createCard(fields, values)
  })

  return {
    ...current,
    cards: appendUniqueCards(current.cards, current.fields, incoming, fields),
  }
}
