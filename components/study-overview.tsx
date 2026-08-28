"use client"

import { useState } from "react"
import { ArrowRight, AudioLines, Clock3, Plus } from "lucide-react"

import { AiTutor } from "@/components/ai-tutor"
import { StudyStage } from "@/components/study-stage"
import { Button } from "@/components/ui/button"
import { PATHS } from "@/lib/app-paths"
import type { Deck } from "@/lib/deck"
import { formatDueDate, getStudyQueue, getStudyStats } from "@/lib/fsrs"

type StudyOverviewProps = {
  deck: Deck
  onStart: () => void
  onAddNote?: () => void
}

export function StudyOverview({ deck, onStart, onAddNote }: StudyOverviewProps) {
  const [tutorOpen, setTutorOpen] = useState(false)
  const now = new Date()
  const queue = getStudyQueue(deck, now)
  const stats = getStudyStats(deck, now)
  const newCount = queue.filter((item) => item.isNew).length
  const reviewCount = queue.length - newCount
  const ready = queue.length > 0
  const dailyLimitReached = !ready && stats.dueNow > 0
  const estimatedMinutes = Math.max(1, Math.round(queue.length * 0.4))
  const todayTotal = stats.reviewedToday + queue.length
  const progress = todayTotal > 0 ? Math.min(100, Math.round((stats.reviewedToday / todayTotal) * 100)) : 100

  const emptyTitle = dailyLimitReached ? "You're done for today" : stats.nextDue ? "Take a break" : "Start with your first note"
  const emptyDescription = dailyLimitReached
    ? "Today's new-note and review limits are complete."
    : stats.nextDue
      ? `The next cards are due ${formatDueDate(stats.nextDue, now)}.`
      : "Create a note or import a deck to begin studying."

  const startStudy = () => {
    // `/study` is only a URL state for the persistent client-side Studio shell.
    // Native History API calls are integrated with Next App Router hooks, so
    // this updates usePathname immediately without waiting for an RSC request.
    try {
      window.history.pushState(null, "", PATHS.studySession)
    } catch {
      onStart()
    }
  }

  return (
    <>
      <StudyStage>
        <section className="mx-auto flex w-full max-w-xl flex-col gap-5 pb-4 pt-2 sm:gap-6 sm:py-7" aria-labelledby="study-overview-title">
          <div className="flex items-end justify-between gap-4 px-0.5">
            <div className="min-w-0">
              <div className="mb-2.5 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                <span className="h-1.5 w-5 rounded-full bg-signal" />
                Today
              </div>
              <h1 id="study-overview-title" className="text-[31px] font-semibold leading-[1.02] tracking-[-0.045em] sm:text-[36px]">
                Focus on what’s due.
              </h1>
              <p className="mt-2.5 max-w-md text-sm leading-6 text-muted-foreground">
                A quiet workspace for one deliberate learning session.
              </p>
            </div>
            {ready ? (
              <div className="mb-0.5 flex shrink-0 items-center gap-1.5 rounded-full border border-foreground/[0.07] bg-card/78 px-3 py-2 text-[11px] font-medium text-muted-foreground backdrop-blur-xl">
                <Clock3 className="size-3.5" />
                {estimatedMinutes} min
              </div>
            ) : null}
          </div>

          <div className="overflow-hidden rounded-[22px] border border-foreground/[0.07] bg-card/94 shadow-[0_16px_42px_-36px_rgba(15,23,42,0.28)] backdrop-blur-xl">
            {ready ? (
              <div className="p-5 sm:p-6">
                <div className="flex items-start justify-between gap-5">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Remaining</p>
                    <div className="mt-2 flex items-end gap-2.5">
                      <span className="text-[62px] font-semibold leading-none tracking-[-0.065em] text-foreground">{queue.length}</span>
                      <span className="mb-2 text-sm font-medium text-muted-foreground">cards</span>
                    </div>
                  </div>
                  <div className="rounded-full bg-accent px-3 py-1.5 text-[11px] font-semibold text-accent-foreground">
                    {progress}% done
                  </div>
                </div>

                <div className="mt-5 h-1 overflow-hidden rounded-full bg-foreground/[0.075]" aria-hidden="true">
                  <div className="h-full rounded-full bg-signal transition-[width] duration-300" style={{ width: `${Math.max(5, progress)}%` }} />
                </div>

                <div className="mt-5 grid grid-cols-3 border-y border-foreground/[0.06] py-4">
                  <div className="pr-3">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Review</p>
                    <p className="mt-1 text-xl font-semibold tracking-[-0.035em]">{reviewCount}</p>
                  </div>
                  <div className="border-x border-foreground/[0.06] px-3">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">New</p>
                    <p className="mt-1 text-xl font-semibold tracking-[-0.035em]">{newCount}</p>
                  </div>
                  <div className="pl-3">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Completed</p>
                    <p className="mt-1 text-xl font-semibold tracking-[-0.035em]">{stats.reviewedToday}</p>
                  </div>
                </div>

                <Button size="lg" className="mt-5 h-12 w-full justify-between px-4.5 text-[14px]" onClick={startStudy}>
                  <span className="flex items-center gap-2">
                    <span aria-hidden="true" className="size-1.5 rounded-full bg-signal" />
                    Start session
                  </span>
                  <ArrowRight className="size-4.5" />
                </Button>
              </div>
            ) : (
              <div className="p-5 sm:p-6">
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  <span className="h-1.5 w-5 rounded-full bg-signal" />
                  Clear
                </div>
                <div className="mt-6 flex size-10 items-center justify-center rounded-full bg-accent text-base font-semibold text-accent-foreground">✓</div>
                <h2 className="mt-5 text-[28px] font-semibold tracking-[-0.04em]">{emptyTitle}</h2>
                <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{emptyDescription}</p>
                {stats.reviewedToday > 0 ? (
                  <p className="mt-5 border-t border-foreground/[0.06] pt-4 text-xs font-medium text-muted-foreground">
                    {stats.reviewedToday} cards completed today
                  </p>
                ) : null}
              </div>
            )}
          </div>

          <div>
            <div className="mb-2.5 flex items-center justify-between px-0.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Workspace</p>
              <span className="text-[10px] font-medium text-muted-foreground/70">{deck.cards.length} notes</span>
            </div>

            <div className="overflow-hidden rounded-[18px] border border-foreground/[0.07] bg-card/82 backdrop-blur-xl">
              <div className="flex items-center gap-3.5 px-4 py-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-accent text-signal">
                  <AudioLines className="size-[18px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold tracking-[-0.02em]">Voice tutor</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">Practice your current deck with Gemini.</p>
                </div>
                <Button type="button" size="sm" variant="outline" className="shrink-0" onClick={() => setTutorOpen(true)}>
                  Open
                </Button>
              </div>

              <div className="mx-4 border-t border-foreground/[0.055]" />

              <div className="flex items-center gap-3.5 px-4 py-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-muted text-[13px] font-semibold text-foreground/70">
                  {deck.name.trim().slice(0, 1).toUpperCase() || "D"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold tracking-[-0.02em]">{deck.name.trim() || "Untitled deck"}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Current deck</p>
                </div>
                {onAddNote ? (
                  <Button type="button" size="sm" variant="ghost" className="shrink-0" onClick={onAddNote}>
                    <Plus className="size-4" />
                    New note
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      </StudyStage>

      {tutorOpen ? <AiTutor deck={deck} onExit={() => setTutorOpen(false)} /> : null}
    </>
  )
}
