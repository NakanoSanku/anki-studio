"use client"

import { useState } from "react"

import { getTtsClip, playTtsAudio } from "@/lib/tts"
import type { TtsLang } from "@/lib/deck"
import { Button } from "@/components/ui/button"

export function TtsPlayButton({
  text,
  lang,
  slow,
  label = "播放",
  className,
}: {
  text: string
  lang: TtsLang
  slow: boolean
  label?: string
  className?: string
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
    <div className={className}>
      <Button type="button" size="xs" variant="outline" disabled={empty || busy} onClick={() => void play()}>
        {busy ? "获取中" : label}
      </Button>
      {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
    </div>
  )
}
