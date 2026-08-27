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
        "flex h-8 items-center gap-1.5 rounded-[11px] border px-2.5 text-xs font-medium transition-[background-color,border-color,color,transform] active:scale-[0.98]",
        count > 0
          ? "border-energy/35 bg-energy/15 text-foreground"
          : "border-black/[0.06] bg-card text-muted-foreground hover:bg-muted hover:text-foreground dark:border-white/[0.08]"
      )}
    >
      <Sparkles className="size-3.5" />
      <span>参考范例</span>
      {count > 0 ? (
        <span className="ml-0.5 flex min-w-5 items-center justify-center rounded-[7px] bg-energy px-1.5 font-mono text-[10px] font-semibold leading-5 text-black">
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
        className="flex h-[88dvh] max-h-[760px] flex-col p-0 sm:mx-auto sm:max-w-lg"
      >
        <SheetHeader className="shrink-0 px-5 pb-3 pt-5">
          <div className="mb-1 flex items-center justify-between gap-3 pr-8">
            <div className="min-w-0">
              <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.17em] text-muted-foreground">
                <span className="size-2 rounded-full bg-energy" />
                Style memory
              </div>
              <SheetTitle className="text-[28px] font-semibold tracking-[-0.045em]">参考范例</SheetTitle>
            </div>
            <Badge className="h-8 border border-black/[0.06] bg-muted px-3 text-xs font-medium text-foreground shadow-none dark:border-white/[0.08]">
              {referenceIds.length} selected
            </Badge>
          </div>
          <SheetDescription className="max-w-md text-xs leading-5">
            选几张你喜欢的笔记作为 AI 范例，补全与批量生成会参考它们的排版、音标、释义与例句风格。
          </SheetDescription>
          {referenceIds.length > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-1 h-8 w-fit px-2 text-xs text-muted-foreground"
              onClick={() => onChange([])}
            >
              <RotateCcw className="size-3" />
              清空选择
            </Button>
          ) : null}
        </SheetHeader>

        <div className="shrink-0 px-4 pb-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              aria-label="搜索参考笔记"
              placeholder="搜索笔记…"
              className="h-11 bg-background pl-10 pr-4 text-sm"
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
            <div className="mx-1 flex min-h-48 flex-col items-center justify-center rounded-[18px] border border-black/[0.06] bg-muted/45 px-6 text-center dark:border-white/[0.08]">
              <span className="mb-3 flex size-11 items-center justify-center rounded-[13px] bg-card text-muted-foreground">
                <Search className="size-5" />
              </span>
              <p className="text-sm font-semibold tracking-[-0.015em] text-foreground">
                {query ? `没有匹配「${query}」的笔记` : "卡包中还没有笔记"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">换个关键词试试，或者先添加几张笔记。</p>
            </div>
          ) : (
            <div
              style={isLargeList ? { paddingTop: padTop, paddingBottom: padBottom } : undefined}
              className="space-y-1.5"
            >
              {items.map((card) => {
                const active = selectedSet.has(card.id)
                const label = cardLabel(card, fields)
                const subtitle = cardSubtitle(card, fields)
                return (
                  <button
                    key={card.id}
                    type="button"
                    aria-pressed={active}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-[15px] border px-3.5 py-3 text-left transition-[background-color,border-color,transform] active:scale-[0.99]",
                      active
                        ? "border-energy/40 bg-energy/15"
                        : "border-black/[0.055] bg-card hover:bg-muted/45 dark:border-white/[0.07]"
                    )}
                    onClick={() => onChange(toggleId(referenceIds, card.id))}
                  >
                    <span
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-[10px] transition-colors",
                        active ? "bg-energy text-black" : "bg-muted text-muted-foreground"
                      )}
                    >
                      {active ? <Check className="size-4 stroke-[3]" /> : <Sparkles className="size-3.5" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold tracking-[-0.015em] text-foreground">{label}</span>
                      {subtitle ? <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{subtitle}</span> : null}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <SheetFooter className="shrink-0 border-t border-black/[0.045] bg-card/94 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl dark:border-white/[0.07]">
          <Button
            type="button"
            className="h-12 w-full rounded-[15px] text-sm"
            onClick={() => onOpenChange(false)}
          >
            完成 · {referenceIds.length} 张已选
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
