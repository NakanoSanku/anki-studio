"use client"

import { ArrowRight, BookOpen, CheckCircle2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import type { Deck } from "@/lib/deck"
import { formatDueDate, getStudyQueue, getStudyStats } from "@/lib/fsrs"

type StudyOverviewProps = {
  deck: Deck
  onStart: () => void
  onAddNote?: () => void
}

export function StudyOverview({ deck, onStart, onAddNote }: StudyOverviewProps) {
  const now = new Date()
  const queue = getStudyQueue(deck, now)
  const stats = getStudyStats(deck, now)
  const newCount = queue.filter((item) => item.isNew).length
  const reviewCount = queue.length - newCount
  const ready = queue.length > 0
  const dailyLimitReached = !ready && stats.dueNow > 0
  const deckName = deck.name.trim() || "未命名卡包"

  const emptyTitle = dailyLimitReached
    ? "今天的学习额度已完成"
    : stats.nextDue
      ? "当前没有待学习卡片"
      : "暂无待学习卡片"
  const emptyDescription = dailyLimitReached
    ? "今天可以学习的卡片已经全部完成。"
    : stats.nextDue
      ? `下一张将在 ${formatDueDate(stats.nextDue, now)} 到期。`
      : "当前卡包还没有计划中的复习。"

  return (
    <section
      className="mx-auto flex min-h-[calc(100dvh-12.5rem)] w-full max-w-xl items-center justify-center sm:min-h-[calc(100dvh-13rem)] lg:min-h-[calc(100dvh-10rem)]"
      aria-labelledby="study-overview-title"
    >
      <Card className="w-full gap-0 bg-transparent py-0 shadow-none ring-0 sm:bg-card sm:shadow-sm sm:ring-1">
        <CardContent className="flex min-h-[24rem] flex-col items-center justify-center px-2 py-8 text-center sm:px-10 sm:py-12">
          <div className="flex max-w-full items-center gap-2 text-sm text-muted-foreground">
            <BookOpen className="size-4 shrink-0 text-primary" />
            <span className="truncate">{deckName}</span>
          </div>

          {ready ? (
            <>
              <h2 id="study-overview-title" className="mt-8 tracking-tight">
                <span className="block font-mono text-7xl font-semibold tabular-nums sm:text-8xl">
                  {queue.length}
                </span>
                <span className="mt-2 block text-base font-medium text-muted-foreground sm:text-lg">
                  张待学习
                </span>
              </h2>

              <p className="mt-6 flex items-center justify-center gap-3 text-sm text-muted-foreground">
                <span>复习 {reviewCount}</span>
                <span className="size-1 rounded-full bg-border" aria-hidden="true" />
                <span>新卡 {newCount}</span>
              </p>

              <Button size="lg" className="mt-10 h-12 w-full max-w-xs" onClick={onStart}>
                开始学习
                <ArrowRight className="size-4" />
              </Button>
              {onAddNote ? (
                <Button size="lg" variant="outline" className="mt-3 h-12 w-full max-w-xs" onClick={onAddNote}>
                  加一张
                </Button>
              ) : null}
            </>
          ) : (
            <>
              <span className="mt-8 flex size-14 items-center justify-center rounded-2xl bg-muted text-foreground">
                <CheckCircle2 className="size-7" />
              </span>
              <h2 id="study-overview-title" className="mt-5 text-2xl font-semibold tracking-tight">
                {emptyTitle}
              </h2>
              <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
                {emptyDescription}
              </p>
              {onAddNote ? (
                <Button size="lg" className="mt-8 h-12 w-full max-w-xs" onClick={onAddNote}>
                  加一张
                </Button>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
