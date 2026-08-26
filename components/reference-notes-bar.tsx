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

const PICKER_ROW = 56

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
        "flex h-7.5 items-center gap-1.5 rounded-lg border px-2.5 text-xs transition-all active:scale-95",
        count > 0
          ? "border-primary/40 bg-primary/10 font-semibold text-primary shadow-2xs"
          : "border-border/70 bg-card text-muted-foreground hover:bg-muted/40 hover:text-foreground"
      )}
    >
      <Sparkles className="size-3.5 text-primary" />
      <span>参考</span>
      {count > 0 ? (
        <span className="ml-0.5 rounded-full bg-primary/20 px-1.5 font-mono text-[10px] font-bold leading-tight text-primary">
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
        className="max-h-[85dvh] h-[85dvh] rounded-t-3xl p-0 flex flex-col sm:max-w-lg sm:mx-auto border-border/80 shadow-xl"
      >
        {/* Header */}
        <SheetHeader className="border-b border-border/70 px-4 py-3 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SheetTitle className="text-sm font-semibold">参考笔记</SheetTitle>
              <Badge variant="secondary" className="font-mono text-[10px] font-normal">
                已选 {referenceIds.length} 张
              </Badge>
            </div>

            {referenceIds.length > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className="mr-7 h-7 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => onChange([])}
              >
                <RotateCcw className="mr-1 size-3" />
                清空
              </Button>
            ) : null}
          </div>
          <SheetDescription className="text-xs text-muted-foreground">
            勾选笔记作为 AI 范例，补全与批量生成时自动学习其音标、释义与例句风格。
          </SheetDescription>
        </SheetHeader>

        {/* Search */}
        <div className="border-b border-border/60 bg-muted/10 px-4 py-2.5 shrink-0">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              aria-label="搜索参考笔记"
              placeholder="搜索笔记…"
              className="h-8.5 rounded-xl border-border/70 bg-card pr-3 pl-8.5 text-xs"
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        </div>

        {/* List */}
        <div
          ref={isLargeList ? containerRef : undefined}
          data-testid="reference-notes-list"
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-2"
        >
          {filtered.length === 0 ? (
            <p className="px-2 py-10 text-center text-xs text-muted-foreground">
              {query ? `没有匹配「${query}」的笔记` : "卡包中还没有笔记"}
            </p>
          ) : (
            <div
              style={isLargeList ? { paddingTop: padTop, paddingBottom: padBottom } : undefined}
              className="space-y-1"
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
                      "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-all",
                      active
                        ? "bg-primary/10 border border-primary/30"
                        : "hover:bg-muted/40 active:bg-muted/70 border border-transparent"
                    )}
                    onClick={() => onChange(toggleId(referenceIds, card.id))}
                  >
                    <span
                      className={cn(
                        "flex size-4.5 shrink-0 items-center justify-center rounded-md border transition-colors",
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border/80 bg-card"
                      )}
                    >
                      {active ? <Check className="size-3 stroke-[3]" /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-foreground">
                        {label}
                      </span>
                      {subtitle ? (
                        <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
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

        {/* Bottom Finish Button */}
        <SheetFooter className="border-t border-border/70 bg-card p-3.5 shrink-0">
          <Button
            type="button"
            className="h-9 w-full rounded-xl font-semibold shadow-xs"
            onClick={() => onOpenChange(false)}
          >
            完成 ({referenceIds.length} 张已选)
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
