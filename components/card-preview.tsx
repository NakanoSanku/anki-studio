import { useCallback, useMemo, type SyntheticEvent } from "react"

import { previewDocument, renderCard } from "@/lib/template"
import { getCardTemplate, previewValues, ttsOf, type Deck } from "@/lib/deck"
import { getTtsClip, playTtsAudio } from "@/lib/tts"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const TTS_BUTTON_ICON = `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4V5Z"></path><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>`

function previewTtsButton(name: string): string {
  return `<button type="button" data-preview-tts="${encodeURIComponent(name)}" aria-label="Play audio" style="display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;margin:4px;border:1px solid rgba(65,75,110,.10);border-radius:9px;background:#f1f3f8;color:#5067d9;box-shadow:none;cursor:pointer;vertical-align:middle;-webkit-tap-highlight-color:transparent;">${TTS_BUTTON_ICON}</button>`
}

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
  const configs = useMemo(() => ttsOf(deck), [deck])
  const renderValues = useMemo(() => {
    const next = { ...preview }
    for (const [name, tts] of Object.entries(configs)) {
      next[name] = (values[tts.source] ?? "").trim() ? previewTtsButton(name) : ""
    }
    return next
  }, [configs, preview, values])
  const rendered = useMemo(
    () => renderCard(template.front, template.back, renderValues),
    [template.front, template.back, renderValues]
  )
  const html = side === "front" ? rendered.front : rendered.back
  const doc = useMemo(() => previewDocument(deck.css, html), [deck.css, html])

  const wireFrame = useCallback(
    (event: SyntheticEvent<HTMLIFrameElement>) => {
      const frameDoc = event.currentTarget.contentDocument
      if (!frameDoc) return

      for (const button of frameDoc.querySelectorAll<HTMLButtonElement>("[data-preview-tts]")) {
        const encodedName = button.dataset.previewTts
        if (!encodedName) {
          button.remove()
          continue
        }

        let name = ""
        try {
          name = decodeURIComponent(encodedName)
        } catch {
          button.remove()
          continue
        }

        const tts = configs[name]
        const text = tts ? values[tts.source] ?? "" : ""
        if (!tts || !text.trim()) {
          button.remove()
          continue
        }

        button.setAttribute("aria-label", `Play ${name}`)
        button.onclick = (buttonEvent) => {
          buttonEvent.preventDefault()
          buttonEvent.stopPropagation()
          if (button.disabled) return

          button.disabled = true
          button.dataset.state = "loading"
          button.style.opacity = "0.58"
          button.style.cursor = "progress"
          button.removeAttribute("title")

          void getTtsClip({ text, lang: tts.lang, slow: tts.slow })
            .then((clip) => playTtsAudio(clip.blob))
            .then(() => {
              if (!button.isConnected) return
              button.dataset.state = "idle"
              button.style.opacity = "1"
              button.style.cursor = "pointer"
            })
            .catch((caught: unknown) => {
              if (!button.isConnected) return
              const message = caught instanceof Error ? caught.message : "Audio playback failed"
              button.dataset.state = "error"
              button.title = message
              button.style.opacity = "1"
              button.style.cursor = "pointer"
              button.style.background = "#fff0f0"
              button.style.color = "#b42318"
              window.setTimeout(() => {
                if (!button.isConnected) return
                button.dataset.state = "idle"
                button.style.background = "#f1f3f8"
                button.style.color = "#5067d9"
              }, 1800)
            })
            .finally(() => {
              if (button.isConnected) button.disabled = false
            })
        }
      }
    },
    [configs, values]
  )

  return (
    <div
      className={cn(
        "flex min-h-0 min-w-0 flex-col",
        fillViewport
          ? "h-[calc(100dvh-5.75rem)] gap-2 rounded-none border-0 bg-transparent p-0 shadow-none sm:p-0 lg:h-[calc(100dvh-7rem)]"
          : "gap-3 rounded-[18px] border border-foreground/[0.07] bg-card/90 p-3 shadow-[0_14px_36px_-34px_rgba(15,23,42,0.24)] backdrop-blur-xl sm:p-4",
        className
      )}
    >
      <div className={cn("flex shrink-0 items-center justify-between gap-3", fillViewport ? "px-1" : "px-1")}>
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.17em] text-muted-foreground">
            <span className="h-1.5 w-4 rounded-full bg-signal" />
            Live preview
          </p>
          <p className="mt-1 truncate text-[15px] font-semibold tracking-[-0.025em] text-foreground">{template.name}</p>
        </div>
        <div
          className="flex shrink-0 rounded-[11px] border border-foreground/[0.06] bg-muted/50 p-1"
          role="group"
          aria-label="Preview card side"
        >
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={cn(
              "h-8 rounded-[8px] px-3 text-xs font-medium",
              side === "front"
                ? "bg-card text-foreground shadow-[0_8px_18px_-16px_rgba(15,23,42,0.3)]"
                : "text-foreground/52 hover:bg-card/68 hover:text-foreground"
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
              "h-8 rounded-[8px] px-3 text-xs font-medium",
              side === "back"
                ? "bg-card text-foreground shadow-[0_8px_18px_-16px_rgba(15,23,42,0.3)]"
                : "text-foreground/52 hover:bg-card/68 hover:text-foreground"
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
          "relative min-h-0 overflow-hidden border border-foreground/[0.07] bg-white shadow-[0_12px_32px_-30px_rgba(15,23,42,0.26)]",
          fillViewport ? "flex-1 rounded-[18px]" : "h-[300px] rounded-[16px] lg:h-[440px]"
        )}
      >
        <iframe
          title="Card preview"
          sandbox="allow-same-origin"
          referrerPolicy="no-referrer"
          srcDoc={doc}
          onLoad={wireFrame}
          className="h-full w-full border-0 bg-white"
        />
      </div>
    </div>
  )
}
