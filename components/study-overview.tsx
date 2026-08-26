"use client"

import { ArrowRight, CheckCircle2, Clock3, Plus, Sparkles } from "lucide-react"

import { StudyStage } from "@/components/study-stage"
import { Button } from "@/components/ui/button"
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
  const estimatedMinutes = Math.max(1, Math.round(queue.length * 0.4))

  const emptyTitle = dailyLimitReached ? "今天完成了" : stats.nextDue ? "暂时没有任务" : "先添加一些卡片"
  const emptyDescription = dailyLimitReached
    ? "今天计划中的新卡与复习任务已全部完成。"
    : stats.nextDue
      ? `下一批卡片将在 ${formatDueDate(stats.nextDue, now)} 到期。`
      : "新建卡片或导入卡包后，就可以开始记忆。"

  return (
    <StudyStage>
      <section className="mx-auto flex w-full max-w-lg flex-col gap-4 py-2 sm:py-6" aria-labelledby="study-overview-title">
        <div className="overflow-hidden rounded-[30px] border border-border/60 bg-card shadow-[0_18px_60px_-32px_rgba(15,23,42,0.45)]">
          <div className="relative px-5 pb-5 pt-6 sm:px-7 sm:pb-7 sm:pt-8">
            <div className="pointer-events-none absolute -right-14 -top-16 size-40 rounded-full bg-primary/5 blur-2xl" />
            {ready ? (
              <>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">今日学习</p>
                    <h2 id="study-overview-title" className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">继续保持节奏</h2>
                  </div>
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-foreground text-background shadow-sm">
                    <Sparkles className="size-5" />
                  </div>
                </div>

                <div className="mt-8 flex items-end justify-between gap-5">
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-7xl font-black leading-none tracking-[-0.06em] sm:text-8xl">{queue.length}</span>
                      <span className="pb-1 text-sm font-semibold text-muted-foreground">张</span>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">等待你今天完成</p>
                  </div>
                  <div className="pb-1 text-right text-xs text-muted-foreground">
                    <div className="flex items-center justify-end gap-1.5"><Clock3 className="size-3.5" />约 {estimatedMinutes} 分钟</div>
                    <div className="mt-1 font-mono">已学 {stats.reviewedToday}</div>
                  </div>
                </div>

                <div className="mt-7 grid grid-cols-2 gap-2.5">
                  <div className="rounded-2xl bg-muted/60 px-3.5 py-3 ring-1 ring-border/50">
                    <span className="text-[11px] font-medium text-muted-foreground">复习</span>
                    <div className="mt-1 font-mono text-xl font-bold">{reviewCount}</div>
                  </div>
                  <div className="rounded-2xl bg-muted/60 px-3.5 py-3 ring-1 ring-border/50">
                    <span className="text-[11px] font-medium text-muted-foreground">新卡</span>
                    <div className="mt-1 font-mono text-xl font-bold">{newCount}</div>
                  </div>
                </div>

                <Button size="lg" className="mt-5 h-14 w-full rounded-[18px] text-base font-semibold shadow-sm active:scale-[0.99]" onClick={onStart}>
                  开始学习 <ArrowRight className="ml-1 size-4.5" />
                </Button>
              </>
            ) : (
              <div className="flex min-h-[360px] flex-col items-center justify-center text-center">
                <div className="flex size-14 items-center justify-center rounded-2xl bg-foreground text-background shadow-sm"><CheckCircle2 className="size-7" /></div>
                <h2 id="study-overview-title" className="mt-5 text-2xl font-bold tracking-tight">{emptyTitle}</h2>
                <p className="mt-2 max-w-xs text-sm leading-6 text-muted-foreground">{emptyDescription}</p>
                {stats.reviewedToday > 0 ? <div className="mt-5 rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground">今日已复习 {stats.reviewedToday} 张</div> : null}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-[24px] border border-border/60 bg-card px-4 py-4 shadow-xs">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">当前卡包</p>
            <p className="mt-1 truncate text-base font-semibold">{deck.name.trim() || "未命名卡包"}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">共 {deck.cards.length} 张卡片</p>
          </div>
          {onAddNote ? (
            <Button type="button" variant="secondary" size="lg" className="h-12 rounded-2xl px-4" onClick={onAddNote}>
              <Plus className="mr-1 size-4" /> 新建
            </Button>
          ) : null}
        </div>
      </section>
    </StudyStage>
  )
}
