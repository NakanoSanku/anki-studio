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
    <div className={cn("relative inline-flex", className)}>
      <Button
        type="button"
        size={iconOnly ? "icon-sm" : "sm"}
        variant="ghost"
        className={cn(
          "border-0 font-black shadow-[0_8px_24px_-20px_rgba(0,0,0,0.72)]",
          iconOnly
            ? "bg-[#dff1ff] text-[#194f83] hover:bg-[#cfe6ff] dark:bg-[#244d74] dark:text-[#dceeff] dark:hover:bg-[#2b5a86]"
            : "h-8 rounded-full bg-[#dff1ff] px-3 text-xs text-[#194f83] hover:bg-[#cfe6ff] dark:bg-[#244d74] dark:text-[#dceeff] dark:hover:bg-[#2b5a86]"
        )}
        aria-label={iconOnly ? label : undefined}
        disabled={empty || busy}
        onClick={() => void play()}
      >
        {busy ? <LoaderCircle className="size-3.5 animate-spin" /> : <Volume2 className="size-3.5" />}
        {!iconOnly ? <span>{busy ? "加载中" : label}</span> : null}
      </Button>
      {error ? (
        <p
          role="status"
          className={cn(
            "mt-1 rounded-full bg-[#ffd8df] px-2.5 py-1 text-[11px] font-bold text-[#761c31] shadow-[0_10px_26px_-20px_rgba(0,0,0,0.7)] dark:bg-[#6a2835] dark:text-[#ffdce3]",
            iconOnly && "absolute bottom-full left-0 z-30 mb-2 w-max max-w-52 rounded-2xl px-3 py-2"
          )}
        >
          {error}
        </p>
      ) : null}
    </div>
  )
}
