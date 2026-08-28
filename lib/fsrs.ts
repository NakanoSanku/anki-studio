import {
  Rating,
  State,
  createEmptyCard,
  fsrs,
  type Card as FsrsCard,
  type Grade,
  type ReviewLog,
} from "ts-fsrs"

import {
  fsrsOf,
  isCardEmpty,
  scheduledCardKey,
  templatesOf,
  type Card,
  type CardTemplate,
  type Deck,
  type FsrsDeckState,
  type StoredFsrsCard,
  type StoredReviewLog,
} from "./deck"

export { Rating, State }

export type StudyItem = {
  id: string
  note: Card
  template: CardTemplate
  card: FsrsCard
  isNew: boolean
}

export type RatingOption = {
  rating: Grade
  label: string
  interval: string
  due: Date
}

export type StudyStats = {
  total: number
  learned: number
  newCount: number
  dueNow: number
  dueToday: number
  reviewedToday: number
  streak: number
  nextDue?: Date
}

const RATING_LABELS: Record<Grade, string> = {
  [Rating.Again]: "Again",
  [Rating.Hard]: "Hard",
  [Rating.Good]: "Good",
  [Rating.Easy]: "Easy",
}

function schedulerFor(deck: Deck) {
  const settings = fsrsOf(deck)
  return fsrs({
    request_retention: settings.requestRetention,
    maximum_interval: settings.maximumInterval,
    enable_fuzz: true,
    enable_short_term: true,
    learning_steps: ["1m", "10m"],
    relearning_steps: ["10m"],
  })
}

export function deserializeFsrsCard(card: StoredFsrsCard): FsrsCard {
  return {
    ...card,
    due: new Date(card.due),
    last_review: card.last_review ? new Date(card.last_review) : undefined,
  } as FsrsCard
}

export function serializeFsrsCard(card: FsrsCard): StoredFsrsCard {
  return {
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    ...(card.last_review ? { last_review: card.last_review.toISOString() } : {}),
  }
}

export function serializeReviewLog(log: ReviewLog): StoredReviewLog {
  return {
    rating: log.rating,
    state: log.state,
    due: log.due.toISOString(),
    stability: log.stability,
    difficulty: log.difficulty,
    elapsed_days: log.elapsed_days,
    last_elapsed_days: log.last_elapsed_days,
    scheduled_days: log.scheduled_days,
    learning_steps: log.learning_steps,
    review: log.review.toISOString(),
  }
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function endOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)
}

function sameLocalDay(value: string, date: Date): boolean {
  const parsed = new Date(value)
  return !Number.isNaN(parsed.getTime()) && startOfLocalDay(parsed).getTime() === startOfLocalDay(date).getTime()
}

function allItems(deck: Deck, now: Date): StudyItem[] {
  const state = fsrsOf(deck)
  const result: StudyItem[] = []
  for (const note of deck.cards) {
    if (isCardEmpty(note, deck.fields)) continue
    for (const template of templatesOf(deck)) {
      const id = scheduledCardKey(note.id, template.id)
      const stored = state.cards[id]
      const card = stored ? deserializeFsrsCard(stored.card) : createEmptyCard(now)
      result.push({ id, note, template, card, isNew: card.state === State.New })
    }
  }
  return result
}

function reviewLogsToday(state: FsrsDeckState, now: Date): StoredReviewLog[] {
  return Object.values(state.cards).flatMap((item) => item.logs.filter((log) => sameLocalDay(log.review, now)))
}

export function getStudyQueue(deck: Deck, now = new Date()): StudyItem[] {
  const state = fsrsOf(deck)
  const logsToday = reviewLogsToday(state, now)
  const introducedToday = logsToday.filter((log) => log.state === State.New).length
  const reviewedToday = logsToday.filter((log) => log.state !== State.New).length
  const newRemaining = Math.max(0, state.dailyNewLimit - introducedToday)
  const reviewRemaining = Math.max(0, state.dailyReviewLimit - reviewedToday)
  const due = allItems(deck, now).filter((item) => item.card.due.getTime() <= now.getTime())
  const reviews = due
    .filter((item) => !item.isNew)
    .sort((a, b) => a.card.due.getTime() - b.card.due.getTime())
    .slice(0, reviewRemaining)
  const fresh = due
    .filter((item) => item.isNew)
    .slice(0, newRemaining)
  return [...reviews, ...fresh]
}

