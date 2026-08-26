"use client"

import { useMemo, useState } from "react"
import { Check, RotateCcw, Search, Sparkles } from "lucide-react"

import { cardLabel, cardMatchesQuery, cardSubtitle, type Card } from "@/lib/deck"
import { useVirtualWindow } from "@/components/use-virtual-window"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

const PICKER_ROW = 64
const rowPastels = [
  "bg-[#dff1ff] dark:bg-[#1e3b55]",
  "bg-[#e5f8c4] dark:bg-[#314423]",
  "bg-[#fff0b9] dark:bg-[#51431f]",
  "bg-[#ffe0e7] dark:bg-[#512e38]",
] as const

type SharedProps = {
  cards: Card[]
  fields: string[]
  referenceIds: string[]
  onChange: (ids: string[]) => void
}

function toggleId(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]
}

export function ReferenceNotesBar({
  referenceIds,
  onOpenPicker,
}: {
  cards?: Card[]
  fields?: string[]
  referenceIds: string[]
  onChange?: (ids: string[]) => void
  onOpenPicker: () => void
}) {
  const count = referenceIds.length

  return (
    <button
      type="button"
      aria-label="选择参考笔记"
      onClick={onOpenPicker}
      className={cn(
        "flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-black tracking-tight transition-all active:scale-[0.97]",
        count > 0
          ? "bg-[#ffe39a] text-[#654600] shadow-[0_8px_20px_-16px_rgba(0,0,0,0.7)] dark:bg-[#68551f] dark:text-[#ffedb8]"
          : "bg-black/[0.055] text-foreground/65 hover:bg-black/[0.08] hover:text-foreground dark:bg-white/[0.08] dark:hover:bg-white/[0.12]"
      )}
    >
      <Sparkles className="size-3.5" />
      <span>参考范例</span>
      {count > 0 ? (
        <span className="ml-0.5 flex min-w-5 items-center justify-center rounded-full bg-black px-1.5 font-mono text-[10px] font-black leading-5 text-white dark:bg-white dark:text-black">
          {count}
        </span>
      ) : null}
    </button>
  )
}

export function ReferenceNotesPicker({
  cards,
  fields,
  referenceIds,
  onChange,
  open,
  onOpenChange,
}: SharedProps & { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [query, setQuery] = useState("")
  const selectedSet = useMemo(() => new Set(referenceIds), [referenceIds])
  const filtered = useMemo(
    () => cards.filter((card) => cardMatchesQuery(card, fields, query)),
    [cards, fields, query]
  )
  const isLargeList = filtered.length > 80
  const {
    containerRef,
    start,
    end,
    padTop,
    padBottom,
  } = useVirtualWindow(filtered.length, PICKER_ROW, 0, open && isLargeList)

  const items = isLargeList ? filtered.slice(start, end) : filtered

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (next) setQuery("")
        onOpenChange(next)
      }}
    >
      <SheetContent
        side="bottom"
        className="flex h-[88dvh] max-h-[760px] flex-col rounded-t-[2.4rem] border-0 bg-[#fffaf5] p-0 shadow-[0_-28px_80px_-46px_rgba(0,0,0,0.68)] dark:bg-[#171512] sm:mx-auto sm:max-w-lg"
      >
        <SheetHeader className="shrink-0 px-5 pb-3 pt-5">
          <div className="mb-1 flex items-center justify-between gap-3 pr-8">
            <div>
              <div className="mb-1 inline-flex rounded-full bg-[#ff9bd6]/30 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-foreground">
                style memory
              </div>
              <SheetTitle className="text-3xl font-black tracking-[-0.055em]">参考范例</SheetTitle>
            </div>
            <Badge className="h-8 bg-black px-3 text-xs font-black text-white dark:bg-white dark:text-black">
              {referenceIds.length} selected
            </Badge>
          </div>
          <SheetDescription className="max-w-md text-xs font-medium leading-5 text-muted-foreground">
            选几张你喜欢的笔记作为 AI 范例，补全与批量生成会自动学习它们的排版、音标、释义与例句风格。
          </SheetDescription>
          {referenceIds.length > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-1 h-8 w-fit px-2 text-xs font-black text-muted-foreground"
              onClick={() => onChange([])}
            >
              <RotateCcw className="size-3" />
              清空选择
            </Button>
          ) : null}
        </SheetHeader>

        <div className="shrink-0 px-4 pb-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-foreground/40" />
            <Input
              value={query}
              aria-label="搜索参考笔记"
              placeholder="搜索笔记…"
              className="h-12 rounded-full border-0 bg-white pl-10 pr-4 text-sm font-semibold shadow-[0_10px_28px_-24px_rgba(0,0,0,0.7)] dark:bg-white/[0.07]"
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        </div>

        <div
          ref={isLargeList ? containerRef : undefined}
          data-testid="reference-notes-list"
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3"
        >
          {filtered.length === 0 ? (
            <div className="mx-1 flex min-h-48 flex-col items-center justify-center rounded-[1.8rem] bg-[#dff1ff] px-6 text-center dark:bg-[#1e3b55]">
              <span className="mb-3 flex size-12 items-center justify-center rounded-full bg-black text-white dark:bg-white dark:text-black">
                <Search className="size-5" />
              </span>
              <p className="text-sm font-black tracking-tight text-foreground">
                {query ? `没有匹配「${query}」的笔记` : "卡包中还没有笔记"}
              </p>
              <p className="mt-1 text-xs font-medium text-muted-foreground">换个关键词试试，或者先添加几张笔记。</p>
            </div>
          ) : (
            <div
              style={isLargeList ? { paddingTop: padTop, paddingBottom: padBottom } : undefined}
              className="space-y-2"
            >
              {items.map((card, index) => {
                const active = selectedSet.has(card.id)
                const label = cardLabel(card, fields)
                const subtitle = cardSubtitle(card, fields)
                return (
                  <button
                    key={card.id}
                    type="button"
                    aria-pressed={active}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-[1.45rem] px-4 py-3 text-left transition-all active:scale-[0.985]",
                      active
                        ? "bg-black text-white shadow-[0_14px_34px_-26px_rgba(0,0,0,0.88)] dark:bg-white dark:text-black"
                        : rowPastels[index % rowPastels.length]
                    )}
                    onClick={() => onChange(toggleId(referenceIds, card.id))}
                  >
                    <span
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-full transition-colors",
                        active
                          ? "bg-white text-black dark:bg-black dark:text-white"
                          : "bg-white/60 text-foreground/40 dark:bg-black/15"
                      )}
                    >
                      {active ? <Check className="size-4 stroke-[3]" /> : <Sparkles className="size-3.5" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn("block truncate text-sm font-black tracking-[-0.025em]", active ? "text-current" : "text-foreground")}>
                        {label}
                      </span>
                      {subtitle ? (
                        <span className={cn("mt-0.5 block truncate text-[11px] font-medium", active ? "text-white/65 dark:text-black/60" : "text-foreground/50")}>
                          {subtitle}
                        </span>
                      ) : null}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <SheetFooter className="shrink-0 bg-[#fffaf5]/96 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl dark:bg-[#171512]/96">
          <Button
            type="button"
            className="h-14 w-full rounded-full bg-black text-sm font-black text-white hover:bg-black/85 dark:bg-white dark:text-black dark:hover:bg-white/90"
            onClick={() => onOpenChange(false)}
          >
            完成 · {referenceIds.length} 张已选
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
