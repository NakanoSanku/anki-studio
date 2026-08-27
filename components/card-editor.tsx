"use client"

import { useEffect, useRef, useState } from "react"
import { BookOpen, Check, ChevronLeft, ChevronRight, Plus, Search, X } from "lucide-react"

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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { CardPreview } from "@/components/card-preview"
import { useVirtualWindow } from "@/components/use-virtual-window"
import { cn } from "@/lib/utils"

type MobilePane = "list" | "editor" | "preview"

const LIST_ROW = 60
const FILTERS: { id: ReviewFilter; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "unreviewed", label: "未审" },
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
    if (layout === "list") {
      setMobilePane("list")
    }
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
    const currentId = activeRef.current
    const nextId = neighborId(list, currentId, delta)
    if (nextId) onSelect(nextId)
  }

  const approveCurrent = () => {
    const currentId = activeRef.current
    if (!currentId) return
    const list = visibleRef.current
    const currentIndex = list.findIndex((card) => card.id === currentId)
    let nextId = currentIndex >= 0 ? list[currentIndex + 1]?.id ?? "" : list[0]?.id ?? ""
    if (!nextId && filter === "unreviewed") {
      nextId = list.find((card) => card.id !== currentId)?.id ?? ""
    }
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
      const repeating =
        event.repeat && (event.key === "ArrowDown" || event.key === "n" || event.key === "N")
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
      setAlert(error instanceof Error ? error.message : "AI 调用失败")
    } finally {
      busyRef.current.delete(task)
      setBusyKeys([...busyRef.current])
    }
  }

  const applyBatchAi = () => {
    const count = Number(batchCount)
    if (!batchTopic.trim()) {
      setAlert("请填写主题或词表")
      return
    }
    if (!Number.isFinite(count) || count < 1 || count > 50) {
      setAlert("生成数量需要在 1 到 50 之间")
      return
    }
    const topic = batchTopic.trim()
    const fields = editableFields
    const notes = notesOf(deck)
    const keyField = deck.fields[0]
    const existingKeys = deck.cards
      .map((card) => (keyField ? card.values[keyField] ?? "" : ""))
      .map((value) => value.trim())
      .filter(Boolean)
    const references = review.referenceIds
      .map((id) => deck.cards.find((card) => card.id === id)?.values)
      .filter((values): values is Record<string, string> => Boolean(values))
    const anchorId = selected?.id ?? ""
    void runAi("batch", async () => {
      const generated = await requestBatchAi({
        topic,
        count: Math.floor(count),
        fields,
        existingKeys,
        notes,
        references,
      })
      const incoming = generated.map((values) => createCard(fields, values))
      const beforeLen = deckRef.current.cards.length
      const result = commitChange((current) => mergeGeneratedCards(current, incoming, anchorId))
      if (!result.ok) throw new Error(result.error)
      const afterIndex = result.deck.cards.findIndex((card) => card.id === anchorId)
      const added = result.deck.cards.length - beforeLen
      const last =
        afterIndex >= 0 ? result.deck.cards[afterIndex + added] : result.deck.cards[result.deck.cards.length - 1]
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
      const generated = await requestCardAi({
        fields: editableFields,
        values,
        notes: notesOf(deck),
        references,
      })
      const result = commitChange((current) => mergeCardAiValues(current, cardId, generated))
      if (!result.ok) throw new Error(result.error)
      setReview((state) => markUnreviewed(state, cardId))
      setCompleteOpen(false)
    })
  }

  const removeCard = (id: string) => {
    const current = deckRef.current
    const nextId = idAfterDelete(current.cards, id)
    const next = removeNoteSchedule(
      { ...current, cards: current.cards.filter((card) => card.id !== id) },
      id
    )
    pushDeck(next)
    setReview((state) => pruneEditorState({ ...state, selectedId: nextId }, next.cards))
    if (selectedId === id) onSelect(nextId)
  }

  const listToolbar = (
    <div className="space-y-3 rounded-[1.8rem] bg-[#dff1ff] p-3 shadow-[0_18px_48px_-38px_rgba(0,0,0,0.65)] dark:bg-[#1e3b55] sm:p-3.5">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-black/40 dark:text-white/45">note library</p>
          <div className="mt-0.5 flex items-baseline gap-2">
            <p className="text-xl font-black tracking-[-0.045em] text-foreground">{deck.cards.length} 张笔记</p>
            <span className="text-[11px] font-bold text-muted-foreground">已审 {reviewedCount}</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-9 rounded-full bg-[#ff9bd6]/45 px-3 text-xs font-black text-foreground hover:bg-[#ff9bd6]/60 dark:bg-[#6c3154] dark:hover:bg-[#77405f]"
            disabled={isBusy("batch")}
            onClick={() => setBatchOpen(true)}
          >
            生成
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-9 rounded-full bg-black px-3 text-xs font-black text-white shadow-none hover:bg-black/85 dark:bg-white dark:text-black dark:hover:bg-white/90"
            aria-label="新建卡片"
            title="在当前卡片后新建"
            onClick={addCard}
          >
            <Plus className="mr-1 size-3.5" />
            新建
          </Button>
        </div>
      </div>

      <div className="relative min-w-0">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-3.5 -translate-y-1/2 text-foreground/35" />
        <Input
          value={query}
          aria-label="搜索卡片"
          placeholder="搜索单词、释义或例句…"
          className="h-11 rounded-full border-0 bg-white/75 pr-10 pl-9.5 text-sm font-semibold shadow-none placeholder:text-muted-foreground/70 focus-visible:ring-black/10 dark:bg-black/15 dark:focus-visible:ring-white/10"
          onChange={(event) => setQuery(event.target.value)}
        />
        {query.trim() ? (
          <button
            type="button"
            aria-label="清空搜索"
            className="absolute top-1/2 right-3 flex size-6 -translate-y-1/2 touch-manipulation items-center justify-center rounded-full bg-black/[0.06] text-muted-foreground transition-transform [-webkit-tap-highlight-color:transparent] active:scale-90 dark:bg-white/10"
            onClick={() => setQuery("")}
          >
            <X className="size-3" />
          </button>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-full bg-white/55 p-1 dark:bg-black/15">
            {FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                data-testid={`mobile-review-filter-${item.id}`}
                className={cn(
                  "h-7 touch-manipulation rounded-full px-3 text-[11px] font-black transition-all [-webkit-tap-highlight-color:transparent]",
                  filter === item.id
                    ? "bg-black text-white dark:bg-white dark:text-black"
                    : "text-foreground/45 active:bg-black/[0.06] dark:active:bg-white/10"
                )}
                onClick={() => setFilter(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          {review.referenceIds.length > 0 ? (
            <ReferenceNotesBar
              referenceIds={review.referenceIds}
              onOpenPicker={() => setReferencePickerOpen(true)}
            />
          ) : null}
        </div>
        <p className="font-mono text-[10px] font-bold tabular-nums text-muted-foreground sm:text-xs">
          {query.trim() || filter !== "all" ? `${visibleCards.length} / ${deck.cards.length}` : `${deck.cards.length}`}
        </p>
      </div>
    </div>
  )

  const mobilePager = (
    <div className="flex items-center gap-2 lg:hidden">
      <div className="grid h-11 min-w-0 flex-1 grid-cols-[2.5rem_1fr_2.5rem] items-center rounded-full bg-[#ffe39a] p-0.5 shadow-[0_12px_28px_-24px_rgba(0,0,0,0.65)] dark:bg-[#68551f]">
        <Button
          type="button"
          size="icon-lg"
          variant="ghost"
          aria-label="上一张卡片"
          title="上一张"
          disabled={selectedIndex <= 1}
          onClick={() => jumpTo(selectedIndex - 1)}
        >
          <ChevronLeft />
        </Button>
        <div className="grid min-w-0 grid-cols-[minmax(3rem,1fr)_auto] items-center gap-2 px-1">
          <Slider
            id="mobile-card-slider"
            data-testid="mobile-card-slider"
            value={[Math.max(1, selectedIndex)]}
            min={1}
            max={Math.max(1, deck.cards.length)}
            step={1}
            disabled={deck.cards.length <= 1}
            aria-label="拖动选择卡片"
            aria-valuetext={
              deck.cards.length === 0 ? "没有卡片" : `第 ${selectedIndex} 张，共 ${deck.cards.length} 张`
            }
            className="h-8 cursor-grab active:cursor-grabbing [&_[data-slot=slider-range]]:bg-transparent [&_[data-slot=slider-thumb]]:h-4 [&_[data-slot=slider-thumb]]:w-7 [&_[data-slot=slider-thumb]]:border-2 [&_[data-slot=slider-thumb]]:border-white [&_[data-slot=slider-thumb]]:bg-black [&_[data-slot=slider-thumb]]:shadow-sm [&_[data-slot=slider-track]]:h-1.5 [&_[data-slot=slider-track]]:bg-black/15 dark:[&_[data-slot=slider-thumb]]:border-black dark:[&_[data-slot=slider-thumb]]:bg-white dark:[&_[data-slot=slider-track]]:bg-white/20"
            onValueChange={([index]) => {
              if (index !== undefined && index !== selectedIndex) jumpTo(index)
            }}
          />
          <output
            htmlFor="mobile-card-slider"
            aria-live="polite"
            className="min-w-10 whitespace-nowrap text-right font-mono text-xs font-black tabular-nums"
          >
            <span className="text-foreground">{selectedIndex}</span>
            <span className="text-foreground/45"> / {deck.cards.length}</span>
          </output>
        </div>
        <Button
          type="button"
          size="icon-lg"
          variant="ghost"
          aria-label="下一张卡片"
          title="下一张"
          disabled={selectedIndex >= deck.cards.length}
          onClick={() => jumpTo(selectedIndex + 1)}
        >
          <ChevronRight />
        </Button>
      </div>
      <Button type="button" size="lg" className="px-3" onClick={addCard}>
        <Plus data-icon="inline-start" />
        新建
      </Button>
    </div>
  )

  const preview = (
    <CardPreview
      deck={deck}
      values={selected?.values ?? {}}
      side={previewSide}
      onSideChange={onPreviewSideChange}
      fillViewport
    />
  )

  const aiDialog = (
    <AlertDialog open={Boolean(alert)} onOpenChange={(open) => { if (!open) setAlert("") }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>无法完成操作</AlertDialogTitle>
          <AlertDialogDescription>{alert}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction>知道了</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )

  const batchDialog = (
    <Dialog
      open={batchOpen && !referencePickerOpen}
      onOpenChange={(open) => {
        if (!open && referencePickerOpen) return
        setBatchOpen(open)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <div className="mb-1 inline-flex w-fit rounded-full bg-[#ff9bd6]/35 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em]">ai batch</div>
          <DialogTitle>批量生成</DialogTitle>
          <DialogDescription>
            按主题或粘贴词表一次生成多条笔记。与现有首字段相同的不会写入。新笔记插在当前笔记后面。
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between rounded-[1.4rem] bg-[#dff1ff] p-3.5 dark:bg-[#1e3b55]">
            <div className="flex min-w-0 flex-1 items-center gap-2.5 pr-2">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/65 text-foreground dark:bg-black/15">
                <BookOpen className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-black text-foreground">参考范例</span>
                  {review.referenceIds.length > 0 && (
                    <span className="rounded-full bg-black px-1.5 py-0.5 text-[10px] font-black text-white dark:bg-white dark:text-black">
                      {review.referenceIds.length} 张
                    </span>
                  )}
                </div>
                <p className="mt-0.5 truncate text-[11px] font-medium text-muted-foreground">
                  {review.referenceIds.length > 0 ? "学习选定卡片的排版与例句风格" : "从卡包中指定 1~3 张风格范例"}
                </p>
              </div>
            </div>
            <Button
              type="button"
              size="xs"
              variant="outline"
              className="h-8 shrink-0 rounded-full bg-white/70 text-xs font-black dark:bg-black/15"
              onClick={() => setReferencePickerOpen(true)}
            >
              {review.referenceIds.length > 0 ? "修改" : "选择"}
            </Button>
          </div>
          <div className="flex flex-col gap-2 rounded-[1.35rem] bg-[#fff3c8] p-3.5 dark:bg-[#4f431d]">
            <Label htmlFor="batch-topic">主题或词表</Label>
            <Textarea
              id="batch-topic"
              value={batchTopic}
              placeholder="例如：托福高频动词，或每行一个单词"
              className="min-h-28 bg-white/70 dark:bg-black/15"
              onChange={(event) => setBatchTopic(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2 rounded-[1.35rem] bg-[#dff5c8] p-3.5 dark:bg-[#314c25]">
            <Label htmlFor="batch-count">数量</Label>
            <Input
              id="batch-count"
              type="number"
              min={1}
              max={50}
              value={batchCount}
              className="bg-white/70 dark:bg-black/15"
              onChange={(event) => setBatchCount(event.target.value)}
            />
          </div>
        </div>
        <DialogFooter className="flex flex-row justify-end gap-2 pt-1">
          <Button type="button" variant="outline" className="flex-1 sm:flex-initial" onClick={() => setBatchOpen(false)}>
            取消
          </Button>
          <Button type="button" className="flex-1 bg-black text-white sm:flex-initial dark:bg-white dark:text-black" disabled={isBusy("batch")} onClick={applyBatchAi}>
            {isBusy("batch") ? "生成中…" : "开始生成"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  const completeDialog = (
    <Dialog
      open={completeOpen && !referencePickerOpen}
      onOpenChange={(open) => {
        if (!open && referencePickerOpen) return
        setCompleteOpen(open)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <div className="mb-1 inline-flex w-fit rounded-full bg-[#ff9bd6]/35 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em]">ai complete</div>
          <DialogTitle>补全卡片</DialogTitle>
          <DialogDescription>
            基于当前已有字段内容，自动补全空白项。
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between rounded-[1.4rem] bg-[#dff1ff] p-3.5 dark:bg-[#1e3b55]">
            <div className="flex min-w-0 flex-1 items-center gap-2.5 pr-2">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/65 text-foreground dark:bg-black/15">
                <BookOpen className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-black text-foreground">参考范例</span>
                  {review.referenceIds.length > 0 && (
                    <span className="rounded-full bg-black px-1.5 py-0.5 text-[10px] font-black text-white dark:bg-white dark:text-black">
                      {review.referenceIds.length} 张
                    </span>
                  )}
                </div>
                <p className="mt-0.5 truncate text-[11px] font-medium text-muted-foreground">
                  {review.referenceIds.length > 0 ? "学习选定卡片的排版与例句风格" : "从卡包中指定 1~3 张风格范例"}
                </p>
              </div>
            </div>
            <Button
              type="button"
              size="xs"
              variant="outline"
              className="h-8 shrink-0 rounded-full bg-white/70 text-xs font-black dark:bg-black/15"
              onClick={() => setReferencePickerOpen(true)}
            >
              {review.referenceIds.length > 0 ? "修改" : "选择"}
            </Button>
          </div>

          <div className="space-y-3 rounded-[1.4rem] bg-[#fff3c8] p-3.5 dark:bg-[#4f431d]">
            <div>
              <span className="text-xs font-black text-foreground">已有字段</span>
              <div className="mt-2 space-y-1.5">
                {filledFields.map((field) => (
                  <div
                    key={field}
                    className="flex items-start gap-2.5 rounded-xl bg-white/65 px-3 py-2 text-xs dark:bg-black/15"
                  >
                    <span className="w-24 shrink-0 truncate font-black text-muted-foreground">{field}</span>
                    <span className="break-all font-semibold text-foreground">{selected?.values[field]}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-1">
              <span className="text-xs font-black text-foreground">待补全</span>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {emptyFields.map((field) => (
                  <span
                    key={field}
                    className="inline-flex items-center rounded-full bg-[#c8f889] px-2.5 py-1 text-xs font-black text-[#315f18] dark:bg-[#385528] dark:text-[#e4f8c5]"
                  >
                    {field}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
        <DialogFooter className="flex flex-row justify-end gap-2 pt-1">
          <Button type="button" variant="outline" className="flex-1 sm:flex-initial" onClick={() => setCompleteOpen(false)}>
            取消
          </Button>
          <Button type="button" className="flex-1 bg-black text-white sm:flex-initial dark:bg-white dark:text-black" disabled={isBusy("card:complete")} onClick={applyCardCompletion}>
            {isBusy("card:complete") ? "补全中…" : "开始补全"}
          </Button>
        </DialogFooter>
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
          "group flex w-full touch-manipulation items-center justify-between px-4 py-2.5 text-left transition-[transform,opacity,background-color] duration-150 [-webkit-tap-highlight-color:transparent] active:scale-[0.985]",
          active && !listOnly
            ? "bg-black text-white font-bold dark:bg-white dark:text-black"
            : "text-foreground",
          !active && isReviewed && "opacity-60"
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3 pr-2">
          <span className="w-6 shrink-0 text-center font-mono text-xs font-bold text-current opacity-45">
            {absolute || index + 1}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-xs font-black tracking-tight">
                {cardLabel(card, deck.fields)}
              </span>
              {isReviewed ? (
                <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-black/8 px-1.5 py-0.5 text-[10px] font-black text-current dark:bg-white/10" aria-label="已审核">
                  <Check className="size-2.5" aria-hidden="true" />
                  已审
                </span>
              ) : null}
            </div>
            <span className="mt-0.5 block truncate text-[11px] font-medium opacity-55">
              {cardSubtitle(card, deck.fields) || "空卡片"}
            </span>
          </div>
        </div>
        <ChevronRight className="size-3.5 shrink-0 opacity-35 transition-transform group-active:translate-x-0.5" />
      </button>
    )
  }

  const listSlice = visibleCards.slice(listStart, listEnd)

  const listOnly = layout === "list"
  const detail = layout === "detail"
  const editorPane = detail ? (mobilePane === "preview" ? "preview" : "editor") : mobilePane

  const listBox = (
    <div
      ref={listRef}
      data-testid="notes-card-list"
      className={cn(
        "overflow-y-auto overscroll-contain rounded-[1.8rem] bg-card shadow-[0_20px_50px_-42px_rgba(0,0,0,0.68)]",
        listOnly
          ? "min-h-0 flex-1"
          : "h-[min(58vh,520px)] lg:h-[min(calc(100vh-16rem),720px)]"
      )}
    >
      <div className="space-y-1 p-1">
        {deck.cards.length === 0 ? (
          <div className="m-1 rounded-[1.4rem] bg-[#ffe39a] px-4 py-12 text-center text-xs text-[#654600] dark:bg-[#68551f] dark:text-[#ffedb8]">
            <p className="text-base font-black tracking-tight">还没有卡片</p>
            <p className="mt-1 font-semibold opacity-70">点击上方「新建」或「生成」添加第一张卡片</p>
          </div>
        ) : visibleCards.length === 0 ? (
          <div className="m-1 rounded-[1.4rem] bg-[#ffd8df] px-4 py-12 text-center text-xs font-semibold text-[#761c31] dark:bg-[#6a2835] dark:text-[#ffdce3]">
            没有匹配「{query}」的卡片
          </div>
        ) : (
          <>
            {listPadTop > 0 ? <div style={{ height: listPadTop }} /> : null}
            {listSlice.map((card, offset) => renderListItem(card, listStart + offset))}
            {listPadBottom > 0 ? <div style={{ height: listPadBottom }} /> : null}
          </>
        )}
      </div>
    </div>
  )

  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-3",
        listOnly && "h-full min-h-0 flex-1 overflow-hidden",
        detail && "h-full min-h-0 flex-1 overflow-hidden"
      )}
    >
      {detail ? (
        <div className="shrink-0 lg:hidden">
          <Tabs value={editorPane === "preview" ? "preview" : "editor"} onValueChange={(value) => setMobilePane(value as MobilePane)}>
            <TabsList className="grid h-11 w-full grid-cols-2 rounded-full bg-[#ffe39a] p-1 dark:bg-[#68551f]">
              <TabsTrigger value="editor">编辑</TabsTrigger>
              <TabsTrigger value="preview">预览</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      ) : null}
      <div className={cn(
        "min-w-0 min-h-0 flex-1",
        (listOnly || detail)
          ? "flex flex-col lg:grid lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)] lg:gap-6 overflow-hidden"
          : "grid gap-6 lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)]"
      )}>
        <section className={cn(
          "min-h-0 flex-col gap-3",
          listOnly ? "flex h-full flex-1" : detail ? "hidden lg:flex" : mobilePane === "list" ? "flex" : "hidden lg:flex"
        )}>
          <div className={cn("shrink-0 pb-1", !listOnly && detail && "hidden")}>{listToolbar}</div>
          {listBox}
        </section>

        <section
          data-testid="card-editor-fields"
          className={cn(
            "min-h-0 flex-col gap-4",
            listOnly
              ? "hidden lg:flex"
              : detail
                ? (editorPane === "editor" ? "flex h-full min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 pb-16" : "hidden lg:flex")
                : mobilePane === "editor" ? "flex" : "hidden lg:flex"
          )}
        >
          {selected ? (
            <>
              <div className="shrink-0 flex flex-col gap-2">
                {!listOnly && !detail && mobilePager}
                <div className="flex flex-col gap-3 rounded-[1.65rem] bg-[#ffe39a] p-3.5 dark:bg-[#68551f] sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-black/40 dark:text-white/45">edit note · {selectedIndex}/{deck.cards.length}</p>
                    <p className="mt-0.5 truncate text-lg font-black tracking-[-0.035em] text-foreground">
                      {cardLabel(selected, deck.fields) || "未命名笔记"}
                    </p>
                  </div>
                  <div className="flex min-w-0 shrink-0 items-center gap-1.5 max-[380px]:gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className={cn(
                        "h-9 rounded-full px-3 text-xs font-black max-[380px]:px-2.5 max-[380px]:text-[11px]",
                        isSelectedReviewed
                          ? "bg-white/55 text-foreground hover:bg-white/70 dark:bg-black/15"
                          : "bg-black text-white hover:bg-black/85 dark:bg-white dark:text-black dark:hover:bg-white/90"
                      )}
                      data-testid={isSelectedReviewed ? "undo-card-review" : "approve-card-review"}
                      aria-pressed={isSelectedReviewed}
                      aria-keyshortcuts={isSelectedReviewed ? undefined : "Alt+ArrowDown"}
                      title={
                        isSelectedReviewed
                          ? "取消当前卡片的已审核状态"
                          : "将当前卡片标记为已审核并前往下一张（Alt+↓）"
                      }
                      onClick={isSelectedReviewed ? undoCurrentReview : approveCurrent}
                    >
                      {isSelectedReviewed ? "取消审核" : "审核完成"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-9 rounded-full bg-[#ff9bd6]/50 px-3 text-xs font-black text-foreground hover:bg-[#ff9bd6]/65 max-[380px]:px-2.5 max-[380px]:text-[11px] dark:bg-[#6c3154] dark:hover:bg-[#77405f]"
                      disabled={!canCompleteSelected || isBusy("card:complete")}
                      title={
                        !selected
                          ? undefined
                          : !hasFilledField
                            ? "请至少填入一个字段后再使用补全"
                            : !hasEmptyField
                              ? "当前卡片所有字段均已填满，无需补全"
                              : "基于已有字段内容自动补全空白字段"
                      }
                      onClick={() => setCompleteOpen(true)}
                    >
                      AI 补全
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-9 rounded-full bg-white/45 px-3 text-xs font-black text-destructive hover:bg-white/65 max-[380px]:px-2.5 max-[380px]:text-[11px] dark:bg-black/15"
                      onClick={() => removeCard(selected.id)}
                    >
                      删除
                    </Button>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-3.5">
                {deck.fields.map((field, fieldIndex) => {
                  const tts = fieldTts[field]
                  if (tts) {
                    const sourceText = selected.values[tts.source] ?? ""
                    return (
                      <div key={field} className="space-y-2 rounded-[1.5rem] bg-[#dff1ff] p-3.5 dark:bg-[#1e3b55]">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <Label>{field}</Label>
                            <p className="mt-0.5 text-xs font-medium text-muted-foreground">
                              {ttsLangLabel(tts.lang)} · 来自「{tts.source}」
                              {tts.slow ? " · 慢速" : ""}
                            </p>
                          </div>
                          <TtsPlayButton text={sourceText} lang={tts.lang} slow={tts.slow} />
                        </div>
                        <div className="rounded-[1.1rem] bg-white/65 px-3 py-2.5 text-sm font-medium text-foreground/80 dark:bg-black/15">
                          {sourceText.trim() || "源字段为空，导出时跳过"}
                        </div>
                      </div>
                    )
                  }
                  const fieldNote = notesOf(deck)[field]?.trim() || undefined
                  return (
                    <div
                      key={field}
                      className={cn(
                        "space-y-2 rounded-[1.5rem] p-3.5",
                        fieldIndex % 4 === 0 && "bg-[#fff3c8] dark:bg-[#4f431d]",
                        fieldIndex % 4 === 1 && "bg-[#dff5c8] dark:bg-[#314c25]",
                        fieldIndex % 4 === 2 && "bg-[#ffdce9] dark:bg-[#5e3047]",
                        fieldIndex % 4 === 3 && "bg-[#dff1ff] dark:bg-[#1e3b55]"
                      )}
                    >
                      <Label htmlFor={`field-${field}`}>{field}</Label>
                      {editableFields.indexOf(field) >= 2 ? (
                        <Textarea
                          id={`field-${field}`}
                          value={selected.values[field] ?? ""}
                          placeholder={fieldNote}
                          className="min-h-28 border-0 bg-white/65 placeholder:text-muted-foreground/65 dark:bg-black/15"
                          onChange={(event) => updateCard(selected.id, field, event.target.value)}
                        />
                      ) : (
                        <Input
                          id={`field-${field}`}
                          value={selected.values[field] ?? ""}
                          placeholder={fieldNote}
                          className="border-0 bg-white/65 placeholder:text-muted-foreground/65 dark:bg-black/15"
                          onChange={(event) => updateCard(selected.id, field, event.target.value)}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          ) : (
            <div className="flex h-[360px] items-center justify-center rounded-[2rem] bg-[#ffe39a] text-sm font-black text-[#654600] dark:bg-[#68551f] dark:text-[#ffedb8]">
              先新建一张卡片
            </div>
          )}
        </section>

        <section className={cn(
          listOnly
            ? "hidden lg:block"
            : detail
              ? (editorPane === "preview" ? "block h-full min-h-0 flex-1 overflow-y-auto overscroll-contain pb-16" : "hidden lg:block")
              : mobilePane === "preview" ? "block" : "hidden lg:block"
        )}>
          {preview}
        </section>
      </div>
      {aiDialog}
      {batchDialog}
      {completeDialog}
      <ReferenceNotesPicker
        cards={deck.cards}
        fields={editableFields}
        referenceIds={review.referenceIds}
        onChange={(ids) => setReview((state) => ({ ...state, referenceIds: ids }))}
        open={referencePickerOpen}
        onOpenChange={setReferencePickerOpen}
      />
    </div>
  )
}
