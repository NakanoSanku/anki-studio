import { insertItemsAfter } from "./card-nav"

export type CardReviewStatus = "approved" | "pending"

export type Card = {
  id: string
  guid: string
  values: Record<string, string>
  /** Missing means approved for backward compatibility with existing decks. */
  reviewStatus?: CardReviewStatus
  pushedHash?: string
}

export type AnkiIdentity = {
  modelId: number
  deckId: number
  pushedTemplateHash?: string
}

export type TtsLang = "en" | "th"

export type TtsField = {
  source: string
  lang: TtsLang
  slow: boolean
}

export type CardTemplate = {
  id: string
  name: string
  front: string
  back: string
}

export type StoredFsrsCard = {
  due: string
  stability: number
  difficulty: number
  elapsed_days: number
  scheduled_days: number
  learning_steps: number
  reps: number
  lapses: number
  state: number
  last_review?: string
}

export type StoredReviewLog = {
  rating: number
  state: number
  due: string
  stability: number
  difficulty: number
  elapsed_days: number
  last_elapsed_days: number
  scheduled_days: number
  learning_steps: number
  review: string
}

export type ScheduledCard = {
  noteId: string
  templateId: string
  card: StoredFsrsCard
  logs: StoredReviewLog[]
}

export type FsrsDeckState = {
  requestRetention: number
  maximumInterval: number
  dailyNewLimit: number
  dailyReviewLimit: number
  cards: Record<string, ScheduledCard>
}

export type Deck = {
  version: 1 | 2
  name: string
  fields: string[]
  fieldNotes: Record<string, string>
  fieldTts: Record<string, TtsField>
  /** Legacy mirrors for the first template. Kept for V1 JSON compatibility. */
  front: string
  back: string
  templates?: CardTemplate[]
  css: string
  cards: Card[]
  fsrs?: FsrsDeckState
  anki?: AnkiIdentity
}

export const PRIMARY_TEMPLATE_ID = "card-1"

