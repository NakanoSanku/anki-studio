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
        "flex min-h-0 min-w-0 flex-col gap-3",
        fillViewport &&
          "h-[max(20rem,calc(100dvh-19.5rem))] lg:h-[max(28rem,calc(100dvh-16.5rem))]",
        className
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">预览</p>
          <p className="truncate text-xs text-muted-foreground">{template.name}</p>
        </div>
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
      <div
        className={cn(
          "overflow-hidden rounded-2xl bg-white ring-1 ring-black/8",
          fillViewport ? "min-h-0 flex-1" : "h-[280px] lg:h-[420px]"
        )}
      >
        <iframe
          title="卡片预览"
          sandbox=""
          srcDoc={doc}
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
