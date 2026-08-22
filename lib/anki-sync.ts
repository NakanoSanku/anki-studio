import {
  isCardEmpty,
  templatesOf,
  ttsOf,
  type AnkiIdentity,
  type Card,
  type Deck,
} from "./deck"

export type AnkiPushPlan = {
  cards: Card[]
  templateChanged: boolean
  noteHashes: Record<string, string>
  templateHash: string
}

export function hashText(text: string): string {
  let hash = 2166136261
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, "0")
}

export function noteHash(deck: Pick<Deck, "fields">, card: Card): string {
  return hashText(deck.fields.map((field) => card.values[field] ?? "").join("\x1f"))
}

export function templateHash(deck: Deck): string {
  return hashText(
    JSON.stringify({
      name: deck.name,
      fields: deck.fields,
      templates: templatesOf(deck),
      css: deck.css,
      fieldTts: ttsOf(deck),
    })
  )
}

export function withAnkiIdentity(deck: Deck): Deck {
  if (deck.anki && deck.anki.modelId > 0 && deck.anki.deckId > 0) return deck
  const now = Date.now()
  return {
    ...deck,
    anki: {
      modelId: deck.anki && deck.anki.modelId > 0 ? deck.anki.modelId : now,
      deckId: deck.anki && deck.anki.deckId > 0 ? deck.anki.deckId : now + 1,
      pushedTemplateHash: deck.anki?.pushedTemplateHash,
    },
  }
}

export function planAnkiPush(deck: Deck): AnkiPushPlan {
  const nextTemplateHash = templateHash(deck)
  const cards: Card[] = []
  const noteHashes: Record<string, string> = {}
  for (const card of deck.cards) {
    if (isCardEmpty(card, deck.fields)) continue
    const hash = noteHash(deck, card)
    if (card.pushedHash === hash) continue
    cards.push(card)
    noteHashes[card.id] = hash
  }
  return {
    cards,
    templateChanged: deck.anki?.pushedTemplateHash !== nextTemplateHash,
    noteHashes,
    templateHash: nextTemplateHash,
  }
}

export function hasAnkiPush(plan: AnkiPushPlan): boolean {
  return plan.cards.length > 0 || plan.templateChanged
}

export function markNotesPushed(
  current: Deck,
  exported: {
    noteHashes: Record<string, string>
    templateHash: string
    anki: AnkiIdentity
  }
): Deck {
  return {
    ...current,
    anki: {
      modelId: current.anki?.modelId ?? exported.anki.modelId,
      deckId: current.anki?.deckId ?? exported.anki.deckId,
      pushedTemplateHash:
        templateHash(current) === exported.templateHash
          ? exported.templateHash
          : current.anki?.pushedTemplateHash,
    },
    cards: current.cards.map((card) => {
      const hash = exported.noteHashes[card.id]
      if (!hash || noteHash(current, card) !== hash) return card
      return { ...card, pushedHash: hash }
    }),
  }
}
