"use client"

import { useEffect, useRef, useState } from "react"
import { Check, ChevronLeft, ChevronRight, Plus, Search, Sparkles } from "lucide-react"

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

const LIST_ROW = 56
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
  const busyRef = useRef(new Set<string>())
  const deckRef = useRef(deck)
  const pendingDecks = useRef(new Set<Deck>())
  const [alert, setAlert] = useState("")
  const [batchOpen, setBatchOpen] = useState(false)
  const [referencePickerOpen, setReferencePickerOpen] = useState(false)
  const [batchTopic, setBatchTopic] = useState("")
  const [batchCount, setBatchCount] = useState("10")
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<ReviewFilter>("all")
  const [review, setReview] = useState<EditorState>(() => readEditorState(deckId, deck))
  const [jumpText, setJumpText] = useState("")
  const [jumpFocused, setJumpFocused] = useState(false)
  const selected = deck.cards.find((card) => card.id === selectedId) ?? deck.cards[0]
  const editableFields = textFields(deck)
  const canCompleteSelected = editableFields.some((field) => !selected?.values[field]?.trim())
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
    if (!selected) return
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

  const jumpValue = jumpFocused ? jumpText : selectedIndex > 0 ? String(selectedIndex) : ""

  const submitJump = () => {
    const raw = jumpFocused ? jumpText : jumpValue
    if (!raw.trim()) return
    const index = Number(raw)
    if (!Number.isFinite(index)) return
    jumpTo(index)
  }

  const desktopToolbar = (
    <div className="hidden flex-col gap-2 lg:flex">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex h-9 items-center rounded-xl border border-border/70 bg-card p-1 shadow-xs">
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              data-testid="prev-card"
              aria-label="上一张卡片"
              title="上一张（Alt+↑）"
              disabled={visibleCards.length === 0}
              onClick={() => goVisible(-1)}
            >
              <ChevronLeft />
            </Button>
            <form
              className="flex items-center gap-1 px-1 text-sm"
              onSubmit={(event) => {
                event.preventDefault()
                submitJump()
              }}
            >
              <span className="text-muted-foreground">卡片</span>
              <Input
                value={jumpValue}
                inputMode="numeric"
                aria-label="跳转到卡片序号"
                data-testid="jump-card-index"
                className="h-7 w-12 border-0 bg-transparent px-1 text-center shadow-none focus-visible:ring-0"
                onChange={(event) => setJumpText(event.target.value.replace(/[^\d]/g, ""))}
                onFocus={() => {
                  setJumpText(selectedIndex > 0 ? String(selectedIndex) : "")
                  setJumpFocused(true)
                }}
                onBlur={() => {
                  submitJump()
                  setJumpFocused(false)
                }}
              />
              <span className="text-muted-foreground">/ {deck.cards.length}</span>
            </form>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              data-testid="next-card"
              aria-label="下一张卡片"
              title="下一张卡片"
              disabled={visibleCards.length === 0}
              onClick={() => goVisible(1)}
            >
              <ChevronRight />
            </Button>
          </div>
          <Button type="button" data-testid="insert-after-card" title="在当前卡片后插入（Alt+N）" onClick={addCard}>
            <Plus data-icon="inline-start" />
            新建卡片
          </Button>
          <Button type="button" variant="outline" disabled={isBusy("batch")} onClick={() => setBatchOpen(true)}>
            <Sparkles data-icon="inline-start" />
            批量生成
          </Button>
        </div>
        <div className="relative min-w-0">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            aria-label="搜索卡片"
            placeholder="搜索卡片"
            className="h-9 w-56 border-border bg-card pr-3 pl-8"
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg bg-muted/70 p-0.5">
            {FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                data-testid={`review-filter-${item.id}`}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs transition-colors",
                  filter === item.id
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setFilter(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {query.trim() || filter !== "all"
              ? `显示 ${visibleCards.length} / ${deck.cards.length}`
              : `${deck.cards.length} 张 · 已审 ${reviewedCount}`}
          </p>
        </div>
        <p className="text-xs text-muted-foreground">Alt+↓ 标记为已审核 · Alt+↑ 上一张 · Alt+N 新建</p>
      </div>
    </div>
  )

  const mobileListToolbar = (
    <div className={cn("space-y-2", layout === "list" ? undefined : "lg:hidden")}>
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            aria-label="搜索卡片"
            placeholder="搜索卡片"
            className="h-10 rounded-xl border-border bg-card pr-3 pl-9"
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <Button
          type="button"
          size="icon-lg"
          aria-label="新建卡片"
          title="在当前卡片后新建"
          onClick={addCard}
        >
          <Plus />
        </Button>
        <Button
          type="button"
          size="lg"
          variant="outline"
          className="px-3"
          disabled={isBusy("batch")}
          onClick={() => setBatchOpen(true)}
        >
          <Sparkles data-icon="inline-start" />
          AI 生成
        </Button>
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex rounded-lg bg-muted/70 p-0.5">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              data-testid={`mobile-review-filter-${item.id}`}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs transition-colors",
                filter === item.id
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <p className="text-xs tabular-nums text-muted-foreground">
          {query.trim() || filter !== "all"
            ? `${visibleCards.length} / ${deck.cards.length} 张`
            : `${deck.cards.length} 张 · 已审 ${reviewedCount}`}
        </p>
      </div>
    </div>
  )

  const mobilePager = (
    <div className="flex items-center gap-2 lg:hidden">
      <div className="grid h-10 min-w-0 flex-1 grid-cols-[2.25rem_1fr_2.25rem] items-center rounded-xl border border-border/70 bg-card p-0.5 shadow-xs">
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
            className="h-8 cursor-grab active:cursor-grabbing [&_[data-slot=slider-range]]:bg-transparent [&_[data-slot=slider-thumb]]:h-4 [&_[data-slot=slider-thumb]]:w-7 [&_[data-slot=slider-thumb]]:border-2 [&_[data-slot=slider-thumb]]:border-card [&_[data-slot=slider-thumb]]:bg-primary [&_[data-slot=slider-thumb]]:shadow-sm [&_[data-slot=slider-track]]:h-1.5 [&_[data-slot=slider-track]]:bg-muted-foreground/20"
            onValueChange={([index]) => {
              if (index !== undefined && index !== selectedIndex) jumpTo(index)
            }}
          />
          <output
            htmlFor="mobile-card-slider"
            aria-live="polite"
            className="min-w-10 whitespace-nowrap text-right text-xs tabular-nums"
          >
            <span className="font-medium text-foreground">{selectedIndex}</span>
            <span className="text-muted-foreground"> / {deck.cards.length}</span>
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
          <DialogTitle>批量生成笔记</DialogTitle>
          <DialogDescription>
            按主题或粘贴词表一次生成多条笔记。与现有首字段相同的不会写入。新笔记插在当前笔记后面。
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <ReferenceNotesBar
            cards={deck.cards}
            fields={editableFields}
            referenceIds={review.referenceIds}
            onChange={(ids) => setReview((state) => ({ ...state, referenceIds: ids }))}
            onOpenPicker={() => setReferencePickerOpen(true)}
          />
          <div className="flex flex-col gap-2">
            <Label htmlFor="batch-topic">主题或词表</Label>
            <Textarea
              id="batch-topic"
              value={batchTopic}
              placeholder="例如：托福高频动词，或每行一个单词"
              className="min-h-28"
              onChange={(event) => setBatchTopic(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="batch-count">数量</Label>
            <Input
              id="batch-count"
              type="number"
              min={1}
              max={50}
              value={batchCount}
              onChange={(event) => setBatchCount(event.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setBatchOpen(false)}>
            取消
          </Button>
          <Button type="button" disabled={isBusy("batch")} onClick={applyBatchAi}>
            {isBusy("batch") ? "生成中" : "生成"}
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
          "flex w-full flex-col justify-center rounded-xl px-3 text-left transition-colors duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
          active ? "bg-primary text-primary-foreground" : "text-foreground/80 hover:bg-muted",
          !active && isReviewed && "opacity-55"
        )}
      >
        <span className="flex items-center gap-2">
          <span
            className={cn(
              "w-8 shrink-0 text-[11px] tabular-nums",
              active ? "text-primary-foreground/70" : "text-muted-foreground"
            )}
          >
            {absolute || index + 1}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm">{cardLabel(card, deck.fields)}</span>
          {isReviewed ? (
            <span className="flex shrink-0 items-center gap-1 text-[10px]" aria-label="已审核">
              <Check className="size-3" aria-hidden="true" />
              已审
            </span>
          ) : null}
        </span>
        <span
          className={cn(
            "line-clamp-1 pl-10 text-[11px]",
            active ? "text-primary-foreground/65" : "text-muted-foreground"
          )}
        >
          {cardSubtitle(card, deck.fields) || " "}
        </span>
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
        "overflow-y-auto overscroll-contain rounded-2xl border border-border/70 bg-card/70",
        listOnly
          ? "min-h-0 flex-1"
          : "h-[min(58vh,520px)] lg:h-[min(calc(100vh-16rem),720px)]"
      )}
    >
      <div className="flex flex-col p-1.5">
        {deck.cards.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">还没有卡片</p>
        ) : visibleCards.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">没有匹配的卡片</p>
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
    <div className={cn("flex min-w-0 flex-col gap-4", listOnly && "h-full min-h-0 flex-1 overflow-hidden")}>
      {listOnly ? null : desktopToolbar}
      {detail ? (
        <Tabs value={editorPane === "preview" ? "preview" : "editor"} className="lg:hidden" onValueChange={(value) => setMobilePane(value as MobilePane)}>
          <TabsList className="grid h-11 w-full grid-cols-2 rounded-xl p-1">
            <TabsTrigger value="editor">编辑</TabsTrigger>
            <TabsTrigger value="preview">预览</TabsTrigger>
          </TabsList>
        </Tabs>
      ) : null}
      {listOnly ? <div className="shrink-0">{mobileListToolbar}</div> : detail ? null : mobilePane === "list" ? mobileListToolbar : mobilePager}
      {listOnly ? listBox : (
      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(200px,260px)_minmax(0,1fr)]">
      <section className={cn(
        "flex-col gap-3",
        detail ? "hidden lg:flex" : cn("lg:flex", mobilePane === "list" ? "flex" : "hidden")
      )}>
        {listBox}
      </section>

      <section
        className={cn(
          "min-h-0 flex-col gap-4",
          detail ? (editorPane === "editor" ? "flex" : "hidden lg:flex") : cn("lg:flex", mobilePane === "editor" ? "flex" : "hidden")
        )}
      >
        {selected ? (
          <>
            <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <p className="shrink-0 text-sm font-medium">编辑卡片</p>
              <div className="flex min-w-0 shrink-0 items-center gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant={isSelectedReviewed ? "outline" : "default"}
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
                  {isSelectedReviewed ? "取消已审核" : "标记为已审核"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!canCompleteSelected || isBusy("card:complete")}
                  title={canCompleteSelected ? undefined : "当前没有需要补全的空字段"}
                  onClick={applyCardCompletion}
                >
                  <Sparkles data-icon="inline-start" />
                  {isBusy("card:complete") ? "补全中" : "AI 补全"}
                </Button>
                <Button type="button" size="sm" variant="destructive" onClick={() => removeCard(selected.id)}>
                  删除
                </Button>
              </div>
            </div>
            <ReferenceNotesBar
              cards={deck.cards}
              fields={editableFields}
              referenceIds={review.referenceIds}
              onChange={(ids) => setReview((state) => ({ ...state, referenceIds: ids }))}
              onOpenPicker={() => setReferencePickerOpen(true)}
            />
            </div>
            <div className="flex flex-col gap-4">
              {deck.fields.map((field) => {
                const tts = fieldTts[field]
                if (tts) {
                  const sourceText = selected.values[tts.source] ?? ""
                  return (
                    <div key={field} className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <Label>{field}</Label>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {ttsLangLabel(tts.lang)} · 来自「{tts.source}」
                            {tts.slow ? " · 慢速" : ""}
                          </p>
                        </div>
                        <TtsPlayButton text={sourceText} lang={tts.lang} slow={tts.slow} />
                      </div>
                      <div className="rounded-xl border border-border/70 bg-muted/50 px-3 py-2 text-sm text-foreground/80">
                        {sourceText.trim() || "源字段为空，导出时跳过"}
                      </div>
                    </div>
                  )
                }
                const fieldNote = notesOf(deck)[field]?.trim() || undefined
                return (
                  <div key={field} className="space-y-2">
                    <Label htmlFor={`field-${field}`}>{field}</Label>
                    {editableFields.indexOf(field) >= 2 ? (
                      <Textarea
                        id={`field-${field}`}
                        value={selected.values[field] ?? ""}
                        placeholder={fieldNote}
                        className="min-h-24 placeholder:text-muted-foreground/65"
                        onChange={(event) => updateCard(selected.id, field, event.target.value)}
                      />
                    ) : (
                      <Input
                        id={`field-${field}`}
                        value={selected.values[field] ?? ""}
                        placeholder={fieldNote}
                        className="placeholder:text-muted-foreground/65"
                        onChange={(event) => updateCard(selected.id, field, event.target.value)}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </>
        ) : (
          <div className="flex h-[360px] items-center justify-center rounded-2xl border border-border/70 bg-card/70 text-sm text-muted-foreground">
            先新建一张卡片
          </div>
        )}
      </section>

      <section className={cn(
        detail ? (editorPane === "preview" ? "block" : "hidden lg:block") : cn("lg:block", mobilePane === "preview" ? "block" : "hidden")
      )}>
        {preview}
      </section>
      </div>
      )}
      {aiDialog}
      {batchDialog}
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
