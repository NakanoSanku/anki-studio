"use client"

import { Minus, Plus, RotateCcw, Sparkles } from "lucide-react"

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
  { value: 0.85, label: "轻松", note: "更少复习", color: "bg-[#dff1ff] text-[#174f85] dark:bg-[#244d74] dark:text-[#dceeff]" },
  { value: 0.9, label: "推荐", note: "平衡模式", color: "bg-[#d8f4aa] text-[#315f18] dark:bg-[#385528] dark:text-[#e4f8c5]" },
  { value: 0.92, label: "进阶", note: "更稳记忆", color: "bg-[#ffe39a] text-[#654600] dark:bg-[#68551f] dark:text-[#ffedb8]" },
  { value: 0.95, label: "冲刺", note: "高频复习", color: "bg-[#ffd8df] text-[#761c31] dark:bg-[#6a2835] dark:text-[#ffdce3]" },
] as const

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
    <div className="flex items-center gap-1.5 rounded-full bg-white/55 p-1 dark:bg-black/15">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - step))}
        className="flex size-8 items-center justify-center rounded-full bg-white/70 transition-transform active:scale-90 dark:bg-white/10"
        aria-label={`减少 ${step}${unit}`}
      >
        <Minus className="size-3.5" />
      </button>
      <div className="relative">
        <Input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(event) => onChange(Math.max(min, Math.min(max, Number(event.target.value) || min)))}
          className="h-8 w-20 border-0 bg-transparent px-1 pr-6 text-center font-mono text-xs font-black shadow-none focus-visible:ring-0"
        />
        <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] font-bold opacity-45">
          {unit}
        </span>
      </div>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + step))}
        className="flex size-8 items-center justify-center rounded-full bg-black text-white transition-transform active:scale-90 dark:bg-white dark:text-black"
        aria-label={`增加 ${step}${unit}`}
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  )
}

