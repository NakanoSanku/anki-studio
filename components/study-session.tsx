"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  BarChart3,
  CheckCircle2,
  Flame,
  Gauge,
  Maximize2,
  Minimize2,
  Pencil,
  RotateCcw,
  Sparkles,
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
  SheetTrigger,
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
  type StudyStats,
} from "@/lib/fsrs"
import { previewDocument, renderCard } from "@/lib/template"
import { ttsFieldsOnSide } from "@/lib/tts"
import { cn } from "@/lib/utils"

type StudySessionProps = {
  deck: Deck
  onChange: (deck: Deck) => void
  onExit: () => void
  immersive: boolean
  onImmersiveChange: (immersive: boolean) => void
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

function SessionStat({ label, value, hint }: { label: string; value: string | number; hint: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-muted/25 p-3.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{hint}</p>
    </div>
  )
}

function SessionDetails({
  completed,
  total,
  progress,
  stats,
  now,
}: {
  completed: number
  total: number
  progress: number
  stats: StudyStats
  now: Date
}) {
  return (
    <Sheet>
      <Tooltip>
        <TooltipTrigger asChild>
          <SheetTrigger asChild>
            <Button type="button" size="icon-sm" variant="ghost" aria-label="查看本轮详情">
              <BarChart3 className="size-4" />
            </Button>
          </SheetTrigger>
        </TooltipTrigger>
        <TooltipContent>本轮详情</TooltipContent>
      </Tooltip>
      <SheetContent className="gap-0 data-[side=right]:w-[min(92vw,24rem)] sm:max-w-sm">
        <SheetHeader className="border-b border-border/70 px-5 py-5">
          <SheetTitle>本轮学习</SheetTitle>
          <SheetDescription>FSRS 会根据每次真实感受安排下一次复习。</SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-6">
          <section aria-labelledby="session-progress-title">
            <div className="flex items-center justify-between gap-3">
              <h2 id="session-progress-title" className="text-sm font-medium">本轮进度</h2>
              <span className="font-mono text-xs text-muted-foreground">{completed} / {total}</span>
            </div>
            <Progress className="mt-3 h-1.5" value={progress} />
          </section>

          <div className="grid grid-cols-2 gap-3">
            <SessionStat label="现在到期" value={stats.dueNow} hint="可立即复习" />
            <SessionStat label="仍是新卡" value={stats.newCount} hint="受每日上限控制" />
            <SessionStat label="今日已复习" value={stats.reviewedToday} hint="今天的评分次数" />
            <SessionStat label="连续学习" value={`${stats.streak} 天`} hint="保持稳定节奏" />
          </div>

          <div className="rounded-xl border border-border/70 p-4">
            <div className="flex items-start gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Sparkles className="size-4" />
              </span>
              <div>
                <p className="text-sm font-medium">下一张到期</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {stats.nextDue ? formatDueDate(stats.nextDue, now) : "完成评分后由 FSRS 自动安排"}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3 border-t border-border/70 pt-5 text-xs leading-5 text-muted-foreground">
            <p className="flex items-start gap-2">
              <Gauge className="mt-0.5 size-4 shrink-0" />
              先回忆，再显示答案；按真实难度评分，而不只是判断对错。
            </p>
            <p className="flex items-start gap-2">
              <Flame className="mt-0.5 size-4 shrink-0" />
              键盘按 Space 显示答案，答案出现后按 1–4 完成评分。
            </p>
            <p className="flex items-start gap-2">
              <Maximize2 className="mt-0.5 size-4 shrink-0" />
              按 F 进入沉浸模式；支持时会全屏并在学习期间保持屏幕唤醒。
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function FocusHeader({
  completed,
  total,
  progress,
  stats,
  now,
  onExit,
  onEdit,
  immersive,
  onToggleImmersive,
}: {
  completed: number
  total: number
  progress: number
  stats: StudyStats
  now: Date
  onExit: () => void
  onEdit: () => void
  immersive: boolean
  onToggleImmersive: () => void
}) {
  return (
    <header
      className={cn(
        "relative z-20 shrink-0 border-b border-border/65 bg-background/92 pt-[env(safe-area-inset-top)]",
        immersive && "border-transparent bg-background/72"
      )}
    >
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

        <div className="flex items-center justify-end gap-1">
          <Button type="button" size="sm" variant="ghost" aria-label="改这条笔记" onClick={onEdit}>
            <Pencil className="size-4" />
            改
          </Button>
          <SessionDetails
            completed={completed}
            total={total}
            progress={progress}
            stats={stats}
            now={now}
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label={immersive ? "退出全屏" : "全屏"}
                aria-pressed={immersive}
                onClick={onToggleImmersive}
              >
                {immersive ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{immersive ? "退出全屏" : "全屏"}</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="flex items-center gap-3 px-4 pb-3 sm:hidden">
        <Progress value={progress} aria-label={`本轮已完成 ${completed}，共 ${total} 张`} />
        <span className="w-12 shrink-0 text-right font-mono text-[11px] text-muted-foreground">
          {completed} / {total}
        </span>
      </div>
    </header>
  )
}

function RatingDock({
  revealed,
  options,
  immersive,
  onReveal,
  onRate,
}: {
  revealed: boolean
  options: ReturnType<typeof previewRatingOptions>
  immersive: boolean
  onReveal: () => void
  onRate: (rating: (typeof options)[number]["rating"]) => void
}) {
  return (
    <div
      className={cn(
        "relative z-20 shrink-0 border-t border-border/70 bg-background/94 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-18px_42px_-38px_rgba(28,25,23,0.8)] backdrop-blur-xl transition-colors duration-300 sm:px-5 sm:py-4 lg:px-7 motion-reduce:transition-none",
        immersive && "border-transparent bg-background/78 shadow-none"
      )}
    >
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
  immersive,
  onImmersiveChange,
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

  const toggleImmersive = useCallback(() => {
    if (immersive) {
      onImmersiveChange(false)
      if (document.fullscreenElement) {
        void document.exitFullscreen().catch(() => undefined)
      }
      return
    }

    onImmersiveChange(true)
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      void document.documentElement.requestFullscreen().catch(() => undefined)
    }
  }, [immersive, onImmersiveChange])

  useEffect(() => {
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) onImmersiveChange(false)
    }
    document.addEventListener("fullscreenchange", onFullscreenChange)
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange)
  }, [onImmersiveChange])

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
        stats={stats}
        now={now}
        onExit={onExit}
        onEdit={() => {
          setEditValues({ ...current.note.values })
          setEditError("")
          setEditOpen(true)
        }}
        immersive={immersive}
        onToggleImmersive={toggleImmersive}
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
        immersive={immersive}
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