export function getStudyStats(deck: Deck, now = new Date()): StudyStats {
  const state = fsrsOf(deck)
  const items = allItems(deck, now)
  const tomorrow = endOfLocalDay(now).getTime()
  const dueDates = items.filter((item) => !item.isNew).map((item) => item.card.due)
  const nextDue = dueDates.sort((a, b) => a.getTime() - b.getTime())[0]
  const reviewedDates = new Set(
    Object.values(state.cards).flatMap((item) =>
      item.logs.map((log) => startOfLocalDay(new Date(log.review)).getTime())
    )
  )
  let streak = 0
  const cursor = startOfLocalDay(now)
  while (reviewedDates.has(cursor.getTime())) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  if (streak === 0) {
    cursor.setDate(cursor.getDate() - 1)
    while (reviewedDates.has(cursor.getTime())) {
      streak += 1
      cursor.setDate(cursor.getDate() - 1)
    }
  }
  return {
    total: items.length,
    learned: items.filter((item) => !item.isNew).length,
    newCount: items.filter((item) => item.isNew).length,
    dueNow: items.filter((item) => item.card.due.getTime() <= now.getTime()).length,
    dueToday: items.filter((item) => item.card.due.getTime() < tomorrow).length,
    reviewedToday: reviewLogsToday(state, now).length,
    streak,
    ...(nextDue ? { nextDue } : {}),
  }
}

export function reviewStudyItem(
  deck: Deck,
  item: Pick<StudyItem, "note" | "template">,
  rating: Grade,
  now = new Date()
): Deck {
  const state = fsrsOf(deck)
  const id = scheduledCardKey(item.note.id, item.template.id)
  const current = state.cards[id]
  const card = current ? deserializeFsrsCard(current.card) : createEmptyCard(now)
  const result = schedulerFor(deck).next(card, now, rating)
  return {
    ...deck,
    version: 2,
    fsrs: {
      ...state,
      cards: {
        ...state.cards,
        [id]: {
          noteId: item.note.id,
          templateId: item.template.id,
          card: serializeFsrsCard(result.card),
          logs: [...(current?.logs ?? []), serializeReviewLog(result.log)],
        },
      },
    },
  }
}

export function previewRatingOptions(
  deck: Deck,
  item: StudyItem,
  now = new Date()
): RatingOption[] {
  const preview = schedulerFor(deck).repeat(item.card, now)
  return ([Rating.Again, Rating.Hard, Rating.Good, Rating.Easy] as Grade[]).map((rating) => ({
    rating,
    label: RATING_LABELS[rating],
    interval: formatInterval(preview[rating].card.due.getTime() - now.getTime()),
    due: preview[rating].card.due,
  }))
}

export function updateFsrsSettings(
  deck: Deck,
  patch: Partial<Omit<FsrsDeckState, "cards">>
): Deck {
  return { ...deck, version: 2, fsrs: { ...fsrsOf(deck), ...patch } }
}

export function removeNoteSchedule(deck: Deck, noteId: string): Deck {
  const state = fsrsOf(deck)
  const cards = Object.fromEntries(
    Object.entries(state.cards).filter(([, item]) => item.noteId !== noteId)
  )
  return { ...deck, fsrs: { ...state, cards } }
}

export function formatInterval(milliseconds: number): string {
  const minutes = Math.max(1, Math.round(milliseconds / 60_000))
  if (minutes < 60) return `${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hr`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days} d`
  const months = Math.round(days / 30)
  if (months < 12) return `${months} mo`
  const years = Math.round(days / 365)
  return `${years} yr`
}

export function formatDueDate(date: Date, now = new Date()): string {
  const diff = date.getTime() - now.getTime()
  if (diff <= 0) return "now"
  if (date.getTime() < endOfLocalDay(now).getTime()) return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  return date.toLocaleDateString([], { month: "short", day: "numeric" })
}
