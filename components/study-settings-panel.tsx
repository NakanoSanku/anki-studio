"use client"

import { Minus, Plus, RotateCcw } from "lucide-react"

import { type Deck, type FsrsDeckState } from "@/lib/deck"
import { updateFsrsSettings } from "@/lib/fsrs"
import { Badge } from "@/components/ui/badge"
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
  { value: 0.85, label: "85% 轻松" },
  { value: 0.9, label: "90% 推荐" },
  { value: 0.92, label: "92% 进阶" },
  { value: 0.95, label: "95% 冲刺" },
]

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

  const resetDefaults = () => {
    update(DEFAULT_FSRS_VALUES)
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-3.5 pb-10">
      {/* Card 1: Retention Rate */}
      <div className="overflow-hidden rounded-2xl bg-card ring-1 ring-border/70 shadow-xs">
        <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">目标保留率</h2>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="border-primary/30 bg-primary/5 font-mono text-xs font-semibold text-primary"
            >
              {currentRetentionPercent}%
            </Badge>
            <button
              type="button"
              onClick={resetDefaults}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <RotateCcw className="size-3" />
              <span>默认</span>
            </button>
          </div>
        </div>

        <div className="p-4 space-y-3">
          {/* Segmented Quick Switcher */}
          <div className="grid grid-cols-4 gap-1 rounded-xl bg-muted/40 p-1 text-xs">
            {RETENTION_PRESETS.map((preset) => {
              const active = Math.abs(fsrsSettings.requestRetention - preset.value) < 0.005
              return (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => update({ requestRetention: preset.value })}
                  className={cn(
                    "rounded-lg py-1.5 text-center transition-all",
                    active
                      ? "bg-card font-semibold text-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {preset.label}
                </button>
              )
            })}
          </div>

          {/* Precision Slider */}
          <div className="space-y-2 pt-1">
            <Slider
              value={[currentRetentionPercent]}
              min={70}
              max={99}
              step={1}
              onValueChange={(val) => {
                const next = (val[0] ?? 90) / 100
                update({ requestRetention: next })
              }}
              className="py-1"
            />
            <div className="relative h-4 text-[10px] text-muted-foreground font-mono select-none">
              <span className="absolute left-0">70% 极低负担</span>
              <span
                className="absolute -translate-x-1/2 font-medium text-foreground/80"
                style={{ left: `${((90 - 70) / (99 - 70)) * 100}%` }}
              >
                90% 推荐
              </span>
              <span className="absolute right-0">99% 极高牢固</span>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {currentRetentionPercent >= 95
              ? "💡 设定 95%+ 会显著提升复习频率与卡片量，适合短期高强度冲刺。"
              : currentRetentionPercent <= 85
                ? "💡 设定 85% 以下可大幅减轻每日复习压力，适合时间有限的日常学习。"
                : "💡 90% 是 FSRS 算法推荐的标准保留率，在记忆牢固度与复习量之间达到最佳平衡。"}
          </p>
        </div>
      </div>

      {/* Card 2: Daily Quotas & Intervals (Clean Inset Grouped Rows) */}
      <div className="overflow-hidden rounded-2xl bg-card ring-1 ring-border/70 shadow-xs">
        <div className="border-b border-border/70 px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">每日配额与间隔</h2>
        </div>

        <div className="divide-y divide-border/60">
          {/* Daily New Limit */}
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <Label htmlFor="daily-new-input" className="text-xs font-medium text-foreground">
                每日新卡
              </Label>
              <p className="text-[11px] text-muted-foreground">每天引入的新卡片数量上限</p>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => update({ dailyNewLimit: Math.max(0, fsrsSettings.dailyNewLimit - 5) })}
                className="flex size-7 items-center justify-center rounded-lg border border-border/70 bg-muted/20 text-muted-foreground hover:text-foreground active:scale-95 transition-all"
                title="减少 5 张"
              >
                <Minus className="size-3" />
              </button>
              <div className="relative">
                <Input
                  id="daily-new-input"
                  type="number"
                  min="0"
                  max="999"
                  value={fsrsSettings.dailyNewLimit}
                  onChange={(e) =>
                    update({ dailyNewLimit: Math.max(0, Math.min(999, Number(e.target.value) || 0)) })
                  }
                  className="h-7 w-20 rounded-lg bg-muted/20 text-center font-mono text-xs pr-6"
                />
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                  张
                </span>
              </div>
              <button
                type="button"
                onClick={() => update({ dailyNewLimit: Math.min(999, fsrsSettings.dailyNewLimit + 5) })}
                className="flex size-7 items-center justify-center rounded-lg border border-border/70 bg-muted/20 text-muted-foreground hover:text-foreground active:scale-95 transition-all"
                title="增加 5 张"
              >
                <Plus className="size-3" />
              </button>
            </div>
          </div>

          {/* Daily Review Limit */}
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <Label htmlFor="daily-review-input" className="text-xs font-medium text-foreground">
                每日复习
              </Label>
              <p className="text-[11px] text-muted-foreground">每天复习到期卡片数量上限</p>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => update({ dailyReviewLimit: Math.max(0, fsrsSettings.dailyReviewLimit - 20) })}
                className="flex size-7 items-center justify-center rounded-lg border border-border/70 bg-muted/20 text-muted-foreground hover:text-foreground active:scale-95 transition-all"
                title="减少 20 张"
              >
                <Minus className="size-3" />
              </button>
              <div className="relative">
                <Input
                  id="daily-review-input"
                  type="number"
                  min="0"
                  max="9999"
                  value={fsrsSettings.dailyReviewLimit}
                  onChange={(e) =>
                    update({
                      dailyReviewLimit: Math.max(0, Math.min(9999, Number(e.target.value) || 0)),
                    })
                  }
                  className="h-7 w-20 rounded-lg bg-muted/20 text-center font-mono text-xs pr-6"
                />
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                  张
                </span>
              </div>
              <button
                type="button"
                onClick={() => update({ dailyReviewLimit: Math.min(9999, fsrsSettings.dailyReviewLimit + 20) })}
                className="flex size-7 items-center justify-center rounded-lg border border-border/70 bg-muted/20 text-muted-foreground hover:text-foreground active:scale-95 transition-all"
                title="增加 20 张"
              >
                <Plus className="size-3" />
              </button>
            </div>
          </div>

          {/* Maximum Interval */}
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <Label htmlFor="max-interval-input" className="text-xs font-medium text-foreground">
                最长间隔
              </Label>
              <p className="text-[11px] text-muted-foreground">卡片复习间隔的最长上限天数</p>
            </div>

            <div className="relative">
              <Input
                id="max-interval-input"
                type="number"
                min="1"
                max="36500"
                value={fsrsSettings.maximumInterval}
                onChange={(e) =>
                  update({
                    maximumInterval: Math.max(1, Math.min(36500, Number(e.target.value) || 1)),
                  })
                }
                className="h-7 w-24 rounded-lg bg-muted/20 text-center font-mono text-xs pr-6"
              />
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                天
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
