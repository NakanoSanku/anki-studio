"use client"

import { useEffect, useRef, useState } from "react"

import { requestAuditAi, requestBatchAi, requestCardAi, requestFieldAi, type AiAction } from "@/lib/ai"
import {
  applyAuditResults,
  AUDIT_CHUNK_SIZE,
  AUDIT_MAX_COUNT,
  chunkItems,
  readAuditInstruction,
  selectAuditTargets,
  writeAuditInstruction,
  type AuditScope,
} from "@/lib/audit"
import { idAfterDelete, idAtIndex, insertItemsAfter, moveItemAfter, neighborId } from "@/lib/card-nav"
import { isAbortError } from "@/lib/ai-upstream"
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
  matchesReviewFilter,
  pruneEditorState,
  readEditorState,
  toggleFlagged,
  writeEditorState,
  type EditorState,
  type ReviewFilter,
} from "@/lib/editor-state"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { CardPreview } from "@/components/card-preview"
import { useVirtualWindow } from "@/components/use-virtual-window"
import { cn } from "@/lib/utils"

type EditMode = "form" | "table"

const MODE_KEY = "anki-studio.card-edit-mode"
const LIST_ROW = 56
const TABLE_ROW = 44
const TABLE_HEADER = 36
const FILTERS: { id: ReviewFilter; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "unreviewed", label: "未审" },
  { id: "flagged", label: "标记" },
]

const AUDIT_SCOPES: { id: AuditScope; label: string }[] = [
  { id: "unreviewed", label: "未审" },
  { id: "flagged", label: "标记" },
  { id: "visible", label: "当前筛选" },
  { id: "all", label: "全部" },
]

type AuditProgress = {
  done: number
  total: number
  written: number
  skipped: number
  status: "running" | "done" | "stopped" | "error"
  message: string
}

function readMode(): EditMode {
  if (typeof window === "undefined") return "form"
  return window.localStorage.getItem(MODE_KEY) === "table" ? "table" : "form"
}

type DeckUpdater = Deck | ((current: Deck) => Deck)

type CardEditorProps = {
  deck: Deck
  deckId: string
  selectedId: string | null
  previewSide: "front" | "back"
  onChange: (deck: DeckUpdater) => void
  onSelect: (id: string) => void
  onPreviewSideChange: (side: "front" | "back") => void
}

