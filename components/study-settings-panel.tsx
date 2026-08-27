"use client"

import { Minus, Plus, RotateCcw } from "lucide-react"

import { type Deck, type FsrsDeckState } from "@/lib/deck"
import { updateFsrsSettings } from "@/lib/fsrs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"

const DEFAULT_FSRS_VALUES = {
  requestRetention: 0.9,
  dailyNewLimit: 20,
  dailyReviewLimit: 200,
  maximumInterval: 36500,
}

const RETENTION_PRESETS = [
  { value: 0.85, label: "Relaxed", note: "Fewer reviews" },
  { value: 0.9, label: "Balanced", note: "Recommended" },
  { value: 0.92, label: "Focused", note: "Stronger recall" },
  { value: 0.95, label: "Intense", note: "High review load" },
] as const

const RETENTION_MIN = 70
const RETENTION_MAX = 99
const RETENTION_MARKS = [
  { value: 70, label: "70 · light" },
  { value: 90, label: "90 · balanced" },
  { value: 99, label: "99 · strongest" },
] as const

function retentionMarkPosition(value: number): number {
  return ((value - RETENTION_MIN) / (RETENTION_MAX - RETENTION_MIN)) * 100
}

function Stepper({
  value,
  unit,
  min,
  max,
  step,
  onChange,
}: {
  value: number
  unit: string
  min: number
  max: number
  step: number
  onChange: (next: number) => void
}) {
  return (
    <div className="flex items-center gap-1 rounded-[13px] border border-black/[0.06] bg-card p-1 dark:border-white/[0.08]">
      <button type="button" onClick={() => onChange(Math.max(min, value - step))} className="flex size-8 items-center justify-center rounded-[9px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label={`Decrease by ${step} ${unit}`}>
        <Minus className="size-3.5" />
      </button>
      <div className="relative">
        <Input type="number" min={min} max={max} value={value} onChange={(event) => onChange(Math.max(min, Math.min(max, Number(event.target.value) || min)))} className="h-8 w-20 border-0 bg-transparent px-1 pr-6 text-center font-mono text-xs font-semibold shadow-none focus-visible:ring-0" />
        <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] font-medium text-muted-foreground">{unit}</span>
      </div>
      <button type="button" onClick={() => onChange(Math.min(max, value + step))} className="flex size-8 items-center justify-center rounded-[9px] bg-foreground text-background transition-transform active:scale-[0.96]" aria-label={`Increase by ${step} ${unit}`}>
        <Plus className="size-3.5" />
      </button>
    </div>
  )
}

