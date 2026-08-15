export type Card = {
  id: string
  values: Record<string, string>
}

export type TtsLang = "en" | "th"

export type TtsField = {
  source: string
  lang: TtsLang
  slow: boolean
}

export type Deck = {
  version: 1
  name: string
  fields: string[]
  fieldNotes: Record<string, string>
  fieldTts: Record<string, TtsField>
  front: string
  back: string
  css: string
  cards: Card[]
}

export const TTS_LANGS: { id: TtsLang; label: string }[] = [
  { id: "en", label: "英语" },
  { id: "th", label: "泰语" },
]

export const TTS_FIELD_META = "anki-studio.tts:"
export const TTS_PREVIEW_MARK = "\u2063"

export const STORAGE_KEY = "anki-studio.deck.v1"

export const DEFAULT_FIELDS = [
  "Word",
  "Phonetic",
  "Translation",
  "Example",
  "ExampleTranslation",
  "Notes",
] as const

export const DEFAULT_FIELD_NOTES: Record<string, string> = {
  Word: "英文单词原形",
  Phonetic: "IPA 音标",
  Translation: "中文释义，简洁准确",
  Example: "一句英文例句，尽量包含该单词",
  ExampleTranslation: "例句的中文翻译",
  Notes: "词性、搭配或记忆提示",
}

export function notesOf(deck: Pick<Deck, "fields"> & { fieldNotes?: Record<string, string> }): Record<string, string> {
  const notes = deck.fieldNotes ?? {}
  return Object.fromEntries(deck.fields.map((field) => [field, notes[field] ?? ""]))
}

export function isTtsLang(value: unknown): value is TtsLang {
  return value === "en" || value === "th"
}

export function ttsLangLabel(lang: TtsLang): string {
  return lang === "th" ? "泰语" : "英语"
}

export function parseTtsField(raw: unknown): TtsField | null {
  if (!isRecord(raw)) return null
  if (!isTtsLang(raw.lang)) return null
  if (typeof raw.source !== "string" || !raw.source.trim()) return null
  return {
    source: raw.source.trim(),
    lang: raw.lang,
    slow: Boolean(raw.slow),
  }
}

export function encodeTtsMeta(tts: TtsField): string {
  return TTS_FIELD_META + JSON.stringify(tts)
}

export function decodeTtsMeta(raw: string | undefined): TtsField | null {
  if (!raw?.startsWith(TTS_FIELD_META)) return null
  try {
    return parseTtsField(JSON.parse(raw.slice(TTS_FIELD_META.length)))
  } catch {
    return null
  }
}

export function ttsOf(deck: Pick<Deck, "fields"> & { fieldTts?: Record<string, TtsField> }): Record<string, TtsField> {
  const raw = deck.fieldTts ?? {}
  const next: Record<string, TtsField> = {}
  for (const field of deck.fields) {
    const item = parseTtsField(raw[field])
    if (item) next[field] = item
  }

  const first = deck.fields[0]
  if (first) delete next[first]

  for (const [name, tts] of Object.entries(next)) {
    if (!deck.fields.includes(tts.source) || next[tts.source] || tts.source === name) {
      delete next[name]
    }
  }
  return next
}

export function isTtsField(deck: Pick<Deck, "fields"> & { fieldTts?: Record<string, TtsField> }, name: string): boolean {
  return Boolean(ttsOf(deck)[name])
}

export function textFields(deck: Pick<Deck, "fields"> & { fieldTts?: Record<string, TtsField> }): string[] {
  const tts = ttsOf(deck)
  return deck.fields.filter((field) => !tts[field])
}

export function previewValues(deck: Deck, values: Record<string, string> = {}): Record<string, string> {
  const next = { ...emptyValues(deck.fields), ...values }
  for (const [name, tts] of Object.entries(ttsOf(deck))) {
    next[name] = (values[tts.source] ?? "").trim() ? TTS_PREVIEW_MARK : ""
  }
  return next
}

function renameFieldNote(notes: Record<string, string>, from: string, to: string): Record<string, string> {
  const next = { ...notes }
  next[to] = next[from] ?? ""
  delete next[from]
  return next
}

function omitFieldNote(notes: Record<string, string>, name: string): Record<string, string> {
  const next = { ...notes }
  delete next[name]
  return next
}

export function setFieldNote(deck: Deck, field: string, note: string): Deck {
  if (!deck.fields.includes(field)) return deck
  return {
    ...deck,
    fieldNotes: { ...notesOf(deck), [field]: note },
  }
}

export const DEFAULT_FRONT = `<div class="word">{{Word}}</div>
{{#Phonetic}}<div class="reading">{{Phonetic}}</div>{{/Phonetic}}`

