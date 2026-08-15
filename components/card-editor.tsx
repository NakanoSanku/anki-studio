"use client"

import { useEffect, useState } from "react"

import { requestBatchAi, requestCardAi, requestFieldAi, type AiAction } from "@/lib/ai"
import {
  appendUniqueCards,
  cardLabel,
  cardMatchesQuery,
  createCard,
  findDuplicateCard,
  isCardEmpty,
  notesOf,
  textFields,
  ttsLangLabel,
  ttsOf,
  type Deck,
} from "@/lib/deck"
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
import { ScrollArea } from "@/components/ui/scroll-area"
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
import { cn } from "@/lib/utils"

type EditMode = "form" | "table"

const MODE_KEY = "anki-studio.card-edit-mode"

function readMode(): EditMode {
  if (typeof window === "undefined") return "form"
  return window.localStorage.getItem(MODE_KEY) === "table" ? "table" : "form"
}

type CardEditorProps = {
  deck: Deck
  selectedId: string | null
  previewSide: "front" | "back"
  onChange: (deck: Deck) => void
  onSelect: (id: string) => void
  onPreviewSideChange: (side: "front" | "back") => void
}

export function CardEditor({
  deck,
  selectedId,
  previewSide,
  onChange,
  onSelect,
  onPreviewSideChange,
}: CardEditorProps) {
  const [mode, setMode] = useState<EditMode>(readMode)
  const [busyKey, setBusyKey] = useState("")
  const [alert, setAlert] = useState("")
  const [batchOpen, setBatchOpen] = useState(false)
  const [batchTopic, setBatchTopic] = useState("")
  const [batchCount, setBatchCount] = useState("10")
  const [query, setQuery] = useState("")
  const selected = deck.cards.find((card) => card.id === selectedId) ?? deck.cards[0]
  const editableFields = textFields(deck)
  const fieldTts = ttsOf(deck)
  const visibleCards = deck.cards.filter((card) => cardMatchesQuery(card, editableFields, query))
  const activeId = selected?.id ?? ""
  const selectedIndex = selected ? deck.cards.findIndex((card) => card.id === selected.id) + 1 : 0

  useEffect(() => {
    localStorage.setItem(MODE_KEY, mode)
  }, [mode])

  useEffect(() => {
    if (!activeId) return
    const id = mode === "table" ? `card-row-${activeId}` : `card-item-${activeId}`
    document.getElementById(id)?.scrollIntoView({ block: "nearest" })
  }, [activeId, mode])

  const addCard = () => {
    const existing = deck.cards.find((card) => isCardEmpty(card, deck.fields))
    if (existing) {
      onChange({
        ...deck,
        cards: [...deck.cards.filter((card) => card.id !== existing.id), existing],
      })
      onSelect(existing.id)
      return
    }
    const card = createCard(deck.fields)
    onChange({ ...deck, cards: [...deck.cards, card] })
    onSelect(card.id)
    setQuery("")
  }

  const updateCard = (id: string, field: string, value: string) => {
    if (fieldTts[field]) return false
    if (field === deck.fields[0]) {
      const duplicate = findDuplicateCard(deck.cards, deck.fields, value, id)
      if (duplicate) {
        setAlert(`已存在卡片「${value.trim()}」`)
        return false
      }
    }
    onChange({
      ...deck,
      cards: deck.cards.map((card) =>
        card.id === id ? { ...card, values: { ...card.values, [field]: value } } : card
      ),
    })
    return true
  }

  const runAi = async (task: string, work: () => Promise<void>) => {
    if (busyKey) return
    setBusyKey(task)
    try {
      await work()
    } catch (error) {
      setAlert(error instanceof Error ? error.message : "AI 调用失败")
    } finally {
      setBusyKey("")
    }
  }

  const applyFieldAi = (field: string, action: AiAction) => {
    if (!selected) return
    void runAi(`field:${field}:${action}`, async () => {
      const text = await requestFieldAi({
        action,
        field,
        fields: editableFields,
        values: selected.values,
        notes: notesOf(deck),
      })
      if (!updateCard(selected.id, field, text)) {
        throw new Error(`已存在卡片「${text.trim()}」`)
      }
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
    void runAi("batch", async () => {
      const keyField = deck.fields[0]
      const existingKeys = deck.cards
        .map((card) => (keyField ? card.values[keyField] ?? "" : ""))
        .map((value) => value.trim())
        .filter(Boolean)
      const generated = await requestBatchAi({
        topic: batchTopic.trim(),
        count: Math.floor(count),
        fields: editableFields,
        existingKeys,
        notes: notesOf(deck),
      })
      const incoming = generated.map((values) => createCard(deck.fields, values))
      const nextCards = appendUniqueCards(deck.cards, deck.fields, incoming, deck.fields)
      const added = nextCards.length - deck.cards.length
      if (added === 0) {
        throw new Error("生成的卡片都与现有首字段重复，没有写入")
      }
      onChange({ ...deck, cards: nextCards })
      const last = nextCards[nextCards.length - 1]
      if (last) onSelect(last.id)
      setBatchOpen(false)
      setBatchTopic("")
      setQuery("")
    })
  }

  const applyCardAi = (action: AiAction) => {
    if (!selected) return
    void runAi(`card:${action}`, async () => {
      const values = await requestCardAi({
        action,
        fields: editableFields,
        values: selected.values,
        notes: notesOf(deck),
      })
      const key = deck.fields[0]
      if (key) {
        const duplicate = findDuplicateCard(deck.cards, deck.fields, values[key] ?? "", selected.id)
        if (duplicate) {
          throw new Error(`已存在卡片「${(values[key] ?? "").trim()}」`)
        }
      }
      onChange({
        ...deck,
        cards: deck.cards.map((card) => {
          if (card.id !== selected.id) return card
          const next = { ...card.values }
          for (const field of editableFields) {
            if (typeof values[field] === "string") next[field] = values[field]
          }
          return { ...card, values: next }
        }),
      })
    })
  }

  const removeCard = (id: string) => {
    const next = deck.cards.filter((card) => card.id !== id)
    onChange({ ...deck, cards: next })
    if (selectedId === id) {
      onSelect(next[0]?.id ?? "")
    }
  }

  const toolbar = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <p className="text-sm font-medium">
          {deck.cards.length === 0
            ? "卡片 0"
            : query.trim()
              ? `匹配 ${visibleCards.length} / ${deck.cards.length}`
              : `卡片 ${selectedIndex} / ${deck.cards.length}`}
        </p>
        <Button type="button" size="sm" onClick={addCard}>
          新建
        </Button>
        {mode === "form" ? (
          <Button type="button" size="sm" variant="outline" disabled={Boolean(busyKey)} onClick={() => setBatchOpen(true)}>
            批量生成
          </Button>
        ) : null}
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
            按主题或粘贴词表一次生成多张卡片。与现有首字段相同的不会写入。
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
          <Button type="button" disabled={Boolean(busyKey)} onClick={applyBatchAi}>
            {busyKey === "batch" ? "生成中" : "生成"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  if (mode === "table") {
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
              <div className="max-h-[min(64vh,620px)] overflow-auto">
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
                    {visibleCards.map((card) => {
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
      </div>
    )
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {toolbar}
      <div className="grid min-w-0 gap-6 lg:grid-cols-[220px_minmax(0,1fr)_minmax(280px,0.9fr)]">
      <section className="flex flex-col gap-3">
        <ScrollArea className="h-44 lg:h-[360px] rounded-2xl bg-white/70 ring-1 ring-black/6">
          <div className="flex flex-col p-1.5">
            {deck.cards.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">还没有卡片</p>
            ) : visibleCards.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">没有匹配的卡片</p>
            ) : (
              visibleCards.map((card) => (
                <button
                  id={`card-item-${card.id}`}
                  key={card.id}
                  type="button"
                  onClick={() => onSelect(card.id)}
                  className={cn(
                    "rounded-xl px-3 py-2 text-left text-sm transition-colors duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
                    card.id === selected?.id
                      ? "bg-foreground text-background"
                      : "text-foreground/80 hover:bg-black/4"
                  )}
                >
                  <span className="line-clamp-1">{cardLabel(card, deck.fields)}</span>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
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
                  variant="outline"
                  disabled={Boolean(busyKey)}
                  onClick={() => applyCardAi("complete")}
                >
                  {busyKey === "card:complete" ? "补全中" : "补全"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={Boolean(busyKey) || !selected.values[deck.fields[0]]?.trim()}
                  onClick={() => applyCardAi("rewrite")}
                >
                  {busyKey === "card:rewrite" ? "重写中" : "重写"}
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
                        disabled={Boolean(busyKey)}
                        onClick={() => applyFieldAi(field, "complete")}
                      >
                        {busyKey === `field:${field}:complete` ? "补全中" : "补全"}
                      </Button>
                      <Button
                        type="button"
                        size="xs"
                        variant="ghost"
                        disabled={Boolean(busyKey) || !selected.values[field]?.trim()}
                        onClick={() => applyFieldAi(field, "rewrite")}
                      >
                        {busyKey === `field:${field}:rewrite` ? "重写中" : "重写"}
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
    </div>
  )
}
