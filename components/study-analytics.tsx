"use client"

import { useMemo } from "react"
import { CalendarDays, BrainCircuit, ChartNoAxesCombined } from "lucide-react"

import { getStudyAnalytics } from "@/lib/fsrs"
import type { Deck } from "@/lib/deck"

type StudyAnalyticsProps = {
  deck: Deck
}

function shortDate(value: string): string {
  const date = new Date(`${value}T00:00:00`)
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

function heatOpacity(count: number, maximum: number): number {
  if (count === 0 || maximum === 0) return 0
  return 0.22 + (count / maximum) * 0.78
}

export function StudyAnalytics({ deck }: StudyAnalyticsProps) {
  const analytics = useMemo(() => getStudyAnalytics(deck), [deck])
  const maxHeat = Math.max(0, ...analytics.heatmap.map((item) => item.count))
  const maxForecast = Math.max(1, ...analytics.forecast.map((item) => item.count))
  const maxStability = Math.max(1, ...analytics.stability.map((item) => item.count))
  const maxDifficulty = Math.max(10, ...analytics.difficulty.map((item) => item.difficulty))
  const maxStabilityDays = Math.max(1, ...analytics.difficulty.map((item) => item.stability))
  const heatmapLeading = new Date(`${analytics.heatmap[0]?.date ?? "1970-01-01"}T00:00:00`).getDay()

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 pb-8">
      <section className="rounded-[22px] border border-black/[0.065] bg-card p-4 shadow-[0_18px_46px_-42px_rgba(0,0,0,0.45)] dark:border-white/[0.09] sm:p-5" aria-labelledby="study-heatmap-title">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="study-heatmap-title" className="flex items-center gap-2 text-base font-semibold"><CalendarDays className="size-4" /> Learning rhythm</h2>
            <p className="mt-1 text-xs text-muted-foreground">Review ratings during the last 365 days.</p>
          </div>
          <span className="text-xs font-medium text-muted-foreground">{analytics.heatmap.reduce((sum, item) => sum + item.count, 0)} ratings</span>
        </div>
        <div className="mt-4 overflow-x-auto pb-1">
          <div className="grid min-w-[620px] grid-flow-col grid-rows-7 gap-1" role="img" aria-label="Daily study rating heatmap for the last 365 days">
            {Array.from({ length: heatmapLeading }, (_, index) => <div key={`leading-${index}`} className="size-3" aria-hidden="true" />)}
            {analytics.heatmap.map((item) => (
              <div
                key={item.date}
                className={`size-3 rounded-[3px] ${item.count > 0 ? "bg-energy" : "bg-muted"}`}
                style={item.count > 0 ? { opacity: heatOpacity(item.count, maxHeat) } : undefined}
                aria-label={`${shortDate(item.date)}: ${item.count} ratings`}
                title={`${shortDate(item.date)}: ${item.count} ratings`}
              />
            ))}
          </div>
        </div>
        <div className="mt-2 flex justify-between text-[10px] text-muted-foreground"><span>Less</span><span>More</span></div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-[22px] border border-black/[0.065] bg-card p-4 shadow-[0_18px_46px_-42px_rgba(0,0,0,0.45)] dark:border-white/[0.09] sm:p-5" aria-labelledby="stability-title">
          <h2 id="stability-title" className="flex items-center gap-2 text-base font-semibold"><BrainCircuit className="size-4" /> Memory stability</h2>
          <p className="mt-1 text-xs text-muted-foreground">Current FSRS stability for cards in this deck.</p>
          <div className="mt-5 flex flex-col gap-3">
            {analytics.stability.map((item) => (
              <div key={item.label} className="grid grid-cols-[4.5rem_minmax(0,1fr)_2rem] items-center gap-2 text-xs">
                <span className="text-muted-foreground">{item.label}</span>
                <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true"><div className="h-full rounded-full bg-energy" style={{ width: `${(item.count / maxStability) * 100}%` }} /></div>
                <span className="text-right font-mono tabular-nums">{item.count}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[22px] border border-black/[0.065] bg-card p-4 shadow-[0_18px_46px_-42px_rgba(0,0,0,0.45)] dark:border-white/[0.09] sm:p-5" aria-labelledby="difficulty-title">
          <h2 id="difficulty-title" className="flex items-center gap-2 text-base font-semibold"><ChartNoAxesCombined className="size-4" /> Difficulty map</h2>
          <p className="mt-1 text-xs text-muted-foreground">Difficulty against stability, one point per scheduled card.</p>
          <svg className="mt-4 h-52 w-full overflow-visible" viewBox="0 0 100 100" role="img" aria-label="Difficulty and stability scatter plot">
            <line x1="8" y1="92" x2="96" y2="92" className="stroke-border" strokeWidth="0.7" />
            <line x1="8" y1="8" x2="8" y2="92" className="stroke-border" strokeWidth="0.7" />
            {analytics.difficulty.map((item) => {
              const x = 8 + (Math.min(maxDifficulty, Math.max(0, item.difficulty)) / maxDifficulty) * 88
              const y = 92 - (Math.log10(1 + Math.max(0, item.stability)) / Math.log10(1 + maxStabilityDays)) * 84
              return <circle key={item.id} cx={x} cy={y} r="1.9" className="fill-energy stroke-background" strokeWidth="0.55"><title>{`Difficulty ${item.difficulty.toFixed(1)}, stability ${item.stability.toFixed(1)} days`}</title></circle>
            })}
            <text x="8" y="99" className="fill-muted-foreground text-[4px]">Easy</text>
            <text x="88" y="99" className="fill-muted-foreground text-[4px]">Hard</text>
            <text x="10" y="7" className="fill-muted-foreground text-[4px]">Long stability</text>
          </svg>
        </section>
      </div>

      <section className="rounded-[22px] border border-black/[0.065] bg-card p-4 shadow-[0_18px_46px_-42px_rgba(0,0,0,0.45)] dark:border-white/[0.09] sm:p-5" aria-labelledby="forecast-title">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="forecast-title" className="text-base font-semibold">Upcoming load</h2>
            <p className="mt-1 text-xs text-muted-foreground">Cards currently scheduled for the next 30 days.</p>
          </div>
          <div className="flex gap-3 text-right text-xs"><span><strong className="block text-base">{analytics.forecastTotals.seven}</strong><span className="text-muted-foreground">7 days</span></span><span><strong className="block text-base">{analytics.forecastTotals.fourteen}</strong><span className="text-muted-foreground">14 days</span></span><span><strong className="block text-base">{analytics.forecastTotals.thirty}</strong><span className="text-muted-foreground">30 days</span></span></div>
        </div>
        <div className="mt-5 overflow-x-auto pb-1">
          <div className="grid min-w-[620px] grid-cols-[repeat(30,minmax(0,1fr))] h-32 items-end gap-1.5" role="img" aria-label="Daily scheduled card forecast for the next 30 days">
            {analytics.forecast.map((item) => (
              <div key={item.date} className="group flex h-full items-end" title={`${shortDate(item.date)}: ${item.count} cards`} aria-label={`${shortDate(item.date)}: ${item.count} cards`}>
                <div className="w-full min-w-1 rounded-t bg-energy/75 transition-[height]" style={{ height: `${Math.max(item.count > 0 ? 8 : 2, (item.count / maxForecast) * 100)}%` }} />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
