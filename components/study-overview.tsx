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

type BuddyProps = {
  className: string
  face?: "smile" | "wow" | "sleep"
}

function Buddy({ className, face = "smile" }: BuddyProps) {
  return (
    <div
      aria-hidden="true"
      className={`absolute ${className}`}
      style={{ borderRadius: "46% 54% 48% 52% / 48% 44% 56% 52%" }}
    >
      <span className="absolute left-[31%] top-[34%] size-[13%] rounded-full bg-black" />
      <span className="absolute right-[31%] top-[34%] size-[13%] rounded-full bg-black" />
      {face === "smile" ? (
        <span className="absolute bottom-[27%] left-1/2 h-[16%] w-[30%] -translate-x-1/2 rounded-b-full border-b-[5px] border-black" />
      ) : face === "wow" ? (
        <span className="absolute bottom-[24%] left-1/2 size-[17%] -translate-x-1/2 rounded-full bg-black" />
      ) : (
        <span className="absolute bottom-[30%] left-1/2 h-[3px] w-[27%] -translate-x-1/2 rounded-full bg-black" />
      )}
    </div>
  )
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

  const emptyTitle = dailyLimitReached ? "今天完成啦" : stats.nextDue ? "先休息一下" : "从第一张卡开始"
  const emptyDescription = dailyLimitReached
    ? "今天计划中的新卡与复习任务都完成了。"
    : stats.nextDue
      ? `下一批卡片将在 ${formatDueDate(stats.nextDue, now)} 到期。`
      : "新建卡片或导入卡包，就可以开始记忆。"

  return (
    <StudyStage>
      <section className="mx-auto flex w-full max-w-lg flex-col gap-4 pb-3 pt-1 sm:py-5" aria-labelledby="study-overview-title">
        <div className="soft-card-shadow overflow-hidden rounded-[36px] bg-card ring-1 ring-black/[0.035] dark:ring-white/[0.08]">
          <div className="relative h-[340px] overflow-hidden bg-[linear-gradient(180deg,#f7fbff_0%,#e0f3ff_100%)] px-5 pt-6 dark:bg-[linear-gradient(180deg,#26323a_0%,#1d2a33_100%)] sm:h-[380px] sm:px-7 sm:pt-7">
            <div className="relative z-20">
              <p className="anki-wordmark text-[46px] text-black sm:text-[54px] dark:text-white">anki studio</p>
              <p className="mt-3 max-w-[72%] text-[13px] font-semibold leading-5 text-black/55 dark:text-white/60">
                一点一点，把记忆变成每天都会发生的小事。
              </p>
            </div>

            <Buddy className="-left-11 top-[125px] h-[142px] w-[142px] rotate-[8deg] bg-[#aef56f] shadow-[inset_-18px_-20px_34px_rgba(72,176,44,0.18)]" face="wow" />
            <Buddy className="-right-8 top-[132px] h-[150px] w-[150px] -rotate-[5deg] bg-[#ff9e91] shadow-[inset_16px_-20px_34px_rgba(255,88,70,0.2)]" />
            <Buddy className="-left-5 bottom-[-46px] h-[172px] w-[172px] -rotate-[10deg] bg-[#84c4ff] shadow-[inset_-18px_-22px_38px_rgba(45,121,222,0.18)]" face="sleep" />
            <Buddy className="-right-7 bottom-[-36px] h-[168px] w-[168px] rotate-[7deg] bg-[#ffd36e] shadow-[inset_16px_-20px_36px_rgba(224,148,21,0.18)]" />

            <div className="absolute left-1/2 top-[57%] z-20 -translate-x-1/2 -translate-y-1/2 rotate-[-5deg] rounded-full bg-black px-5 py-3 text-center text-white shadow-lg">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">today</span>
              <span className="mt-0.5 block whitespace-nowrap text-lg font-black tracking-tight">
                {ready ? `${queue.length} 张等你` : "all done!"}
              </span>
            </div>
          </div>

          <div className="bg-[#fffaf6] px-5 pb-6 pt-6 dark:bg-card sm:px-7 sm:pb-7">
            {ready ? (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">今日学习</p>
                    <h2 id="study-overview-title" className="mt-1.5 text-[28px] font-black leading-tight tracking-[-0.04em]">
                      继续保持这个节奏
                    </h2>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-black/[0.055] px-3 py-2 text-xs font-semibold text-foreground dark:bg-white/10">
                    <Clock3 className="size-3.5" /> 约 {estimatedMinutes} 分钟
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-3 gap-2.5">
                  <div className="rounded-[22px] bg-[#dff1ff] px-3 py-3.5 text-black dark:bg-pastel-blue">
                    <span className="text-[11px] font-bold text-black/50">复习</span>
                    <div className="mt-0.5 text-2xl font-black tracking-tight">{reviewCount}</div>
                  </div>
                  <div className="rounded-[22px] bg-[#dff7c9] px-3 py-3.5 text-black dark:bg-pastel-green">
                    <span className="text-[11px] font-bold text-black/50">新卡</span>
                    <div className="mt-0.5 text-2xl font-black tracking-tight">{newCount}</div>
                  </div>
                  <div className="rounded-[22px] bg-[#ffe2dc] px-3 py-3.5 text-black dark:bg-pastel-coral">
                    <span className="text-[11px] font-bold text-black/50">已学</span>
                    <div className="mt-0.5 text-2xl font-black tracking-tight">{stats.reviewedToday}</div>
                  </div>
                </div>

                <Button
                  size="lg"
                  className="mt-5 h-14 w-full rounded-full bg-black px-5 text-base font-bold text-white shadow-[0_14px_30px_-20px_rgba(0,0,0,0.8)] hover:bg-black/85 active:scale-[0.985] dark:bg-white dark:text-black dark:hover:bg-white/85"
                  onClick={onStart}
                >
                  开始学习 <ArrowRight className="ml-1 size-4.5" />
                </Button>
              </>
            ) : (
              <div className="py-1 text-center">
                <div className="mx-auto flex size-16 items-center justify-center rounded-[24px] bg-[#dff7c9] text-3xl font-black text-black">
                  ✓
                </div>
                <h2 id="study-overview-title" className="mt-4 text-[28px] font-black tracking-[-0.04em]">
                  {emptyTitle}
                </h2>
                <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-muted-foreground">{emptyDescription}</p>
                {stats.reviewedToday > 0 ? (
                  <div className="mx-auto mt-4 w-fit rounded-full bg-black px-3.5 py-2 text-xs font-bold text-white dark:bg-white dark:text-black">
                    今天已经记住 {stats.reviewedToday} 张
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-[28px] bg-[#f4e9ff] px-4 py-4 text-black ring-1 ring-black/[0.035] dark:bg-card dark:text-foreground dark:ring-white/[0.08]">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-black/45 dark:text-muted-foreground">当前卡包</p>
            <p className="mt-1 truncate text-base font-black tracking-tight">{deck.name.trim() || "未命名卡包"}</p>
            <p className="mt-0.5 text-xs font-medium text-black/45 dark:text-muted-foreground">共 {deck.cards.length} 张卡片</p>
          </div>
          {onAddNote ? (
            <Button
              type="button"
              size="lg"
              className="h-12 rounded-full bg-black px-4 font-bold text-white hover:bg-black/85 dark:bg-white dark:text-black dark:hover:bg-white/85"
              onClick={onAddNote}
            >
              <Plus className="mr-1 size-4" /> 新建
            </Button>
          ) : null}
        </div>
      </section>
    </StudyStage>
  )
}
