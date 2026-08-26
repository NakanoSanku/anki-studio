"use client"

import { ArrowRight, CheckCircle2, Clock, Plus } from "lucide-react"

import { StudyStage } from "@/components/study-stage"
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
  const totalCards = deck.cards.length
  const estimatedMinutes = Math.max(1, Math.round(queue.length * 0.4))

  const emptyTitle = dailyLimitReached
    ? "今日学习目标已达成"
    : stats.nextDue
      ? "当前没有待学习卡片"
      : "卡包暂无待学习卡片"
  const emptyDescription = dailyLimitReached
    ? "今天计划中的新卡与复习任务已全部完成！"
    : stats.nextDue
      ? `下一批卡片将在 ${formatDueDate(stats.nextDue, now)} 到期。`
      : "添加新笔记或导入卡包即可开始记忆。"

  return (
    <StudyStage>
      <section
        className="mx-auto flex w-full max-w-md flex-col gap-3 px-1 py-2 sm:max-w-lg sm:gap-4 sm:py-6"
        aria-labelledby="study-overview-title"
      >
        {/* Main Hero Learning Card */}
        <Card className="rounded-3xl border-border/80 bg-card/90 shadow-sm backdrop-blur-xs">
          <CardContent className="flex flex-col items-center px-5 py-7 text-center sm:px-8 sm:py-9">
            {ready ? (
              <>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-muted/70 px-3 py-1 text-xs font-medium text-muted-foreground">
                  <span>今日任务</span>
                </div>

                <div className="mt-4 flex flex-col items-center">
                  <span className="font-mono text-6xl font-extrabold tracking-tight text-foreground sm:text-7xl">
                    {queue.length}
                  </span>
                  <span className="mt-1 text-sm font-medium text-muted-foreground">
                    张待学习
                  </span>
                </div>

                {/* Categories & Estimated Time */}
                <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                  <div className="flex items-center gap-1.5 rounded-xl border border-blue-500/20 bg-blue-500/10 px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400">
                    <span className="size-1.5 rounded-full bg-blue-500" />
                    <span>复习 {reviewCount}</span>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    <span className="size-1.5 rounded-full bg-emerald-500" />
                    <span>新卡 {newCount}</span>
                  </div>
                  <div className="flex items-center gap-1 rounded-xl border border-border/60 bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
                    <Clock className="size-3" />
                    <span>约 {estimatedMinutes} 分钟</span>
                  </div>
                </div>

                {/* Primary Start Action */}
                <div className="mt-8 flex w-full flex-col gap-2.5">
                  <Button
                    size="lg"
                    aria-label="开始学习"
                    className="h-12 w-full rounded-2xl text-base font-semibold shadow-sm transition-all active:scale-[0.98]"
                    onClick={onStart}
                  >
                    开始学习
                    <ArrowRight className="ml-1 size-4.5" />
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <CheckCircle2 className="size-7 stroke-[2.5]" />
                </div>
                <h2 id="study-overview-title" className="mt-4 text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                  {emptyTitle}
                </h2>
                <p className="mt-2 max-w-xs text-xs leading-relaxed text-muted-foreground sm:text-sm">
                  {emptyDescription}
                </p>
                {stats.reviewedToday > 0 ? (
                  <div className="mt-4 rounded-xl border border-border/60 bg-muted/30 px-3.5 py-2 text-xs text-muted-foreground">
                    今日已复习 <strong className="font-semibold text-foreground">{stats.reviewedToday}</strong> 张卡片
                  </div>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>

        {/* Secondary Deck & Stats Card */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col justify-center rounded-2xl border border-border/70 bg-card/60 p-4 shadow-2xs">
            <span className="text-xs text-muted-foreground">卡包总卡片</span>
            <div className="mt-1.5 flex items-baseline gap-1.5">
              <span className="font-mono text-2xl font-bold text-foreground">{totalCards}</span>
              <span className="text-xs text-muted-foreground">张</span>
            </div>
          </div>
          <div className="flex flex-col justify-center rounded-2xl border border-border/70 bg-card/60 p-4 shadow-2xs">
            <span className="text-xs text-muted-foreground">今日已学</span>
            <div className="mt-1.5 flex items-baseline gap-1.5">
              <span className="font-mono text-2xl font-bold text-foreground">{stats.reviewedToday}</span>
              <span className="text-xs text-muted-foreground">张</span>
            </div>
          </div>
        </div>

        {/* Secondary Action Button */}
        {onAddNote ? (
          <Button
            type="button"
            variant="outline"
            size="lg"
            aria-label="新建卡片"
            className="h-11 w-full rounded-2xl border-border/80 bg-card/70 text-sm font-medium shadow-2xs hover:bg-muted/50 active:scale-[0.98]"
            onClick={onAddNote}
          >
            <Plus className="mr-1.5 size-4" />
            新建卡片
          </Button>
        ) : null}
      </section>
    </StudyStage>
  )
}
