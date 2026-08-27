"use client"

import { ArrowRight, Clock3, Plus } from "lucide-react"

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
  const todayTotal = stats.reviewedToday + queue.length
  const progress = todayTotal > 0 ? Math.min(100, Math.round((stats.reviewedToday / todayTotal) * 100)) : 100

  const emptyTitle = dailyLimitReached ? "今天完成了" : stats.nextDue ? "可以休息一下" : "从第一张卡开始"
  const emptyDescription = dailyLimitReached
    ? "今天计划中的新卡与复习任务都已经处理完。"
    : stats.nextDue
      ? `下一批卡片将在 ${formatDueDate(stats.nextDue, now)} 到期。`
      : "新建卡片或导入卡包，就可以开始记忆。"

  return (
    <StudyStage>
      <section className="mx-auto flex w-full max-w-lg flex-col gap-4 pb-3 pt-2 sm:py-6" aria-labelledby="study-overview-title">
        <div className="flex items-end justify-between gap-4 px-1">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <span className="size-2 rounded-full bg-energy" />
              Today
            </div>
            <h1 id="study-overview-title" className="text-[30px] font-semibold leading-[1.02] tracking-[-0.045em] sm:text-[34px]">
              今天的学习
            </h1>
            <p className="mt-2 text-sm leading-5 text-muted-foreground">少一点干扰，保持一个清晰的节奏。</p>
          </div>
          {ready ? (
            <div className="mb-0.5 flex shrink-0 items-center gap-1.5 rounded-full border border-black/[0.07] bg-card px-3 py-2 text-[11px] font-medium text-muted-foreground dark:border-white/[0.09]">
              <Clock3 className="size-3.5" />
              {estimatedMinutes} min
            </div>
          ) : null}
        </div>

        <div className="overflow-hidden rounded-[28px] bg-foreground text-background shadow-[0_24px_60px_-42px_rgba(0,0,0,0.8)]">
          <div className="px-5 pb-5 pt-5 sm:px-6 sm:pb-6 sm:pt-6">
            {ready ? (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-background/50">Remaining</p>
                    <div className="mt-2 flex items-end gap-2">
                      <span className="text-[64px] font-semibold leading-none tracking-[-0.065em]">{queue.length}</span>
                      <span className="mb-2.5 text-sm font-medium text-background/55">张待学习</span>
                    </div>
                  </div>
                  <div className="flex size-11 items-center justify-center rounded-full bg-energy text-sm font-bold text-black">
                    {progress}%
                  </div>
                </div>

                <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-background/12" aria-hidden="true">
                  <div className="h-full rounded-full bg-energy transition-[width] duration-300" style={{ width: `${Math.max(6, progress)}%` }} />
                </div>

                <div className="mt-5 grid grid-cols-3 divide-x divide-background/12 border-y border-background/12 py-4">
                  <div className="pr-3">
                    <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-background/40">Review</p>
                    <p className="mt-1 text-xl font-semibold tracking-[-0.03em]">{reviewCount}</p>
                  </div>
                  <div className="px-3">
                    <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-background/40">New</p>
                    <p className="mt-1 text-xl font-semibold tracking-[-0.03em]">{newCount}</p>
                  </div>
                  <div className="pl-3">
                    <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-background/40">Done</p>
                    <p className="mt-1 text-xl font-semibold tracking-[-0.03em]">{stats.reviewedToday}</p>
                  </div>
                </div>

                <Button
                  size="lg"
                  className="mt-5 h-13 w-full rounded-[16px] bg-energy px-5 text-[15px] font-semibold text-black shadow-none hover:bg-energy/90 active:scale-[0.99]"
                  onClick={onStart}
                >
                  开始学习 <ArrowRight className="ml-1 size-4.5" />
                </Button>
              </>
            ) : (
              <div className="py-3">
                <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-background/50">
                  <span className="size-2 rounded-full bg-energy" />
                  Clear
                </div>
                <div className="mt-6 flex size-12 items-center justify-center rounded-full bg-energy text-xl font-bold text-black">✓</div>
                <h2 className="mt-5 text-[30px] font-semibold tracking-[-0.045em]">{emptyTitle}</h2>
                <p className="mt-2 max-w-sm text-sm leading-6 text-background/55">{emptyDescription}</p>
                {stats.reviewedToday > 0 ? (
                  <p className="mt-5 border-t border-background/12 pt-4 text-xs font-medium text-background/55">
                    今天已经完成 {stats.reviewedToday} 张卡片
                  </p>
                ) : null}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-[22px] border border-black/[0.065] bg-card p-4 shadow-[0_18px_46px_-42px_rgba(0,0,0,0.45)] dark:border-white/[0.09]">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Current deck</p>
              <p className="mt-1.5 truncate text-[16px] font-semibold tracking-[-0.025em]">{deck.name.trim() || "未命名卡包"}</p>
              <p className="mt-1 text-xs text-muted-foreground">{deck.cards.length} 张卡片</p>
            </div>
            {onAddNote ? (
              <Button type="button" variant="outline" className="h-11 shrink-0 px-4" onClick={onAddNote}>
                <Plus className="mr-1 size-4" /> 新建
              </Button>
            ) : null}
          </div>
        </div>
      </section>
    </StudyStage>
  )
}
