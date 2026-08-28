"use client"

import { useCallback, useEffect, useMemo, useState, type SyntheticEvent } from "react"
import { AnimatePresence, motion, useReducedMotion, type Variants } from "motion/react"
import {
  CheckCircle2,
  Pencil,
  RotateCcw,
  X,
} from "lucide-react"

import { StudyStage } from "@/components/study-stage"
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
import { notesOf, setCardField, textFields, ttsOf, type Deck } from "@/lib/deck"
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
import { getTtsClip, playTtsAudio } from "@/lib/tts"
import { cn } from "@/lib/utils"

type StudySessionProps = {
  deck: Deck
  onChange: (deck: Deck) => void
  onExit: () => void
}

const ratingStyle = {
  [Rating.Again]:
    "border border-destructive/18 bg-destructive/8 text-destructive hover:bg-destructive/12 focus-visible:ring-destructive/25 dark:bg-destructive/12",
  [Rating.Hard]:
    "border border-black/[0.07] bg-[#f3f0e8] text-foreground hover:bg-[#ece7dc] focus-visible:ring-foreground/15 dark:border-white/[0.09] dark:bg-white/[0.055] dark:hover:bg-white/[0.08]",
  [Rating.Good]:
    "border border-black/[0.07] bg-card text-foreground hover:bg-muted/65 focus-visible:ring-foreground/15 dark:border-white/[0.09]",
  [Rating.Easy]:
    "border border-energy/30 bg-energy/18 text-foreground hover:bg-energy/25 focus-visible:ring-energy/35",
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

const TTS_BUTTON_ICON = `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4V5Z"></path><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>`

function studyTtsButton(name: string): string {
  return `<button type="button" data-study-tts="${encodeURIComponent(name)}" aria-label="Play audio" style="display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;margin:4px;border:1px solid rgba(25,79,131,.10);border-radius:10px;background:#e8f3ff;color:#194f83;box-shadow:none;cursor:pointer;vertical-align:middle;-webkit-tap-highlight-color:transparent;">${TTS_BUTTON_ICON}</button>`
}

function StudyCard({
  deck,
  item,
  revealed,
  onReveal,
}: {
  deck: Deck
  item: StudyItem
  revealed: boolean
  onReveal: () => void
}) {
  const configs = useMemo(() => ttsOf(deck), [deck])
  const srcDoc = useMemo(() => {
    const values = { ...item.note.values }
    for (const [name, tts] of Object.entries(configs)) {
      values[name] = (item.note.values[tts.source] ?? "").trim() ? studyTtsButton(name) : ""
    }
    const rendered = renderCard(item.template.front, item.template.back, values)
    return previewDocument(deck.css, revealed ? rendered.back : rendered.front)
  }, [configs, deck.css, item.note.values, item.template.back, item.template.front, revealed])

  const wireFrame = useCallback(
    (event: SyntheticEvent<HTMLIFrameElement>) => {
      const doc = event.currentTarget.contentDocument
      if (!doc) return

      doc.body.style.cursor = revealed ? "default" : "pointer"
      doc.body.onclick = (bodyEvent) => {
        const target = bodyEvent.target
        if (target instanceof Element && target.closest("[data-study-tts]")) return
        if (!revealed) onReveal()
      }

      for (const button of doc.querySelectorAll<HTMLButtonElement>("[data-study-tts]")) {
        const encodedName = button.dataset.studyTts
        if (!encodedName) {
          button.remove()
          continue
        }

        let name = ""
        try {
          name = decodeURIComponent(encodedName)
        } catch {
          button.remove()
          continue
        }

        const tts = configs[name]
        const text = tts ? item.note.values[tts.source] ?? "" : ""
        if (!tts || !text.trim()) {
          button.remove()
          continue
        }

        button.setAttribute("aria-label", `Play ${name}`)
        button.onclick = (buttonEvent) => {
          buttonEvent.preventDefault()
          buttonEvent.stopPropagation()
          if (button.disabled) return

          button.disabled = true
          button.dataset.state = "loading"
          button.style.opacity = "0.58"
          button.style.cursor = "progress"
          button.removeAttribute("title")

          void getTtsClip({ text, lang: tts.lang, slow: tts.slow })
            .then((clip) => playTtsAudio(clip.blob))
            .then(() => {
              if (!button.isConnected) return
              button.dataset.state = "idle"
              button.style.opacity = "1"
              button.style.cursor = "pointer"
            })
            .catch((caught: unknown) => {
              if (!button.isConnected) return
              const message = caught instanceof Error ? caught.message : "Audio playback failed"
              button.dataset.state = "error"
              button.title = message
              button.style.opacity = "1"
              button.style.cursor = "pointer"
              button.style.background = "#fff0f0"
              button.style.color = "#b42318"
              window.setTimeout(() => {
                if (!button.isConnected) return
                button.dataset.state = "idle"
                button.style.background = "#e8f3ff"
                button.style.color = "#194f83"
              }, 1800)
            })
            .finally(() => {
              if (button.isConnected) button.disabled = false
            })
        }
      }
    },
    [configs, item.note.values, onReveal, revealed]
  )

  return (
    <iframe
      title={revealed ? "Card back" : "Card front"}
      sandbox="allow-same-origin"
      srcDoc={srcDoc}
      onLoad={wireFrame}
      className="h-full w-full border-0 bg-white"
    />
  )
}

function StudyBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute -left-24 -top-20 size-72 rounded-full bg-energy/[0.09] blur-3xl" />
      <div className="absolute -right-24 bottom-[8%] size-80 rounded-full bg-foreground/[0.035] blur-3xl dark:bg-white/[0.04]" />
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
    <header className="relative z-30 shrink-0 border-b border-black/[0.045] bg-background/94 pt-[env(safe-area-inset-top)] backdrop-blur-2xl dark:border-white/[0.07]">
      <div className="mx-auto grid min-h-16 w-full max-w-5xl grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 sm:min-h-18 sm:px-5">
        <Button
          type="button"
          size="icon-lg"
          variant="outline"
          className="shadow-none"
          aria-label="Exit study"
          onClick={onExit}
        >
          <X className="size-4" />
        </Button>

        <div className="min-w-0 px-1">
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground sm:text-[11px]">
              <span className="size-1.5 rounded-full bg-energy" />
              Focus
            </span>
            <span className="font-mono text-[10px] font-medium tabular-nums text-muted-foreground sm:text-[11px]">
              {completed} / {total}
            </span>
          </div>
          <Progress
            value={progress}
            aria-label={`Completed ${completed} of ${total} cards`}
            className="h-1.5 bg-black/[0.06] [&_[data-slot=progress-indicator]]:bg-energy dark:bg-white/10"
          />
        </div>

        <Button
          type="button"
          size="icon-lg"
          variant="outline"
          className="shadow-none"
          aria-label="Edit note"
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
    <div className="relative z-30 shrink-0 border-t border-black/[0.045] bg-background/96 px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-2xl sm:px-5 sm:pt-3 dark:border-white/[0.07]">
      <div className="mx-auto w-full max-w-4xl">
        {!revealed ? (
          <Button
            className="h-14 w-full justify-center rounded-[16px] bg-foreground px-6 text-[15px] font-semibold tracking-[-0.015em] text-background shadow-[0_16px_34px_-26px_rgba(0,0,0,0.75)] hover:bg-foreground/90"
            aria-keyshortcuts="Space"
            onClick={onReveal}
          >
            <span>Show answer</span>
            <kbd className="ml-auto hidden rounded-[8px] border border-background/15 bg-background/8 px-2 py-1 font-mono text-[9px] font-medium text-background/60 sm:inline">
              Space
            </kbd>
          </Button>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-2.5" aria-label="Rate recall">
            {options.map((option, index) => (
              <Button
                key={option.rating}
                variant="ghost"
                className={cn(
                  "min-h-15 flex-col gap-0.5 rounded-[16px] px-2 py-2.5 shadow-none sm:min-h-16",
                  ratingStyle[option.rating]
                )}
                aria-label={`${option.label}, next interval ${option.interval}, shortcut ${index + 1}`}
                aria-keyshortcuts={`${index + 1}`}
                onClick={() => onRate(option.rating)}
              >
                <span className="flex items-center gap-1.5 text-sm font-semibold tracking-[-0.015em] sm:text-[15px]">
                  <kbd className="hidden size-5 items-center justify-center rounded-[7px] bg-black/[0.06] font-mono text-[9px] font-medium opacity-60 sm:flex dark:bg-white/[0.08]">
                    {index + 1}
                  </kbd>
                  {option.label}
                </span>
                <span className="max-w-full truncate font-mono text-[9px] font-medium opacity-55 sm:text-[10px]">
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
      ? "You've completed every card available under today's limits."
      : stats.nextDue
        ? `The next card is due ${formatDueDate(stats.nextDue, now)}.`
        : "No reviews are scheduled right now."

    return (
      <StudyStage>
        <section
          className="relative flex h-[100dvh] items-center justify-center overflow-hidden overscroll-none bg-background px-4 py-8 sm:px-8"
          aria-labelledby="study-complete-title"
        >
          <StudyBackdrop />
          <div className="relative z-10 flex w-full max-w-md flex-col items-center text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-energy text-black shadow-[0_18px_42px_-32px_rgba(0,0,0,0.5)]">
              <CheckCircle2 className="size-7" />
            </div>
            <p className="mt-6 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Session clear</p>
            <h2 id="study-complete-title" className="mt-2 text-[32px] font-semibold tracking-[-0.05em] text-foreground sm:text-[36px]">
              {completed > 0 ? `${completed} cards complete` : "Nothing due right now"}
            </h2>
            <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
              {completionDescription}
            </p>
            <Button
              size="lg"
              className="mt-8 h-[52px] w-full max-w-xs rounded-[16px]"
              onClick={onExit}
            >
              Back to study
            </Button>
          </div>
        </section>
      </StudyStage>
    )
  }

  const side = revealed ? "back" : "front"
  const cardVariants: Variants = {
    enter: (cardAction: CardMotionAction) => cardMotionPose(cardAction, reducedMotion).initial,
    center: { x: 0, opacity: 1 },
    exit: (cardAction: CardMotionAction) => cardMotionPose(cardAction, reducedMotion).exit,
  }

  return (
    <StudyStage>
      <section className="flex h-[100dvh] flex-col overflow-hidden overscroll-none bg-background" aria-label="Study session">
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

        <div className="relative min-h-0 flex-1 overflow-hidden px-3 py-2 sm:px-5 sm:py-3">
          <StudyBackdrop />
          <div className="relative z-10 mx-auto h-full w-full max-w-5xl overflow-hidden rounded-[24px] border border-black/[0.065] bg-white shadow-[0_24px_60px_-46px_rgba(0,0,0,0.55)] dark:border-white/[0.09]">
            <AnimatePresence initial={false} mode="sync" custom={action}>
              <motion.div
                key={`${current.id}:${side}`}
                custom={action}
                variants={cardVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: CARD_MOTION_DURATION_S, ease: [0.22, 1, 0.36, 1] }}
                data-card-motion=""
                data-card-face={side}
                className="absolute inset-0 h-full w-full overflow-hidden rounded-[inherit]"
              >
                <StudyCard deck={deck} item={current} revealed={revealed} onReveal={reveal} />
              </motion.div>
            </AnimatePresence>

            {revealed ? (
              <div className="pointer-events-auto absolute bottom-3 right-3 z-20 rounded-[14px] border border-black/[0.07] bg-card p-0.5 text-foreground shadow-[0_12px_28px_-22px_rgba(0,0,0,0.45)] sm:bottom-5 sm:right-5 dark:border-white/[0.1]">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Review front"
                      onClick={conceal}
                    >
                      <RotateCcw className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Review front</TooltipContent>
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
          <SheetContent
            side="bottom"
            className="max-h-[88dvh] pb-[max(1rem,env(safe-area-inset-bottom))]"
          >
            <SheetHeader>
              <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                <span className="size-2 rounded-full bg-energy" />
                Quick edit
              </div>
              <SheetTitle className="text-2xl font-semibold tracking-[-0.04em]">Edit note</SheetTitle>
              <SheetDescription>Save your changes and return to this card.</SheetDescription>
            </SheetHeader>
            <div className="flex max-h-[52dvh] flex-col gap-3 overflow-y-auto px-4">
              {textFields(deck).map((field) => {
                const note = notesOf(deck)[field]?.trim()
                const long = textFields(deck).indexOf(field) >= 2
                return (
                  <div key={field} className="space-y-2 rounded-[16px] border border-black/[0.065] bg-background/45 p-3.5 dark:border-white/[0.09]">
                    <Label htmlFor={`study-edit-${field}`} className="text-xs font-semibold tracking-[-0.01em]">
                      {field}
                    </Label>
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
              {editError ? <p className="text-sm font-medium text-destructive">{editError}</p> : null}
            </div>
            <SheetFooter>
              <Button
                type="button"
                className="h-[52px] rounded-[16px] text-sm font-semibold"
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
                Save changes
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </section>
    </StudyStage>
  )
}
