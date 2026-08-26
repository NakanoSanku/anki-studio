"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AnimatePresence, motion, useReducedMotion, type Variants } from "motion/react"
import {
  CheckCircle2,
  Pencil,
  RotateCcw,
  X,
} from "lucide-react"

import { StudyStage } from "@/components/study-stage"
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
import { CARD_MOTION_DURATION_S, cardMotionPose, type CardMotionAction } from "@/lib/card-motion"
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
    "bg-[#ffd8df] text-[#761c31] hover:bg-[#ffcad5] focus-visible:ring-[#f59bab]/45 dark:bg-[#6a2835] dark:text-[#ffdce3] dark:hover:bg-[#74303e]",
  [Rating.Hard]:
    "bg-[#ffe39a] text-[#654600] hover:bg-[#ffda73] focus-visible:ring-[#e7b94b]/45 dark:bg-[#68551f] dark:text-[#ffedb8] dark:hover:bg-[#756025]",
  [Rating.Good]:
    "bg-[#cfe6ff] text-[#174f85] hover:bg-[#b9dbff] focus-visible:ring-[#7ab6f3]/45 dark:bg-[#244d74] dark:text-[#dceeff] dark:hover:bg-[#2b5a86]",
  [Rating.Easy]:
    "bg-[#d8f4aa] text-[#315f18] hover:bg-[#c9ed91] focus-visible:ring-[#91c955]/45 dark:bg-[#385528] dark:text-[#e4f8c5] dark:hover:bg-[#42612f]",
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

function StudyBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute -left-16 top-[8%] size-44 rounded-[46%_54%_58%_42%/44%_44%_56%_56%] bg-[#c8f889] blur-[0.2px] sm:size-56" />
      <div className="absolute -right-20 top-[18%] size-52 rounded-[58%_42%_44%_56%/46%_56%_44%_54%] bg-[#ffaaa0] sm:size-64" />
      <div className="absolute -left-12 bottom-[7%] size-40 rounded-[52%_48%_45%_55%/58%_42%_58%_42%] bg-[#9dceff] sm:size-52" />
      <div className="absolute -right-10 bottom-[2%] size-36 rounded-[45%_55%_60%_40%/48%_58%_42%_52%] bg-[#ffe08d] sm:size-48" />
      <div className="absolute left-[46%] top-[4%] size-14 rounded-[48%_52%_43%_57%/55%_43%_57%_45%] bg-[#ff9bd6] sm:size-20" />
    </div>
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
    <header className="relative z-30 shrink-0 bg-[#fffaf5]/95 pt-[env(safe-area-inset-top)] backdrop-blur-xl dark:bg-[#13120f]/95">
      <div className="mx-auto grid min-h-16 w-full max-w-5xl grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 sm:min-h-18 sm:px-5">
        <Button
          type="button"
          size="icon-lg"
          variant="outline"
          className="border-0 bg-white/90 shadow-[0_10px_28px_-20px_rgba(0,0,0,0.75)] dark:bg-white/10"
          aria-label="退出学习"
          onClick={onExit}
        >
          <X className="size-4" />
        </Button>

        <div className="min-w-0 px-1">
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <span className="text-[11px] font-black tracking-[-0.02em] text-foreground sm:text-xs">
              study time
            </span>
            <span className="font-mono text-[10px] font-semibold tabular-nums text-muted-foreground sm:text-xs">
              {completed} / {total}
            </span>
          </div>
          <Progress
            value={progress}
            aria-label={`本轮已完成 ${completed}，共 ${total} 张`}
            className="h-2 bg-black/[0.06] [&_[data-slot=progress-indicator]]:bg-black dark:bg-white/10 dark:[&_[data-slot=progress-indicator]]:bg-white"
          />
        </div>

        <Button
          type="button"
          size="icon-lg"
          variant="outline"
          className="border-0 bg-white/90 shadow-[0_10px_28px_-20px_rgba(0,0,0,0.75)] dark:bg-white/10"
          aria-label="改这条笔记"
          onClick={onEdit}
        >
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
    <div className="relative z-30 shrink-0 bg-[#fffaf5]/96 px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl sm:px-5 sm:pt-3 dark:bg-[#13120f]/96">
      <div className="mx-auto w-full max-w-4xl">
        {!revealed ? (
          <Button
            className="h-16 w-full justify-center rounded-full bg-black px-6 text-base font-black tracking-tight text-white shadow-[0_18px_38px_-24px_rgba(0,0,0,0.9)] hover:bg-black/85 dark:bg-white dark:text-black dark:hover:bg-white/90"
            aria-keyshortcuts="Space"
            onClick={onReveal}
          >
            <span>显示答案</span>
            <kbd className="ml-auto hidden rounded-full bg-white/15 px-2.5 py-1 font-mono text-[10px] font-medium text-white/75 sm:inline dark:bg-black/10 dark:text-black/70">
              Space
            </kbd>
          </Button>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-2.5" aria-label="选择本次记忆难度">
            {options.map((option, index) => (
              <Button
                key={option.rating}
                variant="ghost"
                className={cn(
                  "min-h-16 flex-col gap-0.5 rounded-[1.35rem] border-0 px-2 py-2.5 shadow-[0_12px_28px_-22px_rgba(0,0,0,0.65)] sm:min-h-18",
                  ratingStyle[option.rating]
                )}
                aria-label={`${option.label}，下次复习间隔 ${option.interval}，快捷键 ${index + 1}`}
                aria-keyshortcuts={`${index + 1}`}
                onClick={() => onRate(option.rating)}
              >
                <span className="flex items-center gap-1.5 text-sm font-black tracking-tight sm:text-base">
                  <kbd className="hidden size-5 items-center justify-center rounded-full bg-black/10 font-mono text-[10px] font-semibold opacity-70 sm:flex">
                    {index + 1}
                  </kbd>
                  {option.label}
                </span>
                <span className="max-w-full truncate font-mono text-[10px] font-semibold opacity-60 sm:text-[11px]">
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
  const [action, setAction] = useState<CardMotionAction>("advance")
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

  const reducedMotion = useReducedMotion() ?? false

  const reveal = useCallback(() => {
    setAction("reveal")
    setRevealed(true)
    touchFeedback(8)
  }, [])

  const conceal = useCallback(() => {
    setAction("conceal")
    setRevealed(false)
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
      setAction("advance")
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
      <StudyStage>
        <section
          className="relative flex h-[100dvh] items-center justify-center overflow-hidden overscroll-none bg-[#fffaf5] px-4 py-8 dark:bg-[#13120f] sm:px-8"
          aria-labelledby="study-complete-title"
        >
          <StudyBackdrop />
          <div className="relative z-10 flex w-full max-w-md flex-col items-center text-center">
            <div className="relative flex size-28 items-center justify-center rounded-[46%_54%_60%_40%/48%_44%_56%_52%] bg-[#ffe08d] shadow-[0_22px_50px_-34px_rgba(0,0,0,0.65)]">
              <span className="absolute left-7 top-9 size-3.5 rounded-full bg-black" />
              <span className="absolute right-7 top-9 size-3.5 rounded-full bg-black" />
              <span className="absolute bottom-7 h-5 w-10 rounded-b-full border-b-[5px] border-black" />
              <CheckCircle2 className="absolute -right-2 -top-2 size-9 rounded-full bg-white p-1.5 text-black shadow-sm" />
            </div>
            <p className="mt-6 text-xs font-black uppercase tracking-[0.22em] text-black/45 dark:text-white/45">
              nice work
            </p>
            <h2 id="study-complete-title" className="mt-2 text-3xl font-black tracking-[-0.06em] text-foreground sm:text-4xl">
              {completed > 0 ? `本轮完成 ${completed} 张` : "当前没有待学习卡片"}
            </h2>
            <p className="mt-3 max-w-sm text-sm font-medium leading-6 text-muted-foreground">
              {completionDescription}
            </p>
            <Button
              size="lg"
              className="mt-8 h-14 w-full max-w-xs rounded-full bg-black text-base font-black text-white hover:bg-black/85 dark:bg-white dark:text-black dark:hover:bg-white/90"
              onClick={onExit}
            >
              返回学习
            </Button>
          </div>
        </section>
      </StudyStage>
    )
  }

  const side = revealed ? "back" : "front"
  const playable = ttsFieldsOnSide(deck, side, current.template.id)
  const configs = ttsOf(deck)
  const slideVariants: Variants = {
    enter: (cardAction: CardMotionAction) => cardMotionPose(cardAction, reducedMotion).initial,
    center: { x: 0, opacity: 1 },
    exit: (cardAction: CardMotionAction) => cardMotionPose(cardAction, reducedMotion).exit,
  }

  return (
    <StudyStage>
      <section className="flex h-[100dvh] flex-col overflow-hidden overscroll-none bg-[#fffaf5] dark:bg-[#13120f]" aria-label="学习会话">
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

        <div className="relative min-h-0 flex-1 overflow-hidden px-3 pb-2 sm:px-5 sm:pb-3">
          <StudyBackdrop />
          <div className="relative z-10 mx-auto h-full w-full max-w-5xl overflow-hidden rounded-[2rem] bg-white shadow-[0_28px_70px_-48px_rgba(0,0,0,0.75)] ring-1 ring-black/[0.04] dark:ring-white/[0.08]">
            <AnimatePresence
              initial={false}
              mode="popLayout"
              custom={action}
            >
              <motion.div
                key={`${current.id}:${side}`}
                custom={action}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: CARD_MOTION_DURATION_S, ease: "easeOut" }}
                data-card-motion=""
                data-card-face={side}
                className="absolute inset-0 h-full w-full overflow-hidden rounded-[inherit]"
              >
                <StudyCard deck={deck} item={current} revealed={revealed} />
              </motion.div>
            </AnimatePresence>

            {!revealed ? (
              <button
                type="button"
                className="absolute inset-0 z-10 cursor-pointer rounded-[inherit] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-black/20 focus-visible:ring-inset"
                onClick={reveal}
                aria-label="显示答案"
                aria-keyshortcuts="Space"
              />
            ) : null}

            <div className="pointer-events-none absolute inset-x-3 bottom-3 z-20 flex items-end justify-between gap-3 sm:inset-x-5 sm:bottom-5">
              <div className="pointer-events-auto flex max-w-[70%] flex-wrap gap-1.5">
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
                <div className="pointer-events-auto rounded-full bg-black p-1 text-white shadow-[0_12px_30px_-20px_rgba(0,0,0,0.85)]">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        className="text-white hover:bg-white/15 hover:text-white"
                        aria-label="重看正面"
                        onClick={conceal}
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
        </div>

        <RatingDock
          revealed={revealed}
          options={options}
          onReveal={reveal}
          onRate={rate}
        />

        <Sheet open={editOpen} onOpenChange={setEditOpen}>
          <SheetContent
            side="bottom"
            className="max-h-[88dvh] rounded-t-[2rem] border-0 bg-[#fffaf5] pb-[max(1rem,env(safe-area-inset-bottom))] dark:bg-[#171512]"
          >
            <SheetHeader>
              <div className="mb-2 inline-flex w-fit rounded-full bg-[#ff9bd6]/30 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-foreground">
                quick edit
              </div>
              <SheetTitle className="text-2xl font-black tracking-[-0.04em]">改这条笔记</SheetTitle>
              <SheetDescription className="font-medium">保存后回到当前卡片。</SheetDescription>
            </SheetHeader>
            <div className="flex max-h-[52dvh] flex-col gap-4 overflow-y-auto px-4">
              {textFields(deck).map((field) => {
                const note = notesOf(deck)[field]?.trim()
                const long = textFields(deck).indexOf(field) >= 2
                return (
                  <div key={field} className="space-y-2 rounded-[1.35rem] bg-white p-3.5 shadow-[0_12px_30px_-26px_rgba(0,0,0,0.7)] dark:bg-white/[0.06]">
                    <Label htmlFor={`study-edit-${field}`} className="text-xs font-black tracking-tight">
                      {field}
                    </Label>
                    {long ? (
                      <Textarea
                        id={`study-edit-${field}`}
                        value={editValues[field] ?? ""}
                        placeholder={note}
                        className="min-h-24 bg-[#fffaf5] dark:bg-black/15"
                        onChange={(event) => setEditValues((current) => ({ ...current, [field]: event.target.value }))}
                      />
                    ) : (
                      <Input
                        id={`study-edit-${field}`}
                        value={editValues[field] ?? ""}
                        placeholder={note}
                        className="bg-[#fffaf5] dark:bg-black/15"
                        onChange={(event) => setEditValues((current) => ({ ...current, [field]: event.target.value }))}
                      />
                    )}
                  </div>
                )
              })}
              {editError ? <p className="text-sm font-semibold text-destructive">{editError}</p> : null}
            </div>
            <SheetFooter>
              <Button
                type="button"
                className="h-13 rounded-full bg-black text-sm font-black text-white hover:bg-black/85 dark:bg-white dark:text-black dark:hover:bg-white/90"
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
                保存修改
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </section>
    </StudyStage>
  )
}
