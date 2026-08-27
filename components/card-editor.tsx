"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { BookOpen, Check, ChevronLeft, ChevronRight, Eye, Pencil, Plus, Search, X } from "lucide-react"

import { requestBatchAi, requestCardAi, referenceValuesForComplete } from "@/lib/ai"
import { idAfterDelete, idAtIndex, insertItemsAfter, moveItemAfter, neighborId } from "@/lib/card-nav"
import { removeNoteSchedule } from "@/lib/fsrs"
import {
  cardLabel,
  cardMatchesQuery,
  cardSubtitle,
  createCard,
  isCardEmpty,
  mergeCardAiValues,
  mergeGeneratedCards,
  notesOf,
  setCardField,
  textFields,
  ttsLangLabel,
  ttsOf,
  type Card,
  type Deck,
  type FieldChangeResult,
} from "@/lib/deck"
import {
  markReviewed,
  markUnreviewed,
  matchesReviewFilter,
  pruneEditorState,
  readEditorState,
  writeEditorState,
  type EditorState,
  type ReviewFilter,
} from "@/lib/editor-state"
import { useAppHeaderAction } from "@/components/app-shell"
import { ReferenceNotesBar, ReferenceNotesPicker } from "@/components/reference-notes-bar"
import { TtsPlayButton } from "@/components/tts-play-button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Textarea } from "@/components/ui/textarea"
import { CardPreview } from "@/components/card-preview"
import { useVirtualWindow } from "@/components/use-virtual-window"
import { cn } from "@/lib/utils"

type MobilePane = "list" | "editor" | "preview"

const LIST_ROW = 60
const FILTERS: { id: ReviewFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "unreviewed", label: "Needs review" },
]

type DeckUpdater = Deck | ((current: Deck) => Deck)

type CardEditorProps = {
  deck: Deck
  deckId: string
  selectedId: string | null
  previewSide: "front" | "back"
  layout?: "list" | "detail"
  onChange: (deck: DeckUpdater) => void
  onSelect: (id: string) => void
  onOpenNote?: (id: string) => void
  onAddNote?: () => void
  onPreviewSideChange: (side: "front" | "back") => void
}

