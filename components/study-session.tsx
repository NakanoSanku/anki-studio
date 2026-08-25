"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  CheckCircle2,
  Pencil,
  RotateCcw,
  X,
} from "lucide-react"

import { TtsPlayButton } from "@/components/tts-play-button"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { notesOf, previewValues, setCardField, textFields, ttsLangLabel, ttsOf, type Deck } from "@/lib/deck"
import {
  Rating,
  formatDueDate,
  getStudyQueue,
  getStudyStats,
  previewRatingOptions,
  reviewStudyItem,
  type StudyItem,
} from "@/lib/fsrs"
import { previewDocument, renderCard } from "@/lib/template"
import { ttsFieldsOnSide } from "@/lib/tts"
import { cn } from "@/lib/utils"

type StudySessionProps = {
  deck: Deck
  onChange: (deck: Deck) => void
  onExit: () => void
}

const ratingStyle = {
  [Rating.Again]:
    "border-rose-200/90 bg-rose-50/80 text-rose-700 hover:border-rose-300 hover:bg-rose-100/80 focus-visible:border-rose-400 focus-visible:ring-rose-200/70 dark:border-rose-900/75 dark:bg-rose-950/35 dark:text-rose-300 dark:hover:border-rose-800 dark:hover:bg-rose-950/55 dark:focus-visible:border-rose-700 dark:focus-visible:ring-rose-900/70",
  [Rating.Hard]:
    "border-amber-200/90 bg-amber-50/80 text-amber-800 hover:border-amber-300 hover:bg-amber-100/80 focus-visible:border-amber-400 focus-visible:ring-amber-200/70 dark:border-amber-900/75 dark:bg-amber-950/35 dark:text-amber-300 dark:hover:border-amber-800 dark:hover:bg-amber-950/55 dark:focus-visible:border-amber-700 dark:focus-visible:ring-amber-900/70",
  [Rating.Good]:
    "border-blue-200/90 bg-blue-50/80 text-blue-700 hover:border-blue-300 hover:bg-blue-100/80 focus-visible:border-blue-400 focus-visible:ring-blue-200/70 dark:border-blue-900/75 dark:bg-blue-950/35 dark:text-blue-300 dark:hover:border-blue-800 dark:hover:bg-blue-950/55 dark:focus-visible:border-blue-700 dark:focus-visible:ring-blue-900/70",
  [Rating.Easy]:
    "border-emerald-200/90 bg-emerald-50/80 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-100/80 focus-visible:border-emerald-400 focus-visible:ring-emerald-200/70 dark:border-emerald-900/75 dark:bg-emerald-950/35 dark:text-emerald-300 dark:hover:border-emerald-800 dark:hover:bg-emerald-950/55 dark:focus-visible:border-emerald-700 dark:focus-visible:ring-emerald-900/70",
} as const

type ScreenWakeLockSentinel = {
  release: () => Promise<void>
}

type NavigatorWithWakeLock = Navigator & {
  wakeLock?: {
    request: (type: "screen") => Promise<ScreenWakeLockSentinel>
  }
}

function useScreenWakeLock(active: boolean) {
  useEffect(() => {
    if (!active) return

    let disposed = false
    let sentinel: ScreenWakeLockSentinel | null = null

    const acquire = async () => {
      const wakeLock = (navigator as NavigatorWithWakeLock).wakeLock
      if (!wakeLock || document.visibilityState !== "visible" || sentinel) return
      try {
        const next = await wakeLock.request("screen")
        if (disposed) {
          void next.release().catch(() => undefined)
          return
        }
        sentinel = next
      } catch {
        sentinel = null
      }
    }

    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") return
      sentinel = null
      void acquire()
    }

    void acquire()
    document.addEventListener("visibilitychange", onVisibilityChange)
    return () => {
      disposed = true
      document.removeEventListener("visibilitychange", onVisibilityChange)
      void sentinel?.release().catch(() => undefined)
    }
  }, [active])
}

function touchFeedback(pattern: number | number[]) {
  if ("vibrate" in navigator) navigator.vibrate(pattern)
}

function StudyCard({ deck, item, revealed }: { deck: Deck; item: StudyItem; revealed: boolean }) {
  const values = previewValues(deck, item.note.values)
  const rendered = renderCard(item.template.front, item.template.back, values)
  return (
    <iframe
      title={revealed ? "卡片背面" : "卡片正面"}
      sandbox=""
      srcDoc={previewDocument(deck.css, revealed ? rendered.back : rendered.front)}
      className="h-full w-full border-0 bg-white"
    />
  )
}