export function CardEditor({
  deck,
  deckId,
  selectedId,
  previewSide,
  onChange,
  onSelect,
  onPreviewSideChange,
}: CardEditorProps) {
  const [mode, setMode] = useState<EditMode>(readMode)
  const [busyKeys, setBusyKeys] = useState<string[]>([])
  const busyRef = useRef(new Set<string>())
  const deckRef = useRef(deck)
  const pendingDecks = useRef(new Set<Deck>())
  const [alert, setAlert] = useState("")
  const [batchOpen, setBatchOpen] = useState(false)
  const [batchTopic, setBatchTopic] = useState("")
  const [batchCount, setBatchCount] = useState("10")
  const [auditOpen, setAuditOpen] = useState(false)
  const [auditInstruction, setAuditInstruction] = useState(readAuditInstruction)
  const [auditScope, setAuditScope] = useState<AuditScope>("unreviewed")
  const [auditCount, setAuditCount] = useState("20")
  const [auditProgress, setAuditProgress] = useState<AuditProgress | null>(null)
  const auditAbort = useRef<AbortController | null>(null)
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<ReviewFilter>("all")
  const [review, setReview] = useState<EditorState>(() => readEditorState(deckId, deck))
  const [jumpText, setJumpText] = useState("")
  const [jumpFocused, setJumpFocused] = useState(false)
  const selected = deck.cards.find((card) => card.id === selectedId) ?? deck.cards[0]
  const editableFields = textFields(deck)
  const fieldTts = ttsOf(deck)
  const visibleCards = deck.cards.filter(
    (card) => cardMatchesQuery(card, editableFields, query) && matchesReviewFilter(card, review, filter)
  )
  const activeId = selected?.id ?? ""
  const selectedIndex = selected ? deck.cards.findIndex((card) => card.id === selected.id) + 1 : 0
  const reviewedCount = review.reviewed.filter((id) => deck.cards.some((card) => card.id === id)).length
  const isBusy = (task: string) => busyKeys.includes(task)
  const listVirt = useVirtualWindow(visibleCards.length, LIST_ROW, 0, mode === "form")
  const tableVirt = useVirtualWindow(visibleCards.length, TABLE_ROW, TABLE_HEADER, mode === "table")
  const visibleRef = useRef(visibleCards)
  const activeRef = useRef(activeId)
  const addCardRef = useRef<() => void>(() => {})
  const goRef = useRef<(delta: number) => void>(() => {})
  const flagRef = useRef<() => void>(() => {})
  const jumpRef = useRef<(index: number) => void>(() => {})
  visibleRef.current = visibleCards
  activeRef.current = activeId

  useEffect(() => {
    pendingDecks.current.delete(deck)
    if (pendingDecks.current.size > 0 && !pendingDecks.current.has(deck)) return
    deckRef.current = deck
  }, [deck])

  useEffect(() => {
    localStorage.setItem(MODE_KEY, mode)
  }, [mode])

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
    if (mode === "table") tableVirt.scrollToIndex(index)
    else listVirt.scrollToIndex(index)
  }, [activeId, mode, filter, query, listVirt.scrollToIndex, tableVirt.scrollToIndex])

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
    const current = deckRef.current
    const currentSelected = current.cards.find((card) => card.id === activeRef.current) ?? current.cards[0]
    if (currentSelected && isCardEmpty(currentSelected, current.fields)) {
      onSelect(currentSelected.id)
      setQuery("")
      if (filter === "flagged") setFilter("all")
      return
    }
    const empty = current.cards.find((card) => isCardEmpty(card, current.fields))
    if (empty) {
      pushDeck({ ...current, cards: moveItemAfter(current.cards, empty.id, currentSelected?.id) })
      onSelect(empty.id)
      setQuery("")
      if (filter === "flagged") setFilter("all")
      return
    }
    const card = createCard(current.fields)
    pushDeck({ ...current, cards: insertItemsAfter(current.cards, currentSelected?.id, [card]) })
    onSelect(card.id)
    setQuery("")
    if (filter === "flagged") setFilter("all")
  }

  const goVisible = (delta: number) => {
    const list = visibleRef.current
    if (list.length === 0) return
    const currentId = activeRef.current
    if (delta > 0 && currentId) {
      setReview((state) => markReviewed(state, currentId))
    }
    const nextId = neighborId(list, currentId, delta)
    if (nextId) onSelect(nextId)
  }

  const jumpTo = (index1: number) => {
    const id = idAtIndex(deckRef.current.cards, index1)
    if (!id) return
    setFilter("all")
    setQuery("")
    onSelect(id)
  }

  const flagCurrent = () => {
    const id = activeRef.current
    if (!id) return
    setReview((state) => toggleFlagged(state, id))
  }

  addCardRef.current = addCard
  goRef.current = goVisible
  flagRef.current = flagCurrent
  jumpRef.current = jumpTo

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.altKey || event.metaKey || event.ctrlKey) return
      if (event.isComposing) return
      if (batchOpen || auditOpen || alert) return
      const repeating = event.repeat && (event.key === "n" || event.key === "N" || event.key === "m" || event.key === "M")
      if (repeating) return
      switch (event.key) {
        case "ArrowUp":
          event.preventDefault()
          goRef.current(-1)
          break
        case "ArrowDown":
          event.preventDefault()
          goRef.current(1)
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
        case "m":
        case "M":
          event.preventDefault()
          flagRef.current()
          break
        default:
          break
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [alert, auditOpen, batchOpen])

  const updateCard = (id: string, field: string, value: string) => {
    if (fieldTts[field]) return false
    const result = commitChange((current) => setCardField(current, id, field, value))
    if (!result.ok) {
      setAlert(result.error)
      return false
    }
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

  const applyFieldAi = (field: string, action: AiAction) => {
    if (!selected) return
    const cardId = selected.id
    const values = selected.values
    void runAi(`field:${field}:${action}`, async () => {
      const text = await requestFieldAi({
        action,
        field,
        fields: editableFields,
        values,
        notes: notesOf(deck),
      })
      const result = commitChange((current) => setCardField(current, cardId, field, text))
      if (!result.ok) throw new Error(result.error)
    })
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
    const anchorId = selected?.id ?? ""
    void runAi("batch", async () => {
      const generated = await requestBatchAi({
        topic,
        count: Math.floor(count),
        fields,
        existingKeys,
        notes,
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
      if (filter === "flagged") setFilter("all")
    })
  }

  const applyCardAi = (action: AiAction) => {
    if (!selected) return
    const cardId = selected.id
    const values = selected.values
    void runAi(`card:${action}`, async () => {
      const generated = await requestCardAi({
        action,
        fields: editableFields,
        values,
        notes: notesOf(deck),
      })
      const result = commitChange((current) => mergeCardAiValues(current, cardId, generated, action))
      if (!result.ok) throw new Error(result.error)
    })
  }

  const openAudit = () => {
    setAuditInstruction(readAuditInstruction())
    setAuditProgress(null)
    setAuditOpen(true)
  }

  const stopAudit = () => {
    auditAbort.current?.abort()
  }

  const applyAuditAi = () => {
    const instruction = auditInstruction.trim()
    if (!instruction) {
      setAlert("请填写审核说明")
      return
    }
    if (instruction.length > 4000) {
      setAlert("审核说明过长")
      return
    }
    const count = Number(auditCount)
    if (!Number.isFinite(count) || count < 1 || count > AUDIT_MAX_COUNT) {
      setAlert(`本次数需要在 1 到 ${AUDIT_MAX_COUNT} 之间`)
      return
    }
    const current = deckRef.current
    const fields = textFields(current)
    const notes = notesOf(current)
    const targets = selectAuditTargets(current.cards, current.fields, {
      scope: auditScope,
      visibleIds: visibleRef.current.map((card) => card.id),
      review,
      limit: Math.floor(count),
    })
    if (targets.length === 0) {
      setAlert("这个范围内没有可审核的卡片")
      return
    }
    writeAuditInstruction(instruction)
    if (busyRef.current.has("audit")) return
    busyRef.current.add("audit")
    setBusyKeys([...busyRef.current])
    const controller = new AbortController()
    auditAbort.current = controller
    let written = 0
    let skipped = 0
    let done = 0
    const total = targets.length
    setAuditProgress({ done, total, written, skipped, status: "running", message: "审核中" })

    void (async () => {
      try {
        for (const chunk of chunkItems(targets, AUDIT_CHUNK_SIZE)) {
          if (controller.signal.aborted) throw new DOMException("Aborted", "AbortError")
          const snapshot = deckRef.current
          const latest = chunk.map((card) => snapshot.cards.find((item) => item.id === card.id) ?? card)
          const results = await requestAuditAi({
            instruction,
            cards: latest,
            fields,
            notes,
            signal: controller.signal,
          })
          const applied = applyAuditResults(snapshot, latest, results)
          if (applied.deck !== snapshot) pushDeck(applied.deck)
          const reviewedIds = [...applied.applied, ...applied.unchanged]
          if (reviewedIds.length > 0) {
            setReview((state) => reviewedIds.reduce((next, id) => markReviewed(next, id), state))
            const last = reviewedIds[reviewedIds.length - 1]
            if (last) onSelect(last)
          }
          written += applied.applied.length
          skipped += applied.skipped.length
          done += chunk.length
          setAuditProgress({ done, total, written, skipped, status: "running", message: "审核中" })
        }
        setAuditProgress({
          done: total,
          total,
          written,
          skipped,
          status: "done",
          message: `完成，写入 ${written} 张${skipped > 0 ? `，跳过 ${skipped}` : ""}`,
        })
      } catch (error) {
        if (isAbortError(error)) {
          setAuditProgress({
            done,
            total,
            written,
            skipped,
            status: "stopped",
            message: `已停止，写入 ${written} 张`,
          })
          return
        }
        const message = error instanceof Error ? error.message : "审核失败"
        setAuditProgress({
          done,
          total,
          written,
          skipped,
          status: "error",
          message: `已写入 ${written} 张。${message}`,
        })
        setAlert(message)
      } finally {
        busyRef.current.delete("audit")
        setBusyKeys([...busyRef.current])
        if (auditAbort.current === controller) auditAbort.current = null
      }
    })()
  }

  const removeCard = (id: string) => {
    const current = deckRef.current
    const nextId = idAfterDelete(current.cards, id)
    const next = { ...current, cards: current.cards.filter((card) => card.id !== id) }
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

  const flagged = Boolean(selected && review.flagged.includes(selected.id))

  const toolbar = (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            data-testid="prev-card"
            title="上一张（Alt+↑）"
            disabled={visibleCards.length === 0}
            onClick={() => goVisible(-1)}
          >
            上一张
          </Button>
          <form
            className="flex items-center gap-1 text-sm"
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
              className="h-7 w-14 border-black/8 bg-white/70 px-2 text-center"
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
            size="sm"
            variant="outline"
            data-testid="next-card"
            title="下一张（Alt+↓），当前记为已审"
            disabled={visibleCards.length === 0}
            onClick={() => goVisible(1)}
          >
            下一张
          </Button>
          <Button type="button" size="sm" data-testid="insert-after-card" title="在当前卡片后插入（Alt+N）" onClick={addCard}>
            在后面插入
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            data-testid="audit-cards"
            disabled={isBusy("audit")}
            onClick={openAudit}
          >
            {isBusy("audit") ? "审核中" : "批量审核"}
          </Button>
          {mode === "form" ? (
            <Button type="button" size="sm" variant="outline" disabled={isBusy("batch")} onClick={() => setBatchOpen(true)}>
              批量生成
            </Button>
          ) : null}
          <p className="text-xs text-foreground/50">已审 {reviewedCount}</p>
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <Input
            value={query}
            aria-label="搜索卡片"
            placeholder="搜索卡片"
            className="h-8 w-44 border-black/8 bg-white/70 sm:w-56"
            onChange={(event) => setQuery(event.target.value)}
          />
          <Tabs value={mode} onValueChange={(value) => setMode(value as EditMode)}>
            <TabsList>
              <TabsTrigger value="form">单卡</TabsTrigger>
              <TabsTrigger value="table">表格</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg bg-black/4 p-0.5">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              data-testid={`review-filter-${item.id}`}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs transition-colors",
                filter === item.id ? "bg-white text-foreground shadow-sm" : "text-foreground/60 hover:text-foreground"
              )}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-foreground/45">
          {query.trim() || filter !== "all"
            ? `显示 ${visibleCards.length} / ${deck.cards.length}`
            : "Alt+↑/↓ 换卡 · Alt+N 插入 · Alt+M 标记"}
        </p>
      </div>
    </div>
  )

  const preview = (
    <CardPreview
      deck={deck}
      values={selected?.values ?? {}}
      side={previewSide}
      onSideChange={onPreviewSideChange}
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
    <Dialog open={batchOpen} onOpenChange={setBatchOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>批量生成卡片</DialogTitle>
          <DialogDescription>
            按主题或粘贴词表一次生成多张卡片。与现有首字段相同的不会写入。新卡片插在当前卡片后面。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="batch-topic">主题或词表</Label>
            <Textarea
              id="batch-topic"
              value={batchTopic}
              placeholder="例如：托福高频动词，或每行一个单词"
              className="min-h-28"
              onChange={(event) => setBatchTopic(event.target.value)}
            />
          </div>
          <div className="space-y-2">
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

  const auditRunning = isBusy("audit")
  const auditDialog = (
    <Dialog
      open={auditOpen}
      onOpenChange={(open) => {
        if (!open && auditRunning) stopAudit()
        setAuditOpen(open)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>批量审核卡片</DialogTitle>
          <DialogDescription>
            按你的审核说明让 AI 重写卡片。已写入的不会回滚，可随时停止。包装提示词在设置里改。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="audit-instruction">审核说明</Label>
            <Textarea
              id="audit-instruction"
              value={auditInstruction}
              placeholder="例如：例句必须包含该单词；中文释义要简洁"
              className="min-h-32"
              disabled={auditRunning}
              onChange={(event) => setAuditInstruction(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>范围</Label>
            <div className="flex flex-wrap gap-1">
              {AUDIT_SCOPES.map((item) => (
                <Button
                  key={item.id}
                  type="button"
                  size="sm"
                  variant={auditScope === item.id ? "default" : "outline"}
                  disabled={auditRunning}
                  onClick={() => setAuditScope(item.id)}
                >
                  {item.label}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="audit-count">本次数量</Label>
            <Input
              id="audit-count"
              type="number"
              min={1}
              max={AUDIT_MAX_COUNT}
              value={auditCount}
              disabled={auditRunning}
              onChange={(event) => setAuditCount(event.target.value)}
            />
            <p className="text-xs text-foreground/45">一次最多 {AUDIT_MAX_COUNT} 张，每 {AUDIT_CHUNK_SIZE} 张请求一次模型。</p>
          </div>
          {auditProgress ? (
            <p className="text-sm text-foreground/70" data-testid="audit-progress">
              {auditProgress.message}
              {auditProgress.status === "running"
                ? ` ${auditProgress.done}/${auditProgress.total}，写入 ${auditProgress.written}`
                : ""}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          {auditRunning ? (
            <Button type="button" variant="outline" onClick={stopAudit}>
              停止
            </Button>
          ) : (
            <Button type="button" variant="outline" onClick={() => setAuditOpen(false)}>
              关闭
            </Button>
          )}
          <Button type="button" disabled={auditRunning} onClick={applyAuditAi}>
            {auditRunning ? "审核中" : "开始审核"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  const renderListItem = (card: Card, index: number) => {
    const absolute = deck.cards.findIndex((item) => item.id === card.id) + 1
    const active = card.id === selected?.id
    const isReviewed = review.reviewed.includes(card.id)
    const isFlagged = review.flagged.includes(card.id)
    return (
      <button
        id={`card-item-${card.id}`}
        key={card.id}
        type="button"
        onClick={() => onSelect(card.id)}
        style={{ height: LIST_ROW }}
        className={cn(
          "flex w-full flex-col justify-center rounded-xl px-3 text-left transition-colors duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
          active ? "bg-foreground text-background" : "text-foreground/80 hover:bg-black/4",
          !active && isReviewed && "opacity-55"
        )}
      >
        <span className="flex items-center gap-2">
          <span className={cn("w-8 shrink-0 text-[11px] tabular-nums", active ? "text-background/70" : "text-foreground/40")}>
            {absolute || index + 1}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm">{cardLabel(card, deck.fields)}</span>
          {isFlagged ? (
            <span className={cn("text-[10px]", active ? "text-background/80" : "text-foreground/45")}>标</span>
          ) : null}
        </span>
        <span className={cn("line-clamp-1 pl-10 text-[11px]", active ? "text-background/65" : "text-foreground/45")}>
          {cardSubtitle(card, deck.fields) || " "}
        </span>
      </button>
    )
  }

  if (mode === "table") {
    const slice = visibleCards.slice(tableVirt.start, tableVirt.end)
    return (
      <div className="flex min-w-0 flex-col gap-4">
        {toolbar}
        <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
        <section className="flex min-w-0 flex-col gap-3">
          <div className="min-w-0 overflow-hidden rounded-2xl bg-white/70 ring-1 ring-black/6">
            {deck.cards.length === 0 ? (
              <p className="px-3 py-10 text-center text-sm text-muted-foreground">还没有卡片</p>
            ) : visibleCards.length === 0 ? (
              <p className="px-3 py-10 text-center text-sm text-muted-foreground">没有匹配的卡片</p>
            ) : (
              <div ref={tableVirt.ref} className="max-h-[min(64vh,620px)] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="sticky top-0 z-10 w-10 bg-[#f7f4ee] text-center">#</TableHead>
                      {deck.fields.map((field) => (
                        <TableHead key={field} className="sticky top-0 z-10 min-w-36 bg-[#f7f4ee]">
                          {field}
                        </TableHead>
                      ))}
                      <TableHead className="sticky top-0 z-10 w-14 bg-[#f7f4ee]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tableVirt.padTop > 0 ? (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={deck.fields.length + 2} className="border-0 p-0">
                          <div style={{ height: tableVirt.padTop }} />
                        </TableCell>
                      </TableRow>
                    ) : null}
                    {slice.map((card) => {
                      const index = deck.cards.findIndex((item) => item.id === card.id)
                      const active = card.id === selected?.id
                      return (
                        <TableRow
                          id={`card-row-${card.id}`}
                          key={card.id}
                          data-state={active ? "selected" : undefined}
                          className={cn(
                            "cursor-pointer",
                            active && "bg-foreground/5 hover:bg-foreground/5"
                          )}
                          onClick={() => onSelect(card.id)}
                        >
                          <TableCell className="text-center text-xs text-muted-foreground">
                            {index + 1}
                          </TableCell>
                          {deck.fields.map((field) => {
                            const tts = fieldTts[field]
                            if (tts) {
                              const sourceText = card.values[tts.source] ?? ""
                              return (
                                <TableCell key={field} className="whitespace-normal">
                                  <div className="flex min-w-32 items-center gap-2">
                                    <p className="min-w-0 flex-1 truncate text-xs text-foreground/55">
                                      {sourceText.trim() || "源字段为空"}
                                    </p>
                                    <TtsPlayButton text={sourceText} lang={tts.lang} slow={tts.slow} />
                                  </div>
                                </TableCell>
                              )
                            }
                            return (
                            <TableCell key={field} className="whitespace-normal">
                              <Input
                                value={card.values[field] ?? ""}
                                aria-label={`${field} 第 ${index + 1} 行`}
                                className="h-8 min-w-32 border-black/6 bg-white/80"
                                onFocus={() => onSelect(card.id)}
                                onChange={(event) => updateCard(card.id, field, event.target.value)}
                              />
                            </TableCell>
                            )
                          })}
                          <TableCell>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              aria-label={`删除第 ${index + 1} 张卡片`}
                              onClick={(event) => {
                                event.stopPropagation()
                                removeCard(card.id)
                              }}
                            >
                              删除
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                    {tableVirt.padBottom > 0 ? (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={deck.fields.length + 2} className="border-0 p-0">
                          <div style={{ height: tableVirt.padBottom }} />
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </section>
        {preview}
        </div>
        {aiDialog}
        {batchDialog}
        {auditDialog}
      </div>
    )
  }

  const listSlice = visibleCards.slice(listVirt.start, listVirt.end)

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {toolbar}
      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(200px,260px)_minmax(0,1fr)_minmax(280px,0.9fr)]">
      <section className="flex flex-col gap-3">
        <div
          ref={listVirt.ref}
          className="h-56 overflow-auto rounded-2xl bg-white/70 ring-1 ring-black/6 lg:h-[min(calc(100vh-16rem),720px)]"
        >
          <div className="flex flex-col p-1.5">
            {deck.cards.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">还没有卡片</p>
            ) : visibleCards.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">没有匹配的卡片</p>
            ) : (
              <>
                {listVirt.padTop > 0 ? <div style={{ height: listVirt.padTop }} /> : null}
                {listSlice.map((card, offset) => renderListItem(card, listVirt.start + offset))}
                {listVirt.padBottom > 0 ? <div style={{ height: listVirt.padBottom }} /> : null}
              </>
            )}
          </div>
        </div>
      </section>

      <section className="flex min-h-0 flex-col gap-4">
        {selected ? (
          <>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium">编辑卡片</p>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant={flagged ? "secondary" : "outline"}
                  title="标记后可在「标记」里回头看（Alt+M）"
                  onClick={flagCurrent}
                >
                  {flagged ? "已标记" : "标记"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isBusy("card:complete")}
                  onClick={() => applyCardAi("complete")}
                >
                  {isBusy("card:complete") ? "补全中" : "补全"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isBusy("card:rewrite") || !selected.values[deck.fields[0]]?.trim()}
                  onClick={() => applyCardAi("rewrite")}
                >
                  {isBusy("card:rewrite") ? "重写中" : "重写"}
                </Button>
                <Button type="button" size="sm" variant="destructive" onClick={() => removeCard(selected.id)}>
                  删除
                </Button>
              </div>
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
                          <p className="mt-0.5 text-xs text-foreground/45">
                            {ttsLangLabel(tts.lang)} · 来自「{tts.source}」
                            {tts.slow ? " · 慢速" : ""}
                          </p>
                        </div>
                        <TtsPlayButton text={sourceText} lang={tts.lang} slow={tts.slow} />
                      </div>
                      <div className="rounded-xl bg-white/70 px-3 py-2 text-sm text-foreground/70 ring-1 ring-black/6">
                        {sourceText.trim() || "源字段为空，导出时跳过"}
                      </div>
                    </div>
                  )
                }
                return (
                <div key={field} className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <Label htmlFor={`field-${field}`}>{field}</Label>
                      {notesOf(deck)[field]?.trim() ? (
                        <p className="mt-0.5 text-xs text-foreground/45">{notesOf(deck)[field]}</p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        size="xs"
                        variant="ghost"
                        disabled={isBusy(`field:${field}:complete`)}
                        onClick={() => applyFieldAi(field, "complete")}
                      >
                        {isBusy(`field:${field}:complete`) ? "补全中" : "补全"}
                      </Button>
                      <Button
                        type="button"
                        size="xs"
                        variant="ghost"
                        disabled={isBusy(`field:${field}:rewrite`) || !selected.values[field]?.trim()}
                        onClick={() => applyFieldAi(field, "rewrite")}
                      >
                        {isBusy(`field:${field}:rewrite`) ? "重写中" : "重写"}
                      </Button>
                    </div>
                  </div>
                  {editableFields.indexOf(field) >= 2 ? (
                    <Textarea
                      id={`field-${field}`}
                      value={selected.values[field] ?? ""}
                      className="min-h-24"
                      onChange={(event) => updateCard(selected.id, field, event.target.value)}
                    />
                  ) : (
                    <Input
                      id={`field-${field}`}
                      value={selected.values[field] ?? ""}
                      onChange={(event) => updateCard(selected.id, field, event.target.value)}
                    />
                  )}
                </div>
                )
              })}
            </div>
          </>
        ) : (
          <div className="flex h-[360px] items-center justify-center rounded-2xl bg-white/70 text-sm text-muted-foreground ring-1 ring-black/6">
            先新建一张卡片
          </div>
        )}
      </section>

      {preview}
      </div>
      {aiDialog}
      {batchDialog}
      {auditDialog}
    </div>
  )
}
