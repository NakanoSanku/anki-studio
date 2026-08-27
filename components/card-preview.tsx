import { useMemo } from "react"

import { previewDocument, renderCard } from "@/lib/template"
import { getCardTemplate, previewValues, ttsLangLabel, ttsOf, type Deck } from "@/lib/deck"
import { ttsFieldsOnSide } from "@/lib/tts"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { TtsPlayButton } from "@/components/tts-play-button"

type CardPreviewProps = {
  deck: Deck
  values: Record<string, string>
  side: "front" | "back"
  onSideChange: (side: "front" | "back") => void
  templateId?: string
  className?: string
  fillViewport?: boolean
}

export function CardPreview({
  deck,
  values,
  side,
  onSideChange,
  templateId,
  className,
  fillViewport = false,
}: CardPreviewProps) {
  const preview = useMemo(() => previewValues(deck, values), [deck, values])
  const template = useMemo(() => getCardTemplate(deck, templateId), [deck, templateId])
  const rendered = useMemo(
    () => renderCard(template.front, template.back, preview),
    [template.front, template.back, preview]
  )
  const html = side === "front" ? rendered.front : rendered.back
  const doc = useMemo(() => previewDocument(deck.css, html), [deck.css, html])
  const playable = useMemo(() => ttsFieldsOnSide(deck, side, template.id), [deck, side, template.id])
  const configs = useMemo(() => ttsOf(deck), [deck])

  return (
    <div
      className={cn(
        "flex min-h-0 min-w-0 flex-col gap-3 rounded-[22px] border border-black/[0.065] bg-card p-3 shadow-[0_18px_46px_-42px_rgba(0,0,0,0.45)] dark:border-white/[0.09] sm:p-4",
        fillViewport &&
          "h-[max(20rem,calc(100dvh-19.5rem))] lg:h-[max(28rem,calc(100dvh-16.5rem))]",
        className
      )}
    >
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.17em] text-muted-foreground">
            <span className="size-1.5 rounded-full bg-energy" />
            Live preview
          </p>
          <p className="mt-1 truncate text-[15px] font-semibold tracking-[-0.025em] text-foreground">{template.name}</p>
        </div>
        <div
          className="flex shrink-0 rounded-[12px] border border-black/[0.06] bg-muted/55 p-1 dark:border-white/[0.08]"
          role="group"
          aria-label="Preview card side"
        >
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={cn(
              "h-8 rounded-[9px] px-3 text-xs font-medium",
              side === "front"
                ? "bg-card text-foreground shadow-[0_6px_16px_-14px_rgba(0,0,0,0.6)]"
                : "text-foreground/55 hover:bg-card/70 hover:text-foreground"
            )}
            aria-pressed={side === "front"}
            onClick={() => onSideChange("front")}
          >
            Front
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={cn(
              "h-8 rounded-[9px] px-3 text-xs font-medium",
              side === "back"
                ? "bg-card text-foreground shadow-[0_6px_16px_-14px_rgba(0,0,0,0.6)]"
                : "text-foreground/55 hover:bg-card/70 hover:text-foreground"
            )}
            aria-pressed={side === "back"}
            onClick={() => onSideChange("back")}
          >
            Back
          </Button>
        </div>
      </div>

      <div
        className={cn(
          "relative overflow-hidden rounded-[18px] border border-black/[0.07] bg-white shadow-[0_22px_52px_-42px_rgba(0,0,0,0.5)] dark:border-white/[0.09]",
          fillViewport ? "min-h-0 flex-1" : "h-[300px] lg:h-[440px]"
        )}
      >
        <div className="pointer-events-none absolute left-4 top-4 z-10 size-2 rounded-full bg-energy shadow-[0_0_0_5px_rgba(199,248,90,0.14)]" aria-hidden="true" />
        <iframe
          title="Card preview"
          sandbox=""
          loading="lazy"
          referrerPolicy="no-referrer"
          srcDoc={doc}
          className="h-full w-full border-0 bg-white"
        />
      </div>

      {playable.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 px-1 pt-0.5">
          <span className="mr-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Audio</span>
          {playable.map((name) => {
            const tts = configs[name]
            if (!tts) return null
            return (
              <TtsPlayButton
                key={name}
                text={values[tts.source] ?? ""}
                lang={tts.lang}
                slow={tts.slow}
                label={`Play ${name} · ${ttsLangLabel(tts.lang)}`}
              />
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