function FocusHeader({
  completed,
  total,
  progress,
  onExit,
  onEdit,
}: {
  completed: number
  total: number
  progress: number
  onExit: () => void
  onEdit: () => void
}) {
  return (
    <header className="relative z-20 shrink-0 border-b border-border/65 bg-background/92 pt-[env(safe-area-inset-top)]">
      <div className="grid min-h-14 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 sm:min-h-16 sm:px-5">
        <Button type="button" size="icon-sm" variant="ghost" aria-label="退出学习" onClick={onExit}>
          <X className="size-4" />
        </Button>

        <div className="flex min-w-0 items-center gap-3">
          <Progress value={progress} aria-label={`本轮已完成 ${completed}，共 ${total} 张`} />
          <span className="w-14 shrink-0 text-right font-mono text-xs text-muted-foreground">
            {completed} / {total}
          </span>
        </div>

        <Button type="button" size="icon-sm" variant="ghost" aria-label="改这条笔记" onClick={onEdit}>
          <Pencil className="size-4" />
        </Button>
      </div>
    </header>
  )
}

function RatingDock({
  revealed,
  options,
  onReveal,
  onRate,
}: {
  revealed: boolean
  options: ReturnType<typeof previewRatingOptions>
  onReveal: () => void
  onRate: (rating: (typeof options)[number]["rating"]) => void
}) {
  return (
    <div className="relative z-20 shrink-0 border-t border-border/70 bg-background/94 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5 sm:py-4 lg:px-7">
      <div className="mx-auto h-16 w-full max-w-5xl sm:h-18">
        {!revealed ? (
          <Button
            className="h-full w-full text-sm sm:text-base"
            aria-keyshortcuts="Space"
            onClick={onReveal}
          >
            显示答案
            <kbd className="ml-auto hidden rounded-md border border-primary-foreground/25 bg-primary-foreground/10 px-2 py-0.5 font-mono text-[10px] font-normal sm:inline">
              Space
            </kbd>
          </Button>
        ) : (
          <div className="grid h-full grid-cols-4 gap-1.5 sm:gap-2.5" aria-label="选择本次记忆难度">
            {options.map((option, index) => (
              <Button
                key={option.rating}
                variant="outline"
                className={cn(
                  "h-full min-h-0 flex-col gap-1 rounded-xl px-1 py-2 sm:py-2.5",
                  ratingStyle[option.rating]
                )}
                aria-label={`${option.label}，下次复习间隔 ${option.interval}，快捷键 ${index + 1}`}
                aria-keyshortcuts={`${index + 1}`}
                onClick={() => onRate(option.rating)}
              >
                <span className="flex items-center gap-1.5 text-xs font-semibold sm:text-sm">
                  <kbd className="hidden size-5 items-center justify-center rounded border border-current/20 font-mono text-[10px] font-normal opacity-70 sm:flex">
                    {index + 1}
                  </kbd>
                  {option.label}
                </span>
                <span className="max-w-full truncate font-mono text-[10px] font-normal opacity-70 sm:text-[11px]">
                  {option.interval}
                </span>
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function StudySession({
  deck,
  onChange,
  onExit,
}: StudySessionProps) {
  const [revealed, setRevealed] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editValues, setEditValues] = useState<Record<string, string>>({})
  const [editError, setEditError] = useState("")
  const [clock, setClock] = useState(() => Date.now())
  const [completed, setCompleted] = useState(0)
  const [initialCount] = useState(() => getStudyQueue(deck, new Date()).length)
  const now = useMemo(() => new Date(clock), [clock])
  const queue = useMemo(() => getStudyQueue(deck, now), [deck, now])
  const stats = useMemo(() => getStudyStats(deck, now), [deck, now])
  const current = queue[0]
  const options = useMemo(
    () => (current ? previewRatingOptions(deck, current, now) : []),
    [current, deck, now]
  )

  useScreenWakeLock(Boolean(current))

  const reveal = useCallback(() => {
    setRevealed(true)
    touchFeedback(8)
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  const rate = useCallback(
    (rating: (typeof options)[number]["rating"]) => {
      if (!current || !revealed) return
      onChange(reviewStudyItem(deck, current, rating, new Date()))
      touchFeedback([8, 24, 8])
      setCompleted((value) => value + 1)
      setRevealed(false)
      setClock(Date.now())
    },
    [current, deck, onChange, revealed]
  )

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest("input, textarea, select, [contenteditable=true], .cm-editor")) return
      if (document.querySelector('[role="dialog"]')) return
      if (event.key === "Escape") {
        event.preventDefault()
        onExit()
        return
      }
      if (event.code === "Space" && current && !revealed) {
        event.preventDefault()
        reveal()
        return
      }
      if (!revealed) return
      const option = options[Number(event.key) - 1]
      if (option) rate(option.rating)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [current, onExit, options, rate, reveal, revealed])

  const total = Math.max(initialCount, completed + queue.length)
  const progress = total > 0 ? Math.min(100, (completed / total) * 100) : 100

  if (!current) {
    const dailyLimitReached = stats.dueNow > 0
    const completionDescription = dailyLimitReached
      ? "今天可以学习的卡片已经全部完成。"
      : stats.nextDue
        ? `下一张将在 ${formatDueDate(stats.nextDue, now)} 到期。`
        : "暂无计划中的复习。"

    return (
      <section
        className="flex h-[100dvh] items-center justify-center overflow-y-auto overscroll-none bg-background px-4 py-8 sm:px-8"
        aria-labelledby="study-complete-title"
      >
        <div className="flex w-full max-w-md flex-col items-center text-center">
          <span className="flex size-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            <CheckCircle2 className="size-8" />
          </span>
          <h2 id="study-complete-title" className="mt-6 text-2xl font-semibold tracking-tight sm:text-3xl">
            {completed > 0 ? `本轮完成 ${completed} 张` : "当前没有待学习卡片"}
          </h2>
          <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
            {completionDescription}
          </p>
          <Button size="lg" className="mt-8 h-12 w-full max-w-xs" onClick={onExit}>
            返回学习
          </Button>
        </div>
      </section>
    )
  }

  const side = revealed ? "back" : "front"
  const playable = ttsFieldsOnSide(deck, side, current.template.id)
  const configs = ttsOf(deck)

  return (
    <section className="flex h-[100dvh] flex-col overflow-hidden overscroll-none bg-background" aria-label="学习会话">
      <FocusHeader
        completed={completed}
        total={total}
        progress={progress}
        onExit={onExit}
        onEdit={() => {
          setEditValues({ ...current.note.values })
          setEditError("")
          setEditOpen(true)
        }}
      />

      <div
        key={current.id}
        className="relative min-h-0 flex-1 overflow-hidden bg-white motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-300"
      >
        <div
          key={side}
          className="h-full w-full motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200"
        >
          <StudyCard deck={deck} item={current} revealed={revealed} />
        </div>

        {!revealed ? (
          <button
            type="button"
            className="absolute inset-0 z-10 cursor-pointer focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30 focus-visible:ring-inset"
            onClick={reveal}
            aria-label="显示答案"
            aria-keyshortcuts="Space"
          />
        ) : null}

        <div className="pointer-events-none absolute inset-x-3 bottom-3 z-20 flex items-end justify-between gap-3 sm:inset-x-5 sm:bottom-5">
          <div className="pointer-events-auto flex max-w-[65%] flex-wrap gap-1.5">
            {playable.map((name) => {
              const tts = configs[name]
              if (!tts) return null
              return (
                <Tooltip key={name}>
                  <TooltipTrigger asChild>
                    <div>
                      <TtsPlayButton
                        iconOnly
                        text={current.note.values[tts.source] ?? ""}
                        lang={tts.lang}
                        slow={tts.slow}
                        label={`播放 ${name} · ${ttsLangLabel(tts.lang)}`}
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>{name} · {ttsLangLabel(tts.lang)}</TooltipContent>
                </Tooltip>
              )
            })}
          </div>

          {revealed ? (
            <div className="pointer-events-auto flex gap-1 rounded-xl border border-black/10 bg-white/92 p-1 text-stone-700 shadow-sm backdrop-blur">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    className="text-stone-700 hover:bg-stone-100"
                    aria-label="重看正面"
                    onClick={() => setRevealed(false)}
                  >
                    <RotateCcw className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>重看正面</TooltipContent>
              </Tooltip>
            </div>
          ) : null}
        </div>
      </div>

      <RatingDock
        revealed={revealed}
        options={options}
        onReveal={reveal}
        onRate={rate}
      />

      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent side="bottom" className="max-h-[85dvh] rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]">
          <SheetHeader>
            <SheetTitle>改这条笔记</SheetTitle>
            <SheetDescription>保存后回到当前卡片。</SheetDescription>
          </SheetHeader>
          <div className="flex max-h-[50dvh] flex-col gap-4 overflow-y-auto px-4">
            {textFields(deck).map((field) => {
              const note = notesOf(deck)[field]?.trim()
              const long = textFields(deck).indexOf(field) >= 2
              return (
                <div key={field} className="space-y-2">
                  <Label htmlFor={`study-edit-${field}`}>{field}</Label>
                  {long ? (
                    <Textarea
                      id={`study-edit-${field}`}
                      value={editValues[field] ?? ""}
                      placeholder={note}
                      className="min-h-24"
                      onChange={(event) => setEditValues((current) => ({ ...current, [field]: event.target.value }))}
                    />
                  ) : (
                    <Input
                      id={`study-edit-${field}`}
                      value={editValues[field] ?? ""}
                      placeholder={note}
                      onChange={(event) => setEditValues((current) => ({ ...current, [field]: event.target.value }))}
                    />
                  )}
                </div>
              )
            })}
            {editError ? <p className="text-sm text-destructive">{editError}</p> : null}
          </div>
          <SheetFooter>
            <Button
              type="button"
              onClick={() => {
                let next = deck
                for (const field of textFields(deck)) {
                  const result = setCardField(next, current.note.id, field, editValues[field] ?? "")
                  if (!result.ok) {
                    setEditError(result.error)
                    return
                  }
                  next = result.deck
                }
                onChange(next)
                setEditOpen(false)
              }}
            >
              保存
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </section>
  )
}
