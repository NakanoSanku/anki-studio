"use client"

import { useMemo, useState } from "react"
import { Check, Plus, Search, X } from "lucide-react"

import { cardLabel, cardMatchesQuery, cardSubtitle, type Card } from "@/lib/deck"
import { useVirtualWindow } from "@/components/use-virtual-window"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
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

function selectedNotes(cards: Card[], referenceIds: string[]): Card[] {
  const byId = new Map(cards.map((card) => [card.id, card]))
  return referenceIds.flatMap((id) => {
    const card = byId.get(id)
    return card ? [card] : []
  })
}

function toggleId(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]
}

export function ReferenceNotesBar({
  cards,
  fields,
  referenceIds,
  onChange,
  onOpenPicker,
}: SharedProps & { onOpenPicker: () => void }) {
  const pinned = selectedNotes(cards, referenceIds)

  return (
    <div className="flex min-w-0 items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        aria-label="选择参考笔记"
        onClick={onOpenPicker}
      >
        <Plus data-icon="inline-start" />
        参考笔记
        {pinned.length > 0 ? ` ${pinned.length}` : ""}
      </Button>
      {pinned.length > 0 ? (
        <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto overscroll-contain">
          {pinned.map((card) => {
            const label = cardLabel(card, fields)
            return (
              <Badge key={card.id} variant="secondary" className="max-w-40 shrink-0">
                <span className="truncate">{label}</span>
                <button
                  type="button"
                  className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  aria-label={`移除参考笔记 ${label}`}
                  onClick={() => onChange(toggleId(referenceIds, card.id))}
                >
                  <X />
                </button>
              </Badge>
            )
          })}
        </div>
      ) : (
        <p className="min-w-0 truncate text-xs text-muted-foreground">可选，学写法</p>
      )}
    </div>
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
  const {
    containerRef,
    start,
    end,
    padTop,
    padBottom,
  } = useVirtualWindow(filtered.length, PICKER_ROW)

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (next) setQuery("")
        onOpenChange(next)
      }}
    >
      <SheetContent side="bottom" className="max-h-[85dvh] gap-0 rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]">
        <SheetHeader>
          <SheetTitle>参考笔记</SheetTitle>
          <SheetDescription>从当前卡包勾选笔记，补全和批量生成都会用来学写法。</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              aria-label="搜索参考笔记"
              placeholder="搜索笔记"
              className="h-10 pr-3 pl-9"
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            已选 {referenceIds.length}
            {query.trim() ? ` · 显示 ${filtered.length}` : ""}
          </p>
        </div>
        <div
          ref={containerRef}
          className="h-[min(28rem,55dvh)] overflow-y-auto overscroll-contain px-2 pb-2"
        >
          {filtered.length === 0 ? (
            <p className="px-2 py-8 text-center text-sm text-muted-foreground">没有匹配的笔记</p>
          ) : (
            <div style={{ paddingTop: padTop, paddingBottom: padBottom }}>
              {filtered.slice(start, end).map((card) => {
                const active = selectedSet.has(card.id)
                const label = cardLabel(card, fields)
                const subtitle = cardSubtitle(card, fields)
                return (
                  <button
                    key={card.id}
                    type="button"
                    aria-pressed={active}
                    className={cn(
                      "flex h-14 w-full items-center gap-3 rounded-xl px-2 text-left",
                      active ? "bg-muted" : "hover:bg-muted/60"
                    )}
                    onClick={() => onChange(toggleId(referenceIds, card.id))}
                  >
                    <span
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded-md border",
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border"
                      )}
                    >
                      {active ? <Check className="size-3" /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{label}</span>
                      {subtitle ? (
                        <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>
                      ) : null}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