export function StudySettingsPanel({ deck, fsrsSettings, onDeckChange }: { deck: Deck; fsrsSettings: FsrsDeckState; onDeckChange: (deck: Deck) => void }) {
  const currentRetentionPercent = Math.round(fsrsSettings.requestRetention * 100)
  const update = (partial: Partial<FsrsDeckState>) => onDeckChange(updateFsrsSettings(deck, partial))
  const resetDefaults = () => update(DEFAULT_FSRS_VALUES)
  const retentionHint = currentRetentionPercent >= 95
    ? "Higher retention keeps memories stronger, but creates a heavier daily review load. Best for short-term exam prep."
    : currentRetentionPercent <= 85
      ? "A lighter workload with more acceptable forgetting."
      : "The recommended FSRS range balances long-term retention with a sustainable review load."

  return (
    <div className="mx-auto w-full max-w-xl space-y-5 pb-12">
      <section className="rounded-[22px] border border-black/[0.065] bg-card p-5 shadow-[0_18px_46px_-42px_rgba(0,0,0,0.45)] dark:border-white/[0.09] sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground"><span className="size-2 rounded-full bg-energy" />Memory target</span>
          <Button type="button" size="sm" variant="ghost" className="h-8 px-2.5 text-xs text-muted-foreground" onClick={resetDefaults}><RotateCcw className="size-3.5" />Reset</Button>
        </div>

        <div className="mt-5 flex items-end gap-2">
          <span className="text-[64px] font-semibold leading-none tracking-[-0.075em] sm:text-[72px]">{currentRetentionPercent}</span>
          <span className="pb-1.5 text-xl font-semibold text-muted-foreground">%</span>
        </div>
        <h2 className="mt-3 text-xl font-semibold tracking-[-0.035em]">Target retention</h2>
        <p className="mt-1.5 max-w-md text-xs leading-5 text-muted-foreground">{retentionHint}</p>

        <div className="mt-5 rounded-[16px] border border-black/[0.055] bg-background/55 p-3 dark:border-white/[0.07]">
          <Slider
            value={[currentRetentionPercent]}
            min={RETENTION_MIN}
            max={RETENTION_MAX}
            step={1}
            aria-label="Target retention"
            aria-valuetext={`${currentRetentionPercent}% retention`}
            onValueChange={(value) => update({ requestRetention: (value[0] ?? 90) / 100 })}
            className="py-2 [&_[data-slot=slider-range]]:bg-energy [&_[data-slot=slider-thumb]]:border-4 [&_[data-slot=slider-thumb]]:border-card [&_[data-slot=slider-thumb]]:bg-foreground [&_[data-slot=slider-track]]:bg-foreground/10"
          />
          <div className="relative mt-1 h-5 font-mono text-[9px] font-medium text-muted-foreground" data-testid="retention-scale">
            {RETENTION_MARKS.map((mark) => (
              <span
                key={mark.value}
                data-retention-mark={mark.value}
                style={{ left: `${retentionMarkPosition(mark.value)}%` }}
                className={cn(
                  "absolute top-0 whitespace-nowrap",
                  mark.value === RETENTION_MIN
                    ? "translate-x-0 text-left"
                    : mark.value === RETENTION_MAX
                      ? "-translate-x-full text-right"
                      : "-translate-x-1/2 text-center"
                )}
              >
                {mark.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="mb-3 px-1"><p className="text-[10px] font-semibold uppercase tracking-[0.17em] text-muted-foreground">Study rhythm</p><h3 className="mt-1 text-xl font-semibold tracking-[-0.035em]">Choose a pace</h3></div>
        <div className="grid grid-cols-2 gap-2.5">
          {RETENTION_PRESETS.map((preset) => {
            const active = Math.abs(fsrsSettings.requestRetention - preset.value) < 0.005
            return (
              <button key={preset.value} type="button" aria-pressed={active} onClick={() => update({ requestRetention: preset.value })} className={cn("relative min-h-24 rounded-[18px] border p-4 text-left transition-[background-color,border-color,transform] active:scale-[0.99]", active ? "border-energy/40 bg-energy/18" : "border-black/[0.065] bg-card hover:bg-muted/45 dark:border-white/[0.09]")}>
                <span className="font-mono text-[10px] font-medium text-muted-foreground">{Math.round(preset.value * 100)}%</span>
                <span className="mt-3 block text-lg font-semibold tracking-[-0.03em]">{preset.label}</span>
                <span className="mt-0.5 block text-[11px] text-muted-foreground">{preset.note}</span>
                {active ? <span className="absolute right-3 top-3 size-2 rounded-full bg-energy" aria-hidden="true" /> : null}
              </button>
            )
          })}
        </div>
      </section>

      <section>
        <div className="mb-3 px-1"><p className="text-[10px] font-semibold uppercase tracking-[0.17em] text-muted-foreground">Daily limits</p><h3 className="mt-1 text-xl font-semibold tracking-[-0.035em]">Daily workload</h3></div>
        <div className="overflow-hidden rounded-[20px] border border-black/[0.065] bg-card dark:border-white/[0.09]">
          <div className="flex items-center justify-between gap-3 p-4">
            <div className="min-w-0"><Label className="text-[15px] font-semibold tracking-[-0.02em]">New notes</Label><p className="mt-1 text-[11px] text-muted-foreground">Maximum new notes introduced each day.</p></div>
            <Stepper value={fsrsSettings.dailyNewLimit} unit="cards" min={0} max={999} step={5} onChange={(dailyNewLimit) => update({ dailyNewLimit })} />
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-black/[0.055] p-4 dark:border-white/[0.07]">
            <div className="min-w-0"><Label className="text-[15px] font-semibold tracking-[-0.02em]">Reviews</Label><p className="mt-1 text-[11px] text-muted-foreground">Maximum due reviews completed each day.</p></div>
            <Stepper value={fsrsSettings.dailyReviewLimit} unit="cards" min={0} max={9999} step={20} onChange={(dailyReviewLimit) => update({ dailyReviewLimit })} />
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-black/[0.055] p-4 dark:border-white/[0.07]">
            <div className="min-w-0"><Label htmlFor="max-interval-input" className="text-[15px] font-semibold tracking-[-0.02em]">Maximum interval</Label><p className="mt-1 text-[11px] text-muted-foreground">Caps how far even very familiar cards can be scheduled.</p></div>
            <div className="relative shrink-0"><Input id="max-interval-input" type="number" min="1" max="36500" value={fsrsSettings.maximumInterval} onChange={(event) => update({ maximumInterval: Math.max(1, Math.min(36500, Number(event.target.value) || 1)) })} className="h-10 w-28 pr-10 text-center font-mono text-xs font-semibold" /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-medium text-muted-foreground">days</span></div>
          </div>
        </div>
      </section>
    </div>
  )
}
