"use client"

import { useState } from "react"
import { LoaderCircle, Volume2 } from "lucide-react"

import { getTtsClip, playTtsAudio } from "@/lib/tts"
import type { TtsLang } from "@/lib/deck"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function TtsPlayButton({
  text,
  lang,
  slow,
  label = "播放",
  className,
  iconOnly = false,
}: {
  text: string
  lang: TtsLang
  slow: boolean
  label?: string
  className?: string
  iconOnly?: boolean
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const empty = !text.trim()

  const play = async () => {
    if (empty || busy) return
    setBusy(true)
    setError("")
    try {
      const clip = await getTtsClip({ text, lang, slow })
      await playTtsAudio(clip.blob)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "播放失败")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={cn("relative", className)}>
      <Button
        type="button"
        size={iconOnly ? "icon-sm" : "xs"}
        variant="outline"
        className={cn(iconOnly && "border-black/10 bg-white/92 text-stone-700 shadow-sm hover:bg-stone-100")}
        aria-label={iconOnly ? label : undefined}
        disabled={empty || busy}
        onClick={() => void play()}
      >
        {iconOnly ? (
          busy ? <LoaderCircle className="size-3.5 animate-spin" /> : <Volume2 className="size-3.5" />
        ) : (
          busy ? "获取中" : label
        )}
      </Button>
      {error ? (
        <p
          role="status"
          className={cn(
            "mt-1 text-xs text-destructive",
            iconOnly && "absolute bottom-full left-0 z-30 mb-2 w-max max-w-48 rounded-lg border border-destructive/25 bg-popover px-2 py-1.5 shadow-md"
          )}
        >
          {error}
        </p>
      ) : null}
    </div>
  )
}