export function StudySettingsPanel({
  deck,
  fsrsSettings,
  onDeckChange,
}: {
  deck: Deck
  fsrsSettings: FsrsDeckState
  onDeckChange: (deck: Deck) => void
}) {
  const currentRetentionPercent = Math.round(fsrsSettings.requestRetention * 100)

  const update = (partial: Partial<FsrsDeckState>) => {
    onDeckChange(updateFsrsSettings(deck, partial))
  }

  const resetDefaults = () => update(DEFAULT_FSRS_VALUES)

  const retentionHint = currentRetentionPercent >= 95
    ? "记得更牢，但每天会看到更多旧卡。适合考试前短期冲刺。"
    : currentRetentionPercent <= 85
      ? "学习负担会明显变轻，但允许遗忘更多内容。"
      : "FSRS 推荐的平衡区间，在记忆牢固度和每日复习量之间取中间值。"

  return (
    <div className="mx-auto w-full max-w-xl space-y-4 pb-12">
      <section className="relative overflow-hidden rounded-[2.25rem] bg-[#d8f4aa] p-5 text-[#244c12] shadow-[0_24px_64px_-44px_rgba(0,0,0,0.72)] dark:bg-[#385528] dark:text-[#e7f8c8] sm:p-6">
        <div className="pointer-events-none absolute -right-12 -top-8 size-40 rounded-[46%_54%_61%_39%/58%_43%_57%_42%] bg-[#ffe39a] opacity-85 dark:bg-[#68551f]" aria-hidden="true" />
        <div className="relative z-10">
          <div className="flex items-center justify-between gap-3">
            <span className="rounded-full bg-white/45 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] dark:bg-black/15">
              memory target
            </span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-9 bg-white/45 px-3 text-xs font-black text-current hover:bg-white/70 hover:text-current dark:bg-black/15 dark:hover:bg-black/25"
              onClick={resetDefaults}
            >
              <RotateCcw className="size-3.5" />
              恢复默认
            </Button>
          </div>

          <div className="mt-6 flex items-end gap-3">
            <span className="text-6xl font-black leading-none tracking-[-0.085em] sm:text-7xl">{currentRetentionPercent}</span>
            <span className="pb-1 text-2xl font-black opacity-50">%</span>
          </div>
          <h2 className="mt-3 text-xl font-black tracking-[-0.045em]">目标保留率</h2>
          <p className="mt-1.5 max-w-md text-xs font-semibold leading-5 opacity-60">{retentionHint}</p>

          <div className="mt-6 rounded-[1.5rem] bg-white/50 p-3 dark:bg-black/15">
            <Slider
              value={[currentRetentionPercent]}
              min={70}
              max={99}
              step={1}
              onValueChange={(value) => update({ requestRetention: (value[0] ?? 90) / 100 })}
              className="py-2 [&_[data-slot=slider-range]]:bg-black dark:[&_[data-slot=slider-range]]:bg-white [&_[data-slot=slider-thumb]]:border-4 [&_[data-slot=slider-thumb]]:border-white [&_[data-slot=slider-thumb]]:bg-black dark:[&_[data-slot=slider-thumb]]:border-[#385528] dark:[&_[data-slot=slider-thumb]]:bg-white [&_[data-slot=slider-track]]:bg-black/10 dark:[&_[data-slot=slider-track]]:bg-white/15"
            />
            <div className="mt-1 flex justify-between font-mono text-[9px] font-bold opacity-40">
              <span>70 · 轻负担</span>
              <span>90 · 推荐</span>
              <span>99 · 最牢固</span>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-2.5 px-1">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">quick mode</p>
          <h3 className="mt-0.5 text-xl font-black tracking-[-0.045em]">选择学习节奏</h3>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {RETENTION_PRESETS.map((preset) => {
            const active = Math.abs(fsrsSettings.requestRetention - preset.value) < 0.005
            return (
              <button
                key={preset.value}
                type="button"
                aria-pressed={active}
                onClick={() => update({ requestRetention: preset.value })}
                className={cn(
                  "relative min-h-28 rounded-[1.7rem] p-4 text-left transition-transform active:scale-[0.985]",
                  preset.color,
                  active && "ring-4 ring-black dark:ring-white"
                )}
              >
                {active ? (
                  <span className="absolute right-3 top-3 flex size-7 items-center justify-center rounded-full bg-black text-white dark:bg-white dark:text-black">
                    <Sparkles className="size-3.5" />
                  </span>
                ) : null}
                <span className="font-mono text-[10px] font-black opacity-45">{Math.round(preset.value * 100)}%</span>
                <span className="mt-4 block text-lg font-black tracking-[-0.04em]">{preset.label}</span>
                <span className="mt-0.5 block text-[11px] font-semibold opacity-55">{preset.note}</span>
              </button>
            )
          })}
        </div>
      </section>

      <section>
        <div className="mb-2.5 px-1">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">daily limits</p>
          <h3 className="mt-0.5 text-xl font-black tracking-[-0.045em]">每天学多少</h3>
        </div>

        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-3 rounded-[1.8rem] bg-[#dff1ff] p-4 text-[#174f85] dark:bg-[#244d74] dark:text-[#dceeff]">
            <div className="min-w-0">
              <Label className="text-base font-black tracking-[-0.035em] text-current">每日新卡</Label>
              <p className="mt-0.5 text-[11px] font-semibold opacity-55">每天最多引入多少张陌生卡片</p>
            </div>
            <Stepper
              value={fsrsSettings.dailyNewLimit}
              unit="张"
              min={0}
              max={999}
              step={5}
              onChange={(dailyNewLimit) => update({ dailyNewLimit })}
            />
          </div>

          <div className="flex items-center justify-between gap-3 rounded-[1.8rem] bg-[#ffe39a] p-4 text-[#654600] dark:bg-[#68551f] dark:text-[#ffedb8]">
            <div className="min-w-0">
              <Label className="text-base font-black tracking-[-0.035em] text-current">每日复习</Label>
              <p className="mt-0.5 text-[11px] font-semibold opacity-55">到期卡片每天最多处理多少张</p>
            </div>
            <Stepper
              value={fsrsSettings.dailyReviewLimit}
              unit="张"
              min={0}
              max={9999}
              step={20}
              onChange={(dailyReviewLimit) => update({ dailyReviewLimit })}
            />
          </div>

          <div className="flex items-center justify-between gap-3 rounded-[1.8rem] bg-[#ffd8df] p-4 text-[#761c31] dark:bg-[#6a2835] dark:text-[#ffdce3]">
            <div className="min-w-0">
              <Label htmlFor="max-interval-input" className="text-base font-black tracking-[-0.035em] text-current">最长间隔</Label>
              <p className="mt-0.5 text-[11px] font-semibold opacity-55">再熟悉的卡也不会超过这个间隔</p>
            </div>
            <div className="relative shrink-0 rounded-full bg-white/55 p-1.5 dark:bg-black/15">
              <Input
                id="max-interval-input"
                type="number"
                min="1"
                max="36500"
                value={fsrsSettings.maximumInterval}
                onChange={(event) => update({ maximumInterval: Math.max(1, Math.min(36500, Number(event.target.value) || 1)) })}
                className="h-9 w-28 border-0 bg-transparent pr-8 text-center font-mono text-xs font-black shadow-none focus-visible:ring-0"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-bold opacity-45">天</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