export function CardEditor({
  deck,
  deckId,
  selectedId,
  previewSide,
  layout = "list",
  onChange,
  onSelect,
  onOpenNote,
  onAddNote,
  onPreviewSideChange,
}: CardEditorProps) {
  const [mobilePane, setMobilePane] = useState<MobilePane>(layout === "detail" ? "editor" : "list")
  const [busyKeys, setBusyKeys] = useState<string[]>([])
  const [prevLayout, setPrevLayout] = useState(layout)
  if (prevLayout !== layout) {
    setPrevLayout(layout)
    setMobilePane(layout === "detail" ? "editor" : "list")
  }
  const busyRef = useRef(new Set<string>())
  const deckRef = useRef(deck)
  const pendingDecks = useRef(new Set<Deck>())
  const [alert, setAlert] = useState("")
  const [batchOpen, setBatchOpen] = useState(false)
  const [completeOpen, setCompleteOpen] = useState(false)
  const [referencePickerOpen, setReferencePickerOpen] = useState(false)
  const [batchTopic, setBatchTopic] = useState("")
  const [batchCount, setBatchCount] = useState("10")
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<ReviewFilter>("all")
  const [review, setReview] = useState<EditorState>(() => readEditorState(deckId, deck))
  const selected = deck.cards.find((card) => card.id === selectedId) ?? deck.cards[0]
  const editableFields = textFields(deck)
  const hasFilledField = editableFields.some((field) => Boolean(selected?.values[field]?.trim()))
  const hasEmptyField = editableFields.some((field) => !selected?.values[field]?.trim())
  const canCompleteSelected = Boolean(selected && hasFilledField && hasEmptyField)
  const filledFields = editableFields.filter((field) => Boolean(selected?.values[field]?.trim()))
  const emptyFields = editableFields.filter((field) => !selected?.values[field]?.trim())
  const fieldTts = ttsOf(deck)
  const visibleCards = deck.cards.filter(
    (card) => cardMatchesQuery(card, editableFields, query) && matchesReviewFilter(card, review, filter)
  )
  const activeId = selected?.id ?? ""
  const selectedIndex = selected ? deck.cards.findIndex((card) => card.id === selected.id) + 1 : 0
  const reviewedCount = review.reviewed.filter((id) => deck.cards.some((card) => card.id === id)).length
  const isSelectedReviewed = Boolean(selected && review.reviewed.includes(selected.id))
  const isBusy = (task: string) => busyKeys.includes(task)
  const listOnly = layout === "list"
  const detail = layout === "detail"
  const editorPane = detail ? (mobilePane === "preview" ? "preview" : "editor") : mobilePane
  const {
    containerRef: listRef,
    start: listStart,
    end: listEnd,
    padTop: listPadTop,
    padBottom: listPadBottom,
    scrollToIndex: scrollListToIndex,
  } = useVirtualWindow(visibleCards.length, LIST_ROW)
  const visibleRef = useRef(visibleCards)
  const activeRef = useRef(activeId)
  const addCardRef = useRef<() => void>(() => {})
  const goRef = useRef<(delta: number) => void>(() => {})
  const approveRef = useRef<() => void>(() => {})
  const jumpRef = useRef<(index: number) => void>(() => {})

  const noteHeaderAction = useMemo(
    () => detail ? (
      <button
        type="button"
        data-testid="note-view-toggle"
        className="flex size-10 shrink-0 touch-manipulation items-center justify-center rounded-[14px] border border-black/[0.065] bg-card text-foreground transition-[background-color,transform] [-webkit-tap-highlight-color:transparent] hover:bg-muted/70 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-energy/45 min-[390px]:size-11 dark:border-white/[0.09] lg:hidden"
        aria-label={editorPane === "preview" ? "Switch to editor" : "Switch to preview"}
        title={editorPane === "preview" ? "Edit" : "Preview"}
        onClick={() => setMobilePane((pane) => pane === "preview" ? "editor" : "preview")}
      >
        {editorPane === "preview" ? <Pencil className="size-[18px]" /> : <Eye className="size-[18px]" />}
      </button>
    ) : null,
    [detail, editorPane]
  )
  useAppHeaderAction(noteHeaderAction)

  useEffect(() => {
    visibleRef.current = visibleCards
    activeRef.current = activeId
  })

  useEffect(() => {
    pendingDecks.current.delete(deck)
    if (pendingDecks.current.size > 0 && !pendingDecks.current.has(deck)) return
    deckRef.current = deck
  }, [deck])

  const persistReady = useRef(false)
  const deckIdRef = useRef(deckId)

  useEffect(() => {
    if (deckIdRef.current === deckId) return
    deckIdRef.current = deckId
    persistReady.current = false
    setReview(readEditorState(deckId, deckRef.current))
    setFilter("all")
    setQuery("")
  }, [deckId])

  useEffect(() => {
    if (!persistReady.current) {
      persistReady.current = true
      return
    }
    writeEditorState(deckId, { ...review, selectedId: activeId }, deckRef.current.cards)
  }, [deckId, activeId, review])

  useEffect(() => {
    const index = visibleRef.current.findIndex((card) => card.id === activeId)
    if (index < 0) return
    scrollListToIndex(index)
  }, [activeId, filter, query, scrollListToIndex])

  const pushDeck = (next: Deck) => {
    deckRef.current = next
    pendingDecks.current.add(next)
    onChange(next)
  }

  const commitChange = (recipe: (current: Deck) => FieldChangeResult): FieldChangeResult => {
    const result = recipe(deckRef.current)
    if (!result.ok) return result
    pushDeck(result.deck)
    return result
  }

  const addCard = () => {
    if (onAddNote) {
      onAddNote()
      return
    }
    setMobilePane("editor")
    const current = deckRef.current
    const currentSelected = current.cards.find((card) => card.id === activeRef.current) ?? current.cards[0]
    if (currentSelected && isCardEmpty(currentSelected, current.fields)) {
      onSelect(currentSelected.id)
      setQuery("")
      return
    }
    const empty = current.cards.find((card) => isCardEmpty(card, current.fields))
    if (empty) {
      pushDeck({ ...current, cards: moveItemAfter(current.cards, empty.id, currentSelected?.id) })
      onSelect(empty.id)
      setQuery("")
      return
    }
    const card = createCard(current.fields)
    pushDeck({ ...current, cards: insertItemsAfter(current.cards, currentSelected?.id, [card]) })
    onSelect(card.id)
    setQuery("")
  }

  const goVisible = (delta: number) => {
    const list = visibleRef.current
    if (list.length === 0) return
    const nextId = neighborId(list, activeRef.current, delta)
    if (nextId) onSelect(nextId)
  }

  const approveCurrent = () => {
    const currentId = activeRef.current
    if (!currentId) return
    const list = visibleRef.current
    const currentIndex = list.findIndex((card) => card.id === currentId)
    let nextId = currentIndex >= 0 ? list[currentIndex + 1]?.id ?? "" : list[0]?.id ?? ""
    if (!nextId && filter === "unreviewed") nextId = list.find((card) => card.id !== currentId)?.id ?? ""
    setReview((state) => markReviewed(state, currentId))
    if (nextId) onSelect(nextId)
  }

  const undoCurrentReview = () => {
    const currentId = activeRef.current
    if (!currentId) return
    setReview((state) => markUnreviewed(state, currentId))
  }

  const jumpTo = (index1: number) => {
    const id = idAtIndex(deckRef.current.cards, index1)
    if (!id) return
    setFilter("all")
    setQuery("")
    onSelect(id)
  }

  useEffect(() => {
    addCardRef.current = addCard
    goRef.current = goVisible
    approveRef.current = approveCurrent
    jumpRef.current = jumpTo
  })

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.altKey || event.metaKey || event.ctrlKey) return
      if (event.isComposing) return
      if (batchOpen || alert) return
      const repeating = event.repeat && (event.key === "ArrowDown" || event.key === "n" || event.key === "N")
      if (repeating) return
      switch (event.key) {
        case "ArrowUp":
          event.preventDefault()
          goRef.current(-1)
          break
        case "ArrowDown":
          event.preventDefault()
          approveRef.current()
          break
        case "Home":
          event.preventDefault()
          jumpRef.current(1)
          break
        case "End":
          event.preventDefault()
          jumpRef.current(deckRef.current.cards.length)
          break
        case "n":
        case "N":
          event.preventDefault()
          addCardRef.current()
          break
        default:
          break
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [alert, batchOpen])

  const updateCard = (id: string, field: string, value: string) => {
    if (fieldTts[field]) return false
    const result = commitChange((current) => setCardField(current, id, field, value))
    if (!result.ok) {
      setAlert(result.error)
      return false
    }
    setReview((state) => markUnreviewed(state, id))
    return true
  }

  const runAi = async (task: string, work: () => Promise<void>) => {
    if (busyRef.current.has(task)) return
    busyRef.current.add(task)
    setBusyKeys([...busyRef.current])
    try {
      await work()
    } catch (error) {
      setAlert(error instanceof Error ? error.message : "AI request failed")
    } finally {
      busyRef.current.delete(task)
      setBusyKeys([...busyRef.current])
    }
  }

  const applyBatchAi = () => {
    const count = Number(batchCount)
    if (!batchTopic.trim()) {
      setAlert("Enter a topic or word list")
      return
    }
    if (!Number.isFinite(count) || count < 1 || count > 50) {
      setAlert("Generate between 1 and 50 notes")
      return
    }
    const topic = batchTopic.trim()
    const fields = editableFields
    const notes = notesOf(deck)
    const keyField = deck.fields[0]
    const existingKeys = deck.cards.map((card) => (keyField ? card.values[keyField] ?? "" : "")).map((value) => value.trim()).filter(Boolean)
    const references = review.referenceIds
      .map((id) => deck.cards.find((card) => card.id === id)?.values)
      .filter((values): values is Record<string, string> => Boolean(values))
    const anchorId = selected?.id ?? ""
    void runAi("batch", async () => {
      const generated = await requestBatchAi({ topic, count: Math.floor(count), fields, existingKeys, notes, references })
      const incoming = generated.map((values) => createCard(fields, values))
      const beforeLen = deckRef.current.cards.length
      const result = commitChange((current) => mergeGeneratedCards(current, incoming, anchorId))
      if (!result.ok) throw new Error(result.error)
      const afterIndex = result.deck.cards.findIndex((card) => card.id === anchorId)
      const added = result.deck.cards.length - beforeLen
      const last = afterIndex >= 0 ? result.deck.cards[afterIndex + added] : result.deck.cards[result.deck.cards.length - 1]
      if (last) onSelect(last.id)
      setBatchOpen(false)
      setBatchTopic("")
      setQuery("")
    })
  }

  const applyCardCompletion = () => {
    if (!selected || !canCompleteSelected) return
    const cardId = selected.id
    const values = selected.values
    const references = referenceValuesForComplete(
      review.referenceIds.flatMap((id) => {
        const card = deck.cards.find((item) => item.id === id)
        return card ? [{ id: card.id, values: card.values }] : []
      }),
      cardId
    )
    void runAi("card:complete", async () => {
      const generated = await requestCardAi({ fields: editableFields, values, notes: notesOf(deck), references })
      const result = commitChange((current) => mergeCardAiValues(current, cardId, generated))
      if (!result.ok) throw new Error(result.error)
      setReview((state) => markUnreviewed(state, cardId))
      setCompleteOpen(false)
    })
  }

  const removeCard = (id: string) => {
    const current = deckRef.current
    const nextId = idAfterDelete(current.cards, id)
    const next = removeNoteSchedule({ ...current, cards: current.cards.filter((card) => card.id !== id) }, id)
    pushDeck(next)
    setReview((state) => pruneEditorState({ ...state, selectedId: nextId }, next.cards))
    if (selectedId === id) onSelect(nextId)
  }

  const listToolbar = (
    <div className="space-y-3 rounded-[20px] border border-black/[0.065] bg-card p-3.5 shadow-[0_18px_46px_-42px_rgba(0,0,0,0.45)] dark:border-white/[0.09]">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.17em] text-muted-foreground"><span className="size-1.5 rounded-full bg-energy" />Note library</p>
          <div className="mt-1 flex items-baseline gap-2">
            <p className="text-lg font-semibold tracking-[-0.035em] text-foreground">{deck.cards.length} notes</p>
            <span className="text-[11px] font-medium text-muted-foreground">{reviewedCount} reviewed</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button type="button" size="sm" variant="outline" className="h-9 px-3 text-xs" disabled={isBusy("batch")} onClick={() => setBatchOpen(true)}>Generate</Button>
          <Button type="button" size="sm" className="h-9 px-3 text-xs" aria-label="Create note" title="Create after the current note" onClick={addCard}><Plus className="mr-1 size-3.5" />New</Button>
        </div>
      </div>

      <div className="relative min-w-0">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-3.5 -translate-y-1/2 text-foreground/30" />
        <Input value={query} aria-label="Search notes" placeholder="Search words, meanings, or examples…" className="h-10 bg-background pr-10 pl-9.5 text-sm" onChange={(event) => setQuery(event.target.value)} />
        {query.trim() ? <button type="button" aria-label="Clear search" className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-[9px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" onClick={() => setQuery("")}><X className="size-3" /></button> : null}
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex items-center rounded-[12px] border border-black/[0.06] bg-muted/55 p-1 dark:border-white/[0.08]">
            {FILTERS.map((item) => <button key={item.id} type="button" data-testid={`mobile-review-filter-${item.id}`} className={cn("h-7 rounded-[9px] px-3 text-[11px] font-medium transition-colors", filter === item.id ? "bg-card text-foreground shadow-[0_6px_16px_-14px_rgba(0,0,0,0.6)]" : "text-foreground/45 hover:text-foreground")} onClick={() => setFilter(item.id)}>{item.label}</button>)}
          </div>
          {review.referenceIds.length > 0 ? <ReferenceNotesBar referenceIds={review.referenceIds} onOpenPicker={() => setReferencePickerOpen(true)} /> : null}
        </div>
        <p className="font-mono text-[10px] font-medium tabular-nums text-muted-foreground sm:text-xs">{query.trim() || filter !== "all" ? `${visibleCards.length} / ${deck.cards.length}` : `${deck.cards.length}`}</p>
      </div>
    </div>
  )

  const mobilePager = (
    <div className="flex items-center gap-2 lg:hidden">
      <div className="grid h-11 min-w-0 flex-1 grid-cols-[2.5rem_1fr_2.5rem] items-center rounded-[15px] border border-black/[0.065] bg-card p-0.5 dark:border-white/[0.09]">
        <Button type="button" size="icon-lg" variant="ghost" aria-label="Previous note" title="Previous" disabled={selectedIndex <= 1} onClick={() => jumpTo(selectedIndex - 1)}><ChevronLeft /></Button>
        <div className="grid min-w-0 grid-cols-[minmax(3rem,1fr)_auto] items-center gap-2 px-1">
          <Slider id="mobile-card-slider" data-testid="mobile-card-slider" value={[Math.max(1, selectedIndex)]} min={1} max={Math.max(1, deck.cards.length)} step={1} disabled={deck.cards.length <= 1} aria-label="Select note" aria-valuetext={deck.cards.length === 0 ? "No notes" : `Note ${selectedIndex} of ${deck.cards.length}`} className="h-8 cursor-grab active:cursor-grabbing [&_[data-slot=slider-range]]:bg-energy [&_[data-slot=slider-thumb]]:h-4 [&_[data-slot=slider-thumb]]:w-7 [&_[data-slot=slider-thumb]]:border-2 [&_[data-slot=slider-thumb]]:border-card [&_[data-slot=slider-thumb]]:bg-foreground [&_[data-slot=slider-thumb]]:shadow-sm [&_[data-slot=slider-track]]:h-1.5 [&_[data-slot=slider-track]]:bg-foreground/10" onValueChange={([index]) => { if (index !== undefined && index !== selectedIndex) jumpTo(index) }} />
          <output htmlFor="mobile-card-slider" aria-live="polite" className="min-w-10 whitespace-nowrap text-right font-mono text-xs font-medium tabular-nums"><span className="text-foreground">{selectedIndex}</span><span className="text-foreground/40"> / {deck.cards.length}</span></output>
        </div>
        <Button type="button" size="icon-lg" variant="ghost" aria-label="Next note" title="Next" disabled={selectedIndex >= deck.cards.length} onClick={() => jumpTo(selectedIndex + 1)}><ChevronRight /></Button>
      </div>
      <Button type="button" size="lg" className="px-3" onClick={addCard}><Plus data-icon="inline-start" />New</Button>
    </div>
  )

  const preview = <CardPreview deck={deck} values={selected?.values ?? {}} side={previewSide} onSideChange={onPreviewSideChange} fillViewport />

  const aiDialog = (
    <AlertDialog open={Boolean(alert)} onOpenChange={(open) => { if (!open) setAlert("") }}>
      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Unable to complete action</AlertDialogTitle><AlertDialogDescription>{alert}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogAction>OK</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
    </AlertDialog>
  )

  const referenceChoice = (
    <div className="flex items-center justify-between rounded-[15px] border border-black/[0.06] bg-background/55 p-3.5 dark:border-white/[0.08]">
      <div className="flex min-w-0 flex-1 items-center gap-2.5 pr-2">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-[12px] bg-card text-foreground"><BookOpen className="size-4" /></div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5"><span className="text-xs font-semibold text-foreground">Reference notes</span>{review.referenceIds.length > 0 ? <span className="rounded-[7px] bg-energy px-1.5 py-0.5 text-[9px] font-semibold text-black">{review.referenceIds.length}</span> : null}</div>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{review.referenceIds.length > 0 ? "Match the style of the selected examples" : "Choose 1–3 example notes from this deck"}</p>
        </div>
      </div>
      <Button type="button" size="xs" variant="outline" className="h-8 shrink-0 text-xs" onClick={() => setReferencePickerOpen(true)}>{review.referenceIds.length > 0 ? "Change" : "Choose"}</Button>
    </div>
  )

  const batchDialog = (
    <Dialog open={batchOpen && !referencePickerOpen} onOpenChange={(open) => { if (!open && referencePickerOpen) return; setBatchOpen(open) }}>
      <DialogContent>
        <DialogHeader><div className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground"><span className="size-2 rounded-full bg-energy" />AI batch</div><DialogTitle>Generate notes</DialogTitle><DialogDescription>Generate multiple notes from a topic or pasted word list. Existing key-field values are skipped and new notes are inserted after the current note.</DialogDescription></DialogHeader>
        <div className="flex flex-col gap-3">
          {referenceChoice}
          <div className="flex flex-col gap-2 rounded-[15px] border border-black/[0.06] bg-background/55 p-3.5 dark:border-white/[0.08]"><Label htmlFor="batch-topic">Topic or word list</Label><Textarea id="batch-topic" value={batchTopic} placeholder="e.g. TOEFL high-frequency verbs, or one word per line" className="min-h-28" onChange={(event) => setBatchTopic(event.target.value)} /></div>
          <div className="flex flex-col gap-2 rounded-[15px] border border-black/[0.06] bg-background/55 p-3.5 dark:border-white/[0.08]"><Label htmlFor="batch-count">Count</Label><Input id="batch-count" type="number" min={1} max={50} value={batchCount} onChange={(event) => setBatchCount(event.target.value)} /></div>
        </div>
        <DialogFooter className="flex flex-row justify-end gap-2 pt-1"><Button type="button" variant="outline" className="flex-1 sm:flex-initial" onClick={() => setBatchOpen(false)}>Cancel</Button><Button type="button" className="flex-1 sm:flex-initial" disabled={isBusy("batch")} onClick={applyBatchAi}>{isBusy("batch") ? "Generating…" : "Generate"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )

  const completeDialog = (
    <Dialog open={completeOpen && !referencePickerOpen} onOpenChange={(open) => { if (!open && referencePickerOpen) return; setCompleteOpen(open) }}>
      <DialogContent>
        <DialogHeader><div className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground"><span className="size-2 rounded-full bg-energy" />AI fill</div><DialogTitle>Fill empty fields</DialogTitle><DialogDescription>Use the existing content to fill only the fields that are still empty.</DialogDescription></DialogHeader>
        <div className="flex flex-col gap-3">
          {referenceChoice}
          <div className="space-y-3 rounded-[15px] border border-black/[0.06] bg-background/55 p-3.5 dark:border-white/[0.08]">
            <div><span className="text-xs font-semibold text-foreground">Existing fields</span><div className="mt-2 space-y-1.5">{filledFields.map((field) => <div key={field} className="flex items-start gap-2.5 rounded-[11px] bg-card px-3 py-2 text-xs"><span className="w-24 shrink-0 truncate font-medium text-muted-foreground">{field}</span><span className="break-all font-medium text-foreground">{selected?.values[field]}</span></div>)}</div></div>
            <div className="pt-1"><span className="text-xs font-semibold text-foreground">To fill</span><div className="mt-2 flex flex-wrap gap-1.5">{emptyFields.map((field) => <span key={field} className="inline-flex items-center rounded-[8px] bg-energy/25 px-2.5 py-1 text-xs font-semibold text-foreground">{field}</span>)}</div></div>
          </div>
        </div>
        <DialogFooter className="flex flex-row justify-end gap-2 pt-1"><Button type="button" variant="outline" className="flex-1 sm:flex-initial" onClick={() => setCompleteOpen(false)}>Cancel</Button><Button type="button" className="flex-1 sm:flex-initial" disabled={isBusy("card:complete")} onClick={applyCardCompletion}>{isBusy("card:complete") ? "Filling…" : "Fill fields"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )

  const renderListItem = (card: Card, index: number) => {
    const absolute = deck.cards.findIndex((item) => item.id === card.id) + 1
    const active = card.id === selected?.id
    const isReviewed = review.reviewed.includes(card.id)
    return (
      <button
        id={`card-item-${card.id}`}
        key={card.id}
        type="button"
        onClick={() => {
          onSelect(card.id)
          if (onOpenNote) onOpenNote(card.id)
          else setMobilePane("editor")
        }}
        style={{ height: LIST_ROW }}
        className={cn(
          "group flex w-full touch-manipulation items-center justify-between rounded-[13px] px-3 py-2 text-left transition-[transform,opacity,background-color] duration-150 [-webkit-tap-highlight-color:transparent] active:scale-[0.99]",
          active && !listOnly ? "bg-foreground text-background" : "text-foreground hover:bg-muted/55",
          !active && isReviewed && "opacity-55"
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3 pr-2">
          <span className="w-6 shrink-0 text-center font-mono text-[10px] font-medium text-current opacity-40">{absolute || index + 1}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2"><span className="truncate text-xs font-semibold tracking-[-0.01em]">{cardLabel(card, deck.fields)}</span>{isReviewed ? <span className="inline-flex shrink-0 items-center gap-0.5 rounded-[7px] bg-current/8 px-1.5 py-0.5 text-[9px] font-medium" aria-label="Reviewed"><Check className="size-2.5" aria-hidden="true" />Reviewed</span> : null}</div>
            <span className="mt-0.5 block truncate text-[11px] opacity-50">{cardSubtitle(card, deck.fields) || "Empty note"}</span>
          </div>
        </div>
        <ChevronRight className="size-3.5 shrink-0 opacity-25 transition-transform group-active:translate-x-0.5" />
      </button>
    )
  }

  const listSlice = visibleCards.slice(listStart, listEnd)
  const listBox = (
    <div ref={listRef} data-testid="notes-card-list" className={cn("overflow-y-auto overscroll-contain rounded-[20px] bg-card", listOnly ? "min-h-0 flex-1" : "h-[min(58vh,520px)] lg:h-[min(calc(100vh-16rem),720px)]")}>
      <div className="p-1">
        {deck.cards.length === 0 ? (
          <div className="m-1 rounded-[16px] border border-black/[0.06] bg-muted/45 px-4 py-12 text-center text-xs dark:border-white/[0.08]"><p className="text-base font-semibold tracking-[-0.02em]">No notes yet</p><p className="mt-1 text-muted-foreground">Create a note or use AI Generate to get started.</p></div>
        ) : visibleCards.length === 0 ? (
          <div className="m-1 rounded-[16px] border border-black/[0.06] bg-muted/45 px-4 py-12 text-center text-xs text-muted-foreground dark:border-white/[0.08]">No notes match “{query}”.</div>
        ) : (
          <>{listPadTop > 0 ? <div style={{ height: listPadTop }} /> : null}{listSlice.map((card, offset) => renderListItem(card, listStart + offset))}{listPadBottom > 0 ? <div style={{ height: listPadBottom }} /> : null}</>
        )}
      </div>
    </div>
  )

  return (
    <div className={cn("flex min-w-0 flex-col gap-3", listOnly && "h-full min-h-0 flex-1 overflow-hidden", detail && "h-full min-h-0 flex-1 overflow-hidden")}>
      <div className={cn("min-h-0 min-w-0 flex-1", (listOnly || detail) ? "flex flex-col overflow-hidden lg:grid lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)] lg:gap-6" : "grid gap-6 lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)]")}>
        <section className={cn("min-h-0 flex-col gap-3", listOnly ? "flex h-full flex-1" : detail ? "hidden lg:flex" : mobilePane === "list" ? "flex" : "hidden lg:flex")}>
          <div className={cn("shrink-0 pb-1", !listOnly && detail && "hidden")}>{listToolbar}</div>
          {listBox}
        </section>

        <section data-testid="card-editor-fields" className={cn("min-h-0 flex-col gap-4", listOnly ? "hidden lg:flex" : detail ? (editorPane === "editor" ? "flex h-full min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 pb-16" : "hidden lg:flex") : mobilePane === "editor" ? "flex" : "hidden lg:flex")}>
          {selected ? <>
            <div className="flex shrink-0 flex-col gap-2">
              {!listOnly && !detail && mobilePager}
              <div className="rounded-[18px] border border-black/[0.065] bg-card p-3.5 dark:border-white/[0.09]">
                <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground"><span className="size-1.5 rounded-full bg-energy" />Edit note · {selectedIndex}/{deck.cards.length}</p>
                <div className="mt-1 flex min-w-0 items-center gap-2">
                  <p className="min-w-0 flex-1 truncate text-lg font-semibold tracking-[-0.03em] text-foreground">{cardLabel(selected, deck.fields) || "Untitled note"}</p>
                  <div data-testid="note-action-rail" className="flex shrink-0 items-center gap-1">
                    <Button type="button" size="xs" variant={isSelectedReviewed ? "outline" : "default"} className="h-8 whitespace-nowrap px-2 text-[11px]" data-testid={isSelectedReviewed ? "undo-card-review" : "approve-card-review"} aria-pressed={isSelectedReviewed} aria-keyshortcuts={isSelectedReviewed ? undefined : "Alt+ArrowDown"} title={isSelectedReviewed ? "Mark this note as needing review" : "Mark reviewed and move to the next note (Alt+↓)"} onClick={isSelectedReviewed ? undoCurrentReview : approveCurrent}>{isSelectedReviewed ? "Undo" : "Review"}</Button>
                    <Button type="button" size="xs" variant="outline" className="h-8 whitespace-nowrap px-2 text-[11px]" aria-label="AI Fill" disabled={!canCompleteSelected || isBusy("card:complete")} title={!selected ? undefined : !hasFilledField ? "Fill at least one field before using AI Fill" : !hasEmptyField ? "Every field is already filled" : "Fill only the empty fields from the existing note content"} onClick={() => setCompleteOpen(true)}>AI</Button>
                    <Button type="button" size="xs" variant="ghost" className="h-8 whitespace-nowrap px-2 text-[11px] text-destructive" onClick={() => removeCard(selected.id)}>Delete</Button>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              {deck.fields.map((field) => {
                const tts = fieldTts[field]
                if (tts) {
                  const sourceText = selected.values[tts.source] ?? ""
                  return <div key={field} className="relative space-y-2 overflow-hidden rounded-[17px] border border-black/[0.06] bg-card p-3.5 dark:border-white/[0.08]"><span className="absolute inset-y-0 left-0 w-0.5 bg-energy" aria-hidden="true" /><div className="flex items-center justify-between gap-2"><div className="min-w-0"><Label>{field}</Label><p className="mt-0.5 text-xs text-muted-foreground">{ttsLangLabel(tts.lang)} · from “{tts.source}”{tts.slow ? " · slow" : ""}</p></div><TtsPlayButton text={sourceText} lang={tts.lang} slow={tts.slow} /></div><div className="rounded-[12px] bg-muted/50 px-3 py-2.5 text-sm text-foreground/75">{sourceText.trim() || "Source field is empty; export will skip it."}</div></div>
                }
                const fieldNote = notesOf(deck)[field]?.trim() || undefined
                return <div key={field} className="space-y-2 rounded-[17px] border border-black/[0.06] bg-card p-3.5 dark:border-white/[0.08]"><Label htmlFor={`field-${field}`}>{field}</Label>{editableFields.indexOf(field) >= 2 ? <Textarea id={`field-${field}`} value={selected.values[field] ?? ""} placeholder={fieldNote} className="min-h-28 bg-background placeholder:text-muted-foreground/65" onChange={(event) => updateCard(selected.id, field, event.target.value)} /> : <Input id={`field-${field}`} value={selected.values[field] ?? ""} placeholder={fieldNote} className="bg-background placeholder:text-muted-foreground/65" onChange={(event) => updateCard(selected.id, field, event.target.value)} />}</div>
              })}
            </div>
          </> : <div className="flex h-[360px] items-center justify-center rounded-[20px] border border-black/[0.065] bg-card text-sm font-medium text-muted-foreground dark:border-white/[0.09]">Create a note to start editing.</div>}
        </section>

        <section className={cn(listOnly ? "hidden lg:block" : detail ? (editorPane === "preview" ? "block h-full min-h-0 flex-1 overflow-y-auto overscroll-contain pb-16" : "hidden lg:block") : mobilePane === "preview" ? "block" : "hidden lg:block")}>{preview}</section>
      </div>
      {aiDialog}
      {batchDialog}
      {completeDialog}
      <ReferenceNotesPicker cards={deck.cards} fields={editableFields} referenceIds={review.referenceIds} onChange={(ids) => setReview((state) => ({ ...state, referenceIds: ids }))} open={referencePickerOpen} onOpenChange={setReferencePickerOpen} />
    </div>
  )
}
