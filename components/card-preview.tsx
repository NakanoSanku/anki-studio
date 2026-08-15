"use client"

import { previewDocument, renderCard } from "@/lib/template"
import { previewValues, ttsLangLabel, ttsOf, type Deck } from "@/lib/deck"
import { ttsFieldsOnSide } from "@/lib/tts"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { TtsPlayButton } from "@/components/tts-play-button"

type CardPreviewProps = {
  deck: Deck
  values: Record<string, string>
  side: "front" | "back"
  onSideChange: (side: "front" | "back") => void
  className?: string
}

export function CardPreview({
  deck,
  values,
  side,
  onSideChange,
  className,
}: CardPreviewProps) {
  const preview = previewValues(deck, values)
  const rendered = renderCard(deck.front, deck.back, preview)
  const html = side === "front" ? rendered.front : rendered.back
  const playable = ttsFieldsOnSide(deck, side)
  const configs = ttsOf(deck)

  return (
    <div className={cn("flex min-h-0 min-w-0 flex-col gap-3", className)}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">预览</p>
        <div className="flex shrink-0 gap-1">
          <Button
            type="button"
            size="sm"
            variant={side === "front" ? "default" : "outline"}
            onClick={() => onSideChange("front")}
          >
            正面
          </Button>
          <Button
            type="button"
            size="sm"
            variant={side === "back" ? "default" : "outline"}
            onClick={() => onSideChange("back")}
          >
            背面
          </Button>
        </div>
      </div>
      <div className="h-[280px] overflow-hidden rounded-2xl bg-white ring-1 ring-black/8 lg:h-[420px]">
        <iframe
          title="卡片预览"
          sandbox=""
          srcDoc={previewDocument(deck.css, html)}
          className="h-full w-full border-0 bg-white"
        />
      </div>
      {playable.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
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
