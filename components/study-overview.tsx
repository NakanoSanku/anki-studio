"use client"

import { useState } from "react"
import { ArrowRight, AudioLines, Plus } from "lucide-react"

import { AiTutor } from "@/components/ai-tutor"
import { StudyStage } from "@/components/study-stage"
import { Button } from "@/components/ui/button"
import { PATHS } from "@/lib/app-paths"
import { approvedDeck, type Deck } from "@/lib/deck"
import { formatDueDate, getStudyQueue, getStudyStats } from "@/lib/fsrs"

type StudyOverviewProps = {
  deck: Deck
  onStart: () => void
  onAddNote?: () => void
}

function countLabel(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? "" : "s"}`
}

export function StudyOverview({ deck, onStart, onAddNote }: StudyOverviewProps) {
  const [tutorOpen, setTutorOpen] = useState(false)
  const now = new Date()
  const studyDeck = approvedDeck(deck)
  const queue = getStudyQueue(studyDeck, now)
  const stats = getStudyStats(studyDeck, now)
  const newCount = queue.filter((item) => item.isNew).length
  const reviewCount = queue.length - newCount
  const pendingCount = Math.max(0, deck.cards.length - studyDeck.cards.length)
  const ready = queue.length > 0
  const dailyLimitReached = !ready && stats.dueNow > 0
  const estimatedMinutes = Math.max(1, Math.round(queue.length * 0.4))

  const emptyTitle = dailyLimitReached
    ? "Done for today"
    : stats.nextDue
      ? "Nothing due right now"
      : pendingCount > 0 && studyDeck.cards.length === 0
        ? "Review your notes first"
        : "No cards ready yet"
  const emptyDescription = dailyLimitReached
    ? "Today's study limits are complete."
    : stats.nextDue
      ? `Next card ${formatDueDate(stats.nextDue, now)}.`
      : pendingCount > 0 && studyDeck.cards.length === 0
        ? `${countLabel(pendingCount, "note")} waiting for approval.`
        : "Create or import a note to begin."

  const startStudy = () => {
    try {
      window.history.pushState(null, "", PATHS.studySession)
    } catch {
      onStart()
    }
  }

  return (
    <>
      <StudyStage>
        <section
          className="mx-auto flex h-[calc(100dvh-12.75rem)] min-h-0 w-full max-w-lg flex-col justify-center gap-3 overflow-hidden py-1 min-[390px]:h-[calc(100dvh-13rem)] sm:h-[calc(100dvh-14rem)] sm:gap-4 sm:py-2"
          aria-labelledby="study-overview-title"
        >
          <div className="flex items-center justify-between gap-3 px-1">
            <h1 id="study-overview-title" className="flex items-center gap-2 text-[28px] font-semibold tracking-[-0.045em] sm:text-[30px]">
              <span className="size-2 rounded-full bg-energy" aria-hidden="true" />
              Today
            </h1>
            {ready ? (
              <span className="shrink-0 rounded-full border border-black/[0.07] bg-card px-3 py-1.5 text-[11px] font-medium text-muted-foreground dark:border-white/[0.09]">
                {estimatedMinutes} min
              </span>
            ) : null}
          </div>

          <div className="overflow-hidden rounded-[26px] bg-foreground text-background shadow-[0_24px_60px_-42px_rgba(0,0,0,0.8)]">
            {ready ? (
              <div className="p-5 sm:p-6">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-background/45">Ready</p>
                <div className="mt-1 flex items-end gap-2">
                  <span className="text-[58px] font-semibold leading-none tracking-[-0.065em] sm:text-[64px]">{queue.length}</span>
                  <span className="mb-2 text-sm font-medium text-background/55">cards</span>
                </div>
                <p className="mt-2 text-sm font-medium text-background/60">
                  {countLabel(reviewCount, "review")} · {countLabel(newCount, "new card")}
                  {stats.reviewedToday > 0 ? ` · ${countLabel(stats.reviewedToday, "done")}` : ""}
                </p>

                <Button
                  size="lg"
                  className="mt-5 h-12 w-full rounded-[15px] bg-energy px-5 text-[15px] font-semibold text-black shadow-none hover:bg-energy/90 active:scale-[0.99]"
                  onClick={startStudy}
                >
                  Start studying <ArrowRight className="ml-1 size-4" />
                </Button>
              </div>
            ) : (
              <div className="p-5 sm:p-6">
                <div className="flex size-10 items-center justify-center rounded-full bg-energy text-base font-bold text-black">✓</div>
                <h2 className="mt-4 text-[25px] font-semibold tracking-[-0.04em]">{emptyTitle}</h2>
                <p className="mt-2 text-sm leading-5 text-background/55">{emptyDescription}</p>
                {stats.reviewedToday > 0 ? (
                  <p className="mt-4 text-xs font-medium text-background/45">{countLabel(stats.reviewedToday, "card")} completed today</p>
                ) : null}
              </div>
            )}
          </div>

          <div className={onAddNote ? "grid grid-cols-2 gap-2.5" : "grid grid-cols-1 gap-2.5"}>
            <Button
              type="button"
              variant="outline"
              className="h-14 justify-start rounded-[16px] px-4 text-sm"
              disabled={studyDeck.cards.length === 0}
              onClick={() => setTutorOpen(true)}
            >
              <AudioLines className="size-4" />
              Voice tutor
            </Button>
            {onAddNote ? (
              <Button type="button" variant="outline" className="h-14 justify-start rounded-[16px] px-4 text-sm" onClick={onAddNote}>
                <Plus className="size-4" />
                New note
              </Button>
            ) : null}
          </div>
        </section>
      </StudyStage>

      {tutorOpen ? <AiTutor deck={studyDeck} onExit={() => setTutorOpen(false)} /> : null}
    </>
  )
}
