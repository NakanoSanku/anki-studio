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
        "flex min-h-0 min-w-0 flex-col gap-3 rounded-[2rem] bg-[#dff1ff] p-3 shadow-[0_22px_60px_-42px_rgba(0,0,0,0.7)] dark:bg-[#1e3b55] sm:p-4",
        fillViewport &&
          "h-[max(20rem,calc(100dvh-19.5rem))] lg:h-[max(28rem,calc(100dvh-16.5rem))]",
        className
      )}
    >
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-black/40 dark:text-white/45">live preview</p>
          <p className="mt-0.5 truncate text-base font-black tracking-[-0.035em] text-foreground">{template.name}</p>
        </div>
        <div
          className="flex shrink-0 rounded-full bg-white/60 p-1 shadow-[0_8px_24px_-20px_rgba(0,0,0,0.65)] dark:bg-black/15"
          role="group"
          aria-label="预览卡面"
        >
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={cn(
              "h-8 rounded-full px-3 text-xs font-black",
              side === "front"
                ? "bg-black text-white hover:bg-black/85 dark:bg-white dark:text-black dark:hover:bg-white/90"
                : "text-foreground/60 hover:bg-black/[0.05] hover:text-foreground dark:hover:bg-white/10"
            )}
            aria-pressed={side === "front"}
            onClick={() => onSideChange("front")}
          >
            正面
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={cn(
              "h-8 rounded-full px-3 text-xs font-black",
              side === "back"
                ? "bg-black text-white hover:bg-black/85 dark:bg-white dark:text-black dark:hover:bg-white/90"
                : "text-foreground/60 hover:bg-black/[0.05] hover:text-foreground dark:hover:bg-white/10"
            )}
            aria-pressed={side === "back"}
            onClick={() => onSideChange("back")}
          >
            背面
          </Button>
        </div>
      </div>

      <div
        className={cn(
          "relative overflow-hidden rounded-[1.7rem] bg-white shadow-[0_24px_56px_-38px_rgba(0,0,0,0.78)] ring-1 ring-black/[0.04]",
          fillViewport ? "min-h-0 flex-1" : "h-[300px] lg:h-[440px]"
        )}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-1.5 bg-gradient-to-r from-[#c8f889] via-[#ff9bd6] to-[#ffe08d]" aria-hidden="true" />
        <iframe
          title="卡片预览"
          sandbox=""
          loading="lazy"
          referrerPolicy="no-referrer"
          srcDoc={doc}
          className="h-full w-full border-0 bg-white"
        />
      </div>

      {playable.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 px-1 pt-0.5">
          <span className="mr-1 text-[10px] font-black uppercase tracking-[0.14em] text-black/40 dark:text-white/45">audio</span>
          {playable.map((name) => {
            const tts = configs[name]
            if (!tts) return null
            return (
              <TtsPlayButton
                key={name}
                text={values[tts.source] ?? ""}
                lang={tts.lang}
                slow={tts.slow}
                label={`播放 ${name} · ${ttsLangLabel(tts.lang)}`}
              />
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