export const DEFAULT_BACK = `{{FrontSide}}
<hr id="answer">
<div class="meaning">{{Translation}}</div>
{{#Example}}<div class="example">{{Example}}</div>{{/Example}}
{{#ExampleTranslation}}<div class="example-translation">{{ExampleTranslation}}</div>{{/ExampleTranslation}}
{{#Notes}}<div class="notes">{{Notes}}</div>{{/Notes}}`

export const DEFAULT_CSS = `.card {
  font-family: "Segoe UI", "PingFang SC", "Noto Sans SC", sans-serif;
  font-size: 22px;
  text-align: center;
  color: #1a1a1a;
  background-color: #ffffff;
  padding: 28px 20px;
}

.word {
  font-size: 36px;
  font-weight: 650;
  letter-spacing: -0.03em;
  line-height: 1.2;
}

.reading {
  margin-top: 10px;
  color: #667085;
  font-size: 18px;
}

.meaning {
  margin-top: 4px;
  line-height: 1.55;
}

.example {
  margin-top: 18px;
  color: #4b5563;
  font-size: 16px;
  font-style: italic;
  line-height: 1.5;
}

.example-translation {
  margin-top: 6px;
  color: #667085;
  font-size: 14px;
  line-height: 1.45;
}

.notes {
  margin-top: 16px;
  color: #6b7280;
  font-size: 13px;
  line-height: 1.45;
}`

export function createCardId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function emptyValues(fields: string[]): Record<string, string> {
  return Object.fromEntries(fields.map((field) => [field, ""]))
}

export function createCard(fields: string[], values: Record<string, string> = {}): Card {
  return {
    id: createCardId(),
    values: { ...emptyValues(fields), ...values },
  }
}

export function readStoredDeck(): Deck {
  if (typeof window === "undefined") return createDefaultDeck()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return parseDeckJson(raw)
  } catch {
    // ignore broken local data
  }
  return createDefaultDeck()
}

