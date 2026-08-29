"use client"

import { useMemo, useState } from "react"
import { Check, Eye, RotateCcw, Search } from "lucide-react"

import { cardLabel, cardMatchesQuery, cardSubtitle, type Card } from "@/lib/deck"
import { useVirtualWindow } from "@/components/use-virtual-window"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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

export function ReferenceNotesPicker({
  cards,
  fields,
  referenceIds,
  onChange,
  open,
  onOpenChange,
}: SharedProps & { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [query, setQuery] = useState("")
  const [previewId, setPreviewId] = useState<string | null>(null)
  const selectedSet = useMemo(() => new Set(referenceIds), [referenceIds])
  const previewCard = useMemo(
    () => cards.find((card) => card.id === previewId) ?? null,
    [cards, previewId]
  )
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
    <>
      <Sheet
        open={open}
        onOpenChange={(next) => {
          if (next) setQuery("")
          if (!next) setPreviewId(null)
          onOpenChange(next)
        }}
      >
        <SheetContent
          side="bottom"
          className="flex h-[88dvh] max-h-[760px] flex-col p-0 sm:mx-auto sm:max-w-lg"
        >
          <SheetHeader className="shrink-0 px-5 pb-3 pt-5">
            <div className="mb-1 flex items-center justify-between gap-3 pr-8">
              <div className="flex min-w-0 items-center gap-2">
                <span className="size-2 shrink-0 rounded-full bg-energy" />
                <SheetTitle className="truncate text-[28px] font-semibold tracking-[-0.045em]">Reference notes</SheetTitle>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label="Clear reference selection"
                  className="h-8 px-2 text-xs text-muted-foreground"
                  disabled={referenceIds.length === 0}
                  onClick={() => onChange([])}
                >
                  <RotateCcw className="size-3" />
                  Clear
                </Button>
                <Badge className="h-8 border border-black/[0.06] bg-muted px-2.5 text-xs font-medium text-foreground shadow-none dark:border-white/[0.08]">
                  {referenceIds.length}
                </Badge>
              </div>
            </div>
            <SheetDescription className="text-xs leading-5">
              Pick notes whose style you want AI to follow.
            </SheetDescription>
          </SheetHeader>

          <div className="shrink-0 px-4 pb-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                aria-label="Search reference notes"
                placeholder="Search notes…"
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
                  {query ? `No notes match “${query}”` : "This deck has no notes yet"}
                </p>
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
                    <div
                      key={card.id}
                      className={cn(
                        "flex min-h-16 items-center gap-1 rounded-[15px] border pr-1 transition-[background-color,border-color]",
                        active
                          ? "border-energy/40 bg-energy/15"
                          : "border-black/[0.055] bg-card hover:bg-muted/45 dark:border-white/[0.07]"
                      )}
                    >
                      <button
                        type="button"
                        aria-pressed={active}
                        className="flex min-w-0 flex-1 items-center gap-3 px-3.5 py-3 text-left"
                        onClick={() => onChange(toggleId(referenceIds, card.id))}
                      >
                        <span
                          className={cn(
                            "flex size-6 shrink-0 items-center justify-center rounded-full border transition-colors",
                            active
                              ? "border-energy bg-energy text-black"
                              : "border-foreground/15 bg-transparent text-transparent"
                          )}
                        >
                          {active ? <Check className="size-3.5 stroke-[3]" /> : null}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold tracking-[-0.015em] text-foreground">{label}</span>
                          {subtitle ? <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{subtitle}</span> : null}
                        </span>
                      </button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="size-9 shrink-0 rounded-[11px] text-muted-foreground"
                        aria-label={`Preview ${label || "note"}`}
                        onClick={() => setPreviewId(card.id)}
                      >
                        <Eye className="size-4" />
                      </Button>
                    </div>
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
              Done · {referenceIds.length} selected
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Dialog open={Boolean(previewCard)} onOpenChange={(next) => { if (!next) setPreviewId(null) }}>
        <DialogContent aria-describedby={undefined} className="max-h-[82dvh] overflow-hidden">
          <DialogHeader>
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Note preview</div>
            <DialogTitle className="truncate text-xl">{previewCard ? cardLabel(previewCard, fields) || "Untitled note" : "Note preview"}</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 space-y-2 overflow-y-auto overscroll-contain pr-1">
            {previewCard ? fields.map((field) => (
              <div key={field} className="rounded-[14px] border border-black/[0.055] bg-background/55 p-3 dark:border-white/[0.07]">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{field}</p>
                <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-6 text-foreground">
                  {previewCard.values[field]?.trim() || "—"}
                </p>
              </div>
            )) : null}
          </div>
          <DialogFooter className="flex-row gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setPreviewId(null)}>Close</Button>
            <Button
              type="button"
              className="flex-1"
              onClick={() => {
                if (!previewCard) return
                onChange(toggleId(referenceIds, previewCard.id))
              }}
            >
              {previewCard && selectedSet.has(previewCard.id) ? "Remove reference" : "Use as reference"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