export const DEFAULT_FSRS_STATE: Omit<FsrsDeckState, "cards"> = {
  requestRetention: 0.9,
  maximumInterval: 36500,
  dailyNewLimit: 20,
  dailyReviewLimit: 200,
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

export function createTemplateId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function templatesOf(
  deck: Pick<Deck, "front" | "back"> & { templates?: CardTemplate[] }
): CardTemplate[] {
  if (Array.isArray(deck.templates) && deck.templates.length > 0) {
    const [primary, ...rest] = deck.templates
    return [{ ...primary!, front: deck.front, back: deck.back }, ...rest]
  }
  return [
    {
      id: PRIMARY_TEMPLATE_ID,
      name: "卡片 1",
      front: deck.front,
      back: deck.back,
    },
  ]
}

export function primaryTemplate(deck: Deck): CardTemplate {
  return templatesOf(deck)[0]!
}

export function getCardTemplate(deck: Deck, templateId?: string): CardTemplate {
  const templates = templatesOf(deck)
  return templates.find((template) => template.id === templateId) ?? templates[0]!
}

export function withTemplates(deck: Deck, templates: CardTemplate[]): Deck {
  const next = templates.length > 0 ? templates : templatesOf(deck)
  const primary = next[0]!
  return {
    ...deck,
    version: 2,
    templates: next,
    front: primary.front,
    back: primary.back,
  }
}

export function updateCardTemplate(
  deck: Deck,
  templateId: string,
  patch: Partial<Pick<CardTemplate, "name" | "front" | "back">>
): Deck {
  const templates = templatesOf(deck).map((template) =>
    template.id === templateId ? { ...template, ...patch } : template
  )
  return withTemplates(deck, templates)
}

export function addCardTemplate(deck: Deck): Deck {
  const templates = templatesOf(deck)
  let number = templates.length + 1
  const names = new Set(templates.map((template) => template.name))
  while (names.has(`卡片 ${number}`)) number += 1
  return withTemplates(deck, [
    ...templates,
    {
      id: createTemplateId(),
      name: `卡片 ${number}`,
      front: deck.front,
      back: deck.back,
    },
  ])
}

export function duplicateCardTemplate(deck: Deck, templateId: string): Deck {
  const templates = templatesOf(deck)
  const source = templates.find((template) => template.id === templateId)
  if (!source) return deck
  let name = `${source.name} 副本`
  let number = 2
  const names = new Set(templates.map((template) => template.name))
  while (names.has(name)) {
    name = `${source.name} 副本 ${number}`
    number += 1
  }
  return withTemplates(deck, [
    ...templates,
    { ...source, id: createTemplateId(), name },
  ])
}

export function removeCardTemplate(deck: Deck, templateId: string): FieldChangeResult {
  const templates = templatesOf(deck)
  if (templates.length <= 1) {
    return { ok: false, error: "至少保留一个卡片模板" }
  }
  const next = templates.filter((template) => template.id !== templateId)
  if (next.length === templates.length) return { ok: false, error: "卡片模板不存在" }
  const validIds = new Set(next.map((template) => template.id))
  const cards = Object.fromEntries(
    Object.entries(fsrsOf(deck).cards).filter(([, item]) => validIds.has(item.templateId))
  )
  return {
    ok: true,
    deck: withTemplates({ ...deck, fsrs: { ...fsrsOf(deck), cards } }, next),
  }
}

export function scheduledCardKey(noteId: string, templateId: string): string {
  return `${noteId}::${templateId}`
}

export function fsrsOf(deck: Pick<Deck, "cards"> & { fsrs?: FsrsDeckState }): FsrsDeckState {
  const raw = deck.fsrs
  const requestRetention =
    typeof raw?.requestRetention === "number" && raw.requestRetention >= 0.7 && raw.requestRetention <= 0.99
      ? raw.requestRetention
      : DEFAULT_FSRS_STATE.requestRetention
  return {
    requestRetention: Math.round(requestRetention * 100) / 100,
    maximumInterval:
      typeof raw?.maximumInterval === "number" && raw.maximumInterval >= 1
        ? Math.round(raw.maximumInterval)
        : DEFAULT_FSRS_STATE.maximumInterval,
    dailyNewLimit:
      typeof raw?.dailyNewLimit === "number" && raw.dailyNewLimit >= 0
        ? Math.round(raw.dailyNewLimit)
        : DEFAULT_FSRS_STATE.dailyNewLimit,
    dailyReviewLimit:
      typeof raw?.dailyReviewLimit === "number" && raw.dailyReviewLimit >= 0
        ? Math.round(raw.dailyReviewLimit)
        : DEFAULT_FSRS_STATE.dailyReviewLimit,
    cards: raw?.cards && typeof raw.cards === "object" ? raw.cards : {},
  }
}

export function createCardId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function createNoteGuid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID().replaceAll("-", "").slice(0, 10)
  }
  return `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.slice(0, 10)
}

export function emptyValues(fields: string[]): Record<string, string> {
  return Object.fromEntries(fields.map((field) => [field, ""]))
}

export function reviewStatusOf(card: Pick<Card, "reviewStatus">): CardReviewStatus {
  return card.reviewStatus === "pending" ? "pending" : "approved"
}

export function isCardApproved(card: Pick<Card, "reviewStatus">): boolean {
  return reviewStatusOf(card) === "approved"
}

function withCardReviewStatus(card: Card, status: CardReviewStatus): Card {
  if (status === "pending") return { ...card, reviewStatus: "pending" }
  const { reviewStatus: _reviewStatus, ...approved } = card
  return approved
}

export function createCard(fields: string[], values: Record<string, string> = {}): Card {
  return {
    id: createCardId(),
    guid: createNoteGuid(),
    values: { ...emptyValues(fields), ...values },
  }
}

export function createPendingCard(fields: string[], values: Record<string, string> = {}): Card {
  return withCardReviewStatus(createCard(fields, values), "pending")
}

export function setCardReviewStatus(deck: Deck, cardId: string, status: CardReviewStatus): Deck {
  if (!deck.cards.some((card) => card.id === cardId)) return deck
  return {
    ...deck,
    cards: deck.cards.map((card) => card.id === cardId ? withCardReviewStatus(card, status) : card),
  }
}

export function approveCard(deck: Deck, cardId: string): Deck {
  return setCardReviewStatus(deck, cardId, "approved")
}

export function markCardPending(deck: Deck, cardId: string): Deck {
  return setCardReviewStatus(deck, cardId, "pending")
}

export function approvedCards(deck: Pick<Deck, "cards">): Card[] {
  return deck.cards.filter(isCardApproved)
}

export function approvedDeck(deck: Deck): Deck {
  const cards = approvedCards(deck)
  const allowed = new Set(cards.map((card) => card.id))
  const fsrs = fsrsOf(deck)
  return {
    ...deck,
    cards,
    fsrs: {
      ...fsrs,
      cards: Object.fromEntries(
        Object.entries(fsrs.cards).filter(([, scheduled]) => allowed.has(scheduled.noteId))
      ),
    },
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

export function createBlankDeck(name = "新卡包"): Deck {
  const fields = [...DEFAULT_FIELDS]
  return {
    version: 2,
    name,
    fields,
    fieldNotes: { ...DEFAULT_FIELD_NOTES },
    fieldTts: {},
    front: DEFAULT_FRONT,
    back: DEFAULT_BACK,
    templates: [
      {
        id: PRIMARY_TEMPLATE_ID,
        name: "卡片 1",
        front: DEFAULT_FRONT,
        back: DEFAULT_BACK,
      },
    ],
    css: DEFAULT_CSS,
    cards: [createCard(fields)],
    fsrs: { ...DEFAULT_FSRS_STATE, cards: {} },
  }
}

export function createDefaultDeck(): Deck {
  return {
    ...createBlankDeck("单词本"),
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

function finiteNumber(value: unknown, fallback = 0): number {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function isoDate(value: unknown): string | undefined {
  if (typeof value !== "string" && typeof value !== "number" && !(value instanceof Date)) {
    return undefined
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

function parseStoredFsrsCard(raw: unknown): StoredFsrsCard | null {
  if (!isRecord(raw)) return null
  const due = isoDate(raw.due)
  const lastReview = raw.last_review == null ? undefined : isoDate(raw.last_review)
  const state = Math.round(finiteNumber(raw.state, -1))
  if (!due || state < 0 || state > 3) return null
  return {
    due,
    stability: Math.max(0, finiteNumber(raw.stability)),
    difficulty: Math.max(0, finiteNumber(raw.difficulty)),
    elapsed_days: Math.max(0, finiteNumber(raw.elapsed_days)),
    scheduled_days: Math.max(0, finiteNumber(raw.scheduled_days)),
    learning_steps: Math.max(0, Math.round(finiteNumber(raw.learning_steps))),
    reps: Math.max(0, Math.round(finiteNumber(raw.reps))),
    lapses: Math.max(0, Math.round(finiteNumber(raw.lapses))),
    state,
    ...(lastReview ? { last_review: lastReview } : {}),
  }
}

function parseStoredReviewLog(raw: unknown): StoredReviewLog | null {
  if (!isRecord(raw)) return null
  const due = isoDate(raw.due)
  const review = isoDate(raw.review)
  const rating = Math.round(finiteNumber(raw.rating, -1))
  const state = Math.round(finiteNumber(raw.state, -1))
  if (!due || !review || rating < 1 || rating > 4 || state < 0 || state > 3) return null
  return {
    rating,
    state,
    due,
    stability: Math.max(0, finiteNumber(raw.stability)),
    difficulty: Math.max(0, finiteNumber(raw.difficulty)),
    elapsed_days: Math.max(0, finiteNumber(raw.elapsed_days)),
    last_elapsed_days: Math.max(0, finiteNumber(raw.last_elapsed_days)),
    scheduled_days: Math.max(0, finiteNumber(raw.scheduled_days)),
    learning_steps: Math.max(0, Math.round(finiteNumber(raw.learning_steps))),
    review,
  }
}

function parseTemplates(data: Record<string, unknown>): CardTemplate[] {
  const templates: CardTemplate[] = []
  const ids = new Set<string>()
  const rawTemplates = Array.isArray(data.templates) ? data.templates : []
  for (const [index, raw] of rawTemplates.entries()) {
    if (!isRecord(raw) || typeof raw.front !== "string" || typeof raw.back !== "string") continue
    const requestedId = typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : `card-${index + 1}`
    let id = requestedId
    let suffix = 2
    while (ids.has(id)) {
      id = `${requestedId}-${suffix}`
      suffix += 1
    }
    ids.add(id)
    templates.push({
      id,
      name:
        typeof raw.name === "string" && raw.name.trim()
          ? raw.name.trim()
          : `卡片 ${index + 1}`,
      front: raw.front,
      back: raw.back,
    })
  }
  if (templates.length > 0) return templates
  return [
    {
      id: PRIMARY_TEMPLATE_ID,
      name: "卡片 1",
      front: typeof data.front === "string" ? data.front : DEFAULT_FRONT,
      back: typeof data.back === "string" ? data.back : DEFAULT_BACK,
    },
  ]
}

function parseFsrsState(
  raw: unknown,
  noteIds: Set<string>,
  templateIds: Set<string>
): FsrsDeckState {
  const source = isRecord(raw) ? raw : {}
  const parsedCards: Record<string, ScheduledCard> = {}
  const rawCards = isRecord(source.cards) ? source.cards : {}
  for (const value of Object.values(rawCards)) {
    if (!isRecord(value)) continue
    const noteId = typeof value.noteId === "string" ? value.noteId : ""
    const templateId = typeof value.templateId === "string" ? value.templateId : ""
    if (!noteIds.has(noteId) || !templateIds.has(templateId)) continue
    const card = parseStoredFsrsCard(value.card)
    if (!card) continue
    const logs = Array.isArray(value.logs)
      ? value.logs.flatMap((item) => {
          const parsed = parseStoredReviewLog(item)
          return parsed ? [parsed] : []
        })
      : []
    parsedCards[scheduledCardKey(noteId, templateId)] = { noteId, templateId, card, logs }
  }
  return {
    requestRetention:
      finiteNumber(source.requestRetention, DEFAULT_FSRS_STATE.requestRetention) >= 0.7 &&
      finiteNumber(source.requestRetention, DEFAULT_FSRS_STATE.requestRetention) <= 0.99
        ? finiteNumber(source.requestRetention, DEFAULT_FSRS_STATE.requestRetention)
        : DEFAULT_FSRS_STATE.requestRetention,
    maximumInterval: Math.max(
      1,
      Math.round(finiteNumber(source.maximumInterval, DEFAULT_FSRS_STATE.maximumInterval))
    ),
    dailyNewLimit: Math.max(
      0,
      Math.round(finiteNumber(source.dailyNewLimit, DEFAULT_FSRS_STATE.dailyNewLimit))
    ),
    dailyReviewLimit: Math.max(
      0,
      Math.round(finiteNumber(source.dailyReviewLimit, DEFAULT_FSRS_STATE.dailyReviewLimit))
    ),
    cards: parsedCards,
  }
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

  if (data.version !== 1 && data.version !== 2) {
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

  if (typeof data.css !== "string") {
    throw new Error("模板内容无效")
  }

  const templates = parseTemplates(data)

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
      guid: typeof item.guid === "string" && item.guid.trim() ? item.guid.trim() : createNoteGuid(),
      ...(item.reviewStatus === "pending" ? { reviewStatus: "pending" as const } : {}),
      pushedHash: typeof item.pushedHash === "string" && item.pushedHash ? item.pushedHash : undefined,
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

  const dedupedCards = dedupeCardsByFirstField(cards, fields)
  const fsrs = parseFsrsState(
    data.fsrs,
    new Set(dedupedCards.map((card) => card.id)),
    new Set(templates.map((template) => template.id))
  )

  return {
    version: 2,
    name: data.name.trim(),
    fields,
    fieldNotes,
    fieldTts,
    front: templates[0]!.front,
    back: templates[0]!.back,
    templates,
    css: data.css,
    cards: dedupedCards,
    fsrs,
    anki: parseAnkiIdentity(data.anki),
  }
}

function parseAnkiIdentity(raw: unknown): AnkiIdentity | undefined {
  if (!isRecord(raw)) return undefined
  const modelId = Number(raw.modelId)
  const deckId = Number(raw.deckId)
  if (!Number.isFinite(modelId) || !Number.isFinite(deckId) || modelId <= 0 || deckId <= 0) {
    return undefined
  }
  return {
    modelId,
    deckId,
    pushedTemplateHash:
      typeof raw.pushedTemplateHash === "string" && raw.pushedTemplateHash
        ? raw.pushedTemplateHash
        : undefined,
  }
}

export function serializeDeck(deck: Deck): string {
  const templates = templatesOf(deck)
  return JSON.stringify(
    {
      ...deck,
      version: 2,
      templates,
      front: templates[0]!.front,
      back: templates[0]!.back,
      fsrs: fsrsOf(deck),
    },
    null,
    2
  )
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

export function tryRenameField(deck: Deck, from: string, to: string): FieldChangeResult {
  const next = to.trim()
  if (!next) return { ok: false, error: "字段名不能为空" }
  if (next === from) return { ok: true, deck }
  if (deck.fields.includes(next)) return { ok: false, error: `字段「${next}」已存在` }

  const templates = templatesOf(deck).map((template) => ({
    ...template,
    front: renameFieldInTemplate(template.front, from, next),
    back: renameFieldInTemplate(template.back, from, next),
  }))

  return {
    ok: true,
    deck: withTemplates({
      ...deck,
      fields: deck.fields.map((field) => (field === from ? next : field)),
      fieldNotes: renameFieldNote(notesOf(deck), from, next),
      fieldTts: renameFieldTts(ttsOf(deck), from, next),
      cards: deck.cards.map((card) => {
        const values = { ...card.values }
        values[next] = values[from] ?? ""
        delete values[from]
        return { ...card, values }
      }),
    }, templates),
  }
}

export function tryAddField(
  deck: Deck,
  input: { name?: string; note?: string } = {}
): FieldChangeResult {
  const name = input.name === undefined ? uniqueFieldName(deck.fields) : input.name.trim()
  if (!name) return { ok: false, error: "字段名不能为空" }
  if (deck.fields.includes(name)) {
    return { ok: false, error: `字段「${name}」已存在` }
  }

  return {
    ok: true,
    deck: {
      ...deck,
      fields: [...deck.fields, name],
      fieldNotes: { ...notesOf(deck), [name]: input.note?.trim() ?? "" },
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

  const usedIn = templatesOf(deck).flatMap((template) => [
    ...(templateUsesField(template.front, name) ? [`「${template.name}」正面`] : []),
    ...(templateUsesField(template.back, name) ? [`「${template.name}」背面`] : []),
  ])
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

  const templates = templatesOf(deck)
  const primary = templates[0]!
  const nextTemplates = [
    {
      ...primary,
      front: templateUsesField(primary.front, name) ? primary.front : `${primary.front}\n{{${name}}}`,
    },
    ...templates.slice(1),
  ]

  return {
    ok: true,
    deck: withTemplates({
      ...deck,
      fields: [...deck.fields, name],
      fieldNotes: { ...notesOf(deck), [name]: "" },
      fieldTts: {
        ...ttsOf(deck),
        [name]: { source, lang: input.lang, slow: Boolean(input.slow) },
      },
      cards: deck.cards.map((card) => ({
        ...card,
        values: { ...card.values, [name]: "" },
      })),
    }, nextTemplates),
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
    if (key) {
      if (seen.has(key)) continue
      seen.add(key)
    }
    result.push(card)
  }
  return result
}

export function collectUniqueCards(
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
    added.push(reviewStatusOf(card) === "pending"
      ? createPendingCard(currentFields, values)
      : createCard(currentFields, values))
  }
  return added
}

export function appendUniqueCards(
  current: Card[],
  currentFields: string[],
  incoming: Card[],
  incomingFields: string[]
): Card[] {
  return [...current, ...collectUniqueCards(current, currentFields, incoming, incomingFields)]
}

export function setCardField(
  deck: Deck,
  cardId: string,
  field: string,
  value: string
): FieldChangeResult {
  if (isTtsField(deck, field)) {
    return { ok: false, error: `字段「${field}」由朗读生成，不能写入` }
  }
  if (!deck.fields.includes(field)) {
    return { ok: false, error: `字段「${field}」不存在` }
  }
  const card = deck.cards.find((item) => item.id === cardId)
  if (!card) return { ok: false, error: "卡片已删除" }

  if (field === deck.fields[0]) {
    const duplicate = findDuplicateCard(deck.cards, deck.fields, value, cardId)
    if (duplicate) {
      return { ok: false, error: `已存在卡片「${value.trim()}」` }
    }
  }

  return {
    ok: true,
    deck: {
      ...deck,
      cards: deck.cards.map((item) =>
        item.id === cardId
          ? withCardReviewStatus({ ...item, values: { ...item.values, [field]: value } }, "pending")
          : item
      ),
    },
  }
}

export function mergeCardAiValues(
  deck: Deck,
  cardId: string,
  incoming: Record<string, string>
): FieldChangeResult {
  const card = deck.cards.find((item) => item.id === cardId)
  if (!card) return { ok: false, error: "卡片已删除" }

  const nextValues = { ...card.values }
  for (const field of textFields(deck)) {
    const generated = incoming[field]
    if (typeof generated !== "string") continue
    if (nextValues[field]?.trim()) continue
    nextValues[field] = generated
  }

  const key = deck.fields[0]
  if (key && nextValues[key] !== card.values[key]) {
    const duplicate = findDuplicateCard(deck.cards, deck.fields, nextValues[key] ?? "", cardId)
    if (duplicate) {
      return { ok: false, error: `已存在卡片「${(nextValues[key] ?? "").trim()}」` }
    }
  }

  return {
    ok: true,
    deck: {
      ...deck,
      cards: deck.cards.map((item) => (
        item.id === cardId ? withCardReviewStatus({ ...item, values: nextValues }, "pending") : item
      )),
    },
  }
}

export function mergeGeneratedCards(
  deck: Deck,
  incoming: Card[],
  afterId?: string | null
): FieldChangeResult {
  const added = collectUniqueCards(deck.cards, deck.fields, incoming, deck.fields)
  if (added.length === 0) {
    return { ok: false, error: "生成的卡片都与现有首字段重复，没有写入" }
  }
  return {
    ok: true,
    deck: {
      ...deck,
      cards: insertItemsAfter(deck.cards, afterId, added),
    },
  }
}

export function cardLabel(card: Card, fields: string[]): string {
  const first = fields[0]
  const value = first ? card.values[first]?.trim() : ""
  return value || "空卡片"
}

export function cardSubtitle(card: Card, fields: string[]): string {
  return fields
    .slice(1)
    .map((field) => card.values[field]?.trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(" · ")
}

export function safeFilename(name: string, ext: string): string {
  const base = name.replace(/[\\/:*?"<>|]+/g, "_").trim() || "deck"
  return `${base}.${ext}`
}