export function createDefaultDeck(): Deck {
  return {
    version: 1,
    name: "单词本",
    fields: [...DEFAULT_FIELDS],
    fieldNotes: { ...DEFAULT_FIELD_NOTES },
    fieldTts: {},
    front: DEFAULT_FRONT,
    back: DEFAULT_BACK,
    css: DEFAULT_CSS,
    cards: [
      createCard([...DEFAULT_FIELDS], {
        Word: "ephemeral",
        Phonetic: "/ɪˈfem.ər.əl/",
        Translation: "短暂的；转瞬即逝的",
        Example: "Fashion is ephemeral.",
        ExampleTranslation: "时尚是转瞬即逝的。",
        Notes: "adj. 常形容时间、潮流、生命等",
      }),
    ],
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function parseDeckJson(raw: string): Deck {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    throw new Error("JSON 无法解析")
  }

  if (!isRecord(data)) {
    throw new Error("卡包格式无效")
  }

  if (data.version !== 1) {
    throw new Error("不支持的卡包版本")
  }

  if (typeof data.name !== "string" || !data.name.trim()) {
    throw new Error("缺少卡包名称")
  }

  if (
    !Array.isArray(data.fields) ||
    data.fields.length === 0 ||
    data.fields.some((field) => typeof field !== "string" || !field.trim())
  ) {
    throw new Error("字段列表无效")
  }

  const fields = data.fields.map((field) => String(field).trim())
  if (new Set(fields).size !== fields.length) {
    throw new Error("字段名不能重复")
  }

  if (
    typeof data.front !== "string" ||
    typeof data.back !== "string" ||
    typeof data.css !== "string"
  ) {
    throw new Error("模板内容无效")
  }

  if (!Array.isArray(data.cards)) {
    throw new Error("卡片列表无效")
  }

  const cards: Card[] = data.cards.map((item, index) => {
    if (!isRecord(item) || !isRecord(item.values)) {
      throw new Error(`第 ${index + 1} 张卡片无效`)
    }
    const values = emptyValues(fields)
    for (const field of fields) {
      const value = item.values[field]
      values[field] = typeof value === "string" ? value : ""
    }
    return {
      id: typeof item.id === "string" && item.id ? item.id : createCardId(),
      values,
    }
  })

  const rawNotes = isRecord(data.fieldNotes) ? data.fieldNotes : {}
  const fieldNotes: Record<string, string> = {}
  for (const field of fields) {
    const note = rawNotes[field]
    fieldNotes[field] = typeof note === "string" ? note : ""
  }

  const fieldTts = ttsOf({
    fields,
    fieldTts: isRecord(data.fieldTts) ? (data.fieldTts as Record<string, TtsField>) : {},
  })

  for (const card of cards) {
    for (const name of Object.keys(fieldTts)) {
      card.values[name] = ""
    }
  }

  return {
    version: 1,
    name: data.name.trim(),
    fields,
    fieldNotes,
    fieldTts,
    front: data.front,
    back: data.back,
    css: data.css,
    cards: dedupeCardsByFirstField(cards, fields),
  }
}

export function serializeDeck(deck: Deck): string {
  return JSON.stringify(deck, null, 2)
}

export function uniqueFieldName(fields: string[], base = "新字段"): string {
  if (!fields.includes(base)) return base
  let n = 2
  while (fields.includes(`${base}${n}`)) n += 1
  return `${base}${n}`
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export function renameFieldInTemplate(template: string, from: string, to: string): string {
  return template.replace(
    new RegExp(`\\{\\{([#/^]?)${escapeRegExp(from)}\\}\\}`, "g"),
    `{{$1${to}}}`
  )
}

export type FieldChangeResult =
  | { ok: true; deck: Deck }
  | { ok: false; error: string }

export function templateUsesField(template: string, name: string): boolean {
  return new RegExp(`\\{\\{[#/^]?${escapeRegExp(name)}\\}\\}`).test(template)
}

export function fieldUsedInTemplates(deck: Deck, name: string): boolean {
  return templateUsesField(deck.front, name) || templateUsesField(deck.back, name)
}

export function tryRenameField(deck: Deck, from: string, to: string): FieldChangeResult {
  const next = to.trim()
  if (!next) return { ok: false, error: "字段名不能为空" }
  if (next === from) return { ok: true, deck }
  if (deck.fields.includes(next)) return { ok: false, error: `字段「${next}」已存在` }

  return {
    ok: true,
    deck: {
      ...deck,
      fields: deck.fields.map((field) => (field === from ? next : field)),
      fieldNotes: renameFieldNote(notesOf(deck), from, next),
      fieldTts: renameFieldTts(ttsOf(deck), from, next),
      front: renameFieldInTemplate(deck.front, from, next),
      back: renameFieldInTemplate(deck.back, from, next),
      cards: deck.cards.map((card) => {
        const values = { ...card.values }
        values[next] = values[from] ?? ""
        delete values[from]
        return { ...card, values }
      }),
    },
  }
}

export function tryAddField(deck: Deck): FieldChangeResult {
  const name = uniqueFieldName(deck.fields)
  if (deck.fields.includes(name)) {
    return { ok: false, error: `字段「${name}」已存在` }
  }

  return {
    ok: true,
    deck: {
      ...deck,
      fields: [...deck.fields, name],
      fieldNotes: { ...notesOf(deck), [name]: "" },
      fieldTts: ttsOf(deck),
      cards: deck.cards.map((card) => ({
        ...card,
        values: { ...card.values, [name]: "" },
      })),
    },
  }
}

export function tryRemoveField(deck: Deck, name: string): FieldChangeResult {
  if (deck.fields.length <= 1) {
    return { ok: false, error: "至少保留一个字段" }
  }

  const tts = ttsOf(deck)
  if (!tts[name] && textFields(deck).length <= 1) {
    return { ok: false, error: "至少保留一个普通字段" }
  }

  const dependents = Object.entries(tts)
    .filter(([, item]) => item.source === name)
    .map(([field]) => field)
  if (dependents.length > 0) {
    return { ok: false, error: `TTS 字段「${dependents.join("、")}」还在朗读「${name}」，先删掉它们` }
  }

  const usedIn: string[] = []
  if (templateUsesField(deck.front, name)) usedIn.push("正面")
  if (templateUsesField(deck.back, name)) usedIn.push("背面")
  if (usedIn.length > 0) {
    return { ok: false, error: `${usedIn.join("、")}模板还在使用「${name}」，先从模板里去掉再删除` }
  }

  const fieldTts = { ...tts }
  delete fieldTts[name]

  return {
    ok: true,
    deck: {
      ...deck,
      fields: deck.fields.filter((field) => field !== name),
      fieldNotes: omitFieldNote(notesOf(deck), name),
      fieldTts,
      cards: deck.cards.map((card) => {
        const values = { ...card.values }
        delete values[name]
        return { ...card, values }
      }),
    },
  }
}

function renameFieldTts(fieldTts: Record<string, TtsField>, from: string, to: string): Record<string, TtsField> {
  const next: Record<string, TtsField> = {}
  for (const [name, tts] of Object.entries(fieldTts)) {
    const key = name === from ? to : name
    next[key] = {
      ...tts,
      source: tts.source === from ? to : tts.source,
    }
  }
  return next
}

export function tryAddTtsField(
  deck: Deck,
  input: { name?: string; source: string; lang: TtsLang; slow?: boolean }
): FieldChangeResult {
  const source = input.source.trim()
  if (!source || !deck.fields.includes(source)) {
    return { ok: false, error: "请选择要朗读的字段" }
  }
  if (isTtsField(deck, source)) {
    return { ok: false, error: "不能朗读另一个 TTS 字段" }
  }
  if (!isTtsLang(input.lang)) {
    return { ok: false, error: "只支持英语和泰语" }
  }

  const requested = input.name?.trim() ?? ""
  if (requested && deck.fields.includes(requested)) {
    return { ok: false, error: `字段「${requested}」已存在` }
  }
  const name = requested || uniqueFieldName(deck.fields, `${source}_${input.lang}`)

  return {
    ok: true,
    deck: {
      ...deck,
      fields: [...deck.fields, name],
      fieldNotes: { ...notesOf(deck), [name]: "" },
      fieldTts: {
        ...ttsOf(deck),
        [name]: { source, lang: input.lang, slow: Boolean(input.slow) },
      },
      front: templateUsesField(deck.front, name) ? deck.front : `${deck.front}\n{{${name}}}`,
      cards: deck.cards.map((card) => ({
        ...card,
        values: { ...card.values, [name]: "" },
      })),
    },
  }
}

export function tryUpdateTtsField(deck: Deck, name: string, patch: Partial<TtsField>): FieldChangeResult {
  const current = ttsOf(deck)[name]
  if (!current) return { ok: false, error: "不是 TTS 字段" }

  const next: TtsField = {
    source: patch.source?.trim() || current.source,
    lang: patch.lang ?? current.lang,
    slow: patch.slow ?? current.slow,
  }
  if (!deck.fields.includes(next.source)) {
    return { ok: false, error: "请选择要朗读的字段" }
  }
  if (next.source === name || isTtsField(deck, next.source)) {
    return { ok: false, error: "不能朗读另一个 TTS 字段" }
  }
  if (!isTtsLang(next.lang)) {
    return { ok: false, error: "只支持英语和泰语" }
  }

  return {
    ok: true,
    deck: {
      ...deck,
      fieldTts: { ...ttsOf(deck), [name]: next },
    },
  }
}

export function isCardEmpty(card: Card, fields: string[]): boolean {
  const key = fields[0]
  return !key || !card.values[key]?.trim()
}

export function normalizeCardKey(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
}

export function cardKeyValue(card: Card, fields: string[], fieldNames = fields): string {
  const key = fieldNames[0]
  return key ? normalizeCardKey(card.values[key] ?? "") : ""
}

export function cardMatchesQuery(card: Card, fields: string[], query: string): boolean {
  const needle = normalizeCardKey(query)
  if (!needle) return true
  return fields.some((field) => normalizeCardKey(card.values[field] ?? "").includes(needle))
}

export function findDuplicateCard(
  cards: Card[],
  fields: string[],
  keyValue: string,
  excludeId?: string
): Card | undefined {
  const needle = normalizeCardKey(keyValue)
  if (!needle) return undefined
  return cards.find((card) => card.id !== excludeId && cardKeyValue(card, fields) === needle)
}

export function remapCardValues(
  values: Record<string, string>,
  fromFields: string[],
  toFields: string[]
): Record<string, string> {
  const next = emptyValues(toFields)
  for (const field of toFields) {
    if (typeof values[field] === "string") next[field] = values[field]
  }
  const fromKey = fromFields[0]
  const toKey = toFields[0]
  if (toKey && fromKey && !next[toKey]?.trim() && values[fromKey]) {
    next[toKey] = values[fromKey]
  }
  return next
}

export function dedupeCardsByFirstField(cards: Card[], fields: string[]): Card[] {
  const seen = new Set<string>()
  const result: Card[] = []
  for (const card of cards) {
    const key = cardKeyValue(card, fields)
    if (seen.has(key)) continue
    seen.add(key)
    result.push(card)
  }
  return result
}

export function appendUniqueCards(
  current: Card[],
  currentFields: string[],
  incoming: Card[],
  incomingFields: string[]
): Card[] {
  const seen = new Set(
    current.map((card) => cardKeyValue(card, currentFields)).filter(Boolean)
  )
  const added: Card[] = []
  for (const card of incoming) {
    const values = remapCardValues(card.values, incomingFields, currentFields)
    const key = normalizeCardKey(values[currentFields[0] ?? ""] ?? "")
    if (!key || seen.has(key)) continue
    seen.add(key)
    added.push(createCard(currentFields, values))
  }
  return [...current, ...added]
}

export function cardLabel(card: Card, fields: string[]): string {
  const first = fields[0]
  const value = first ? card.values[first]?.trim() : ""
  return value || "空卡片"
}

export function safeFilename(name: string, ext: string): string {
  const base = name.replace(/[\\/:*?"<>|]+/g, "_").trim() || "deck"
  return `${base}.${ext}`
}
