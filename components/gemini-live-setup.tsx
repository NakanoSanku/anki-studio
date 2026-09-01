"use client"

import { useEffect, useState } from "react"
import { Check, Eye, EyeOff, LoaderCircle, Mic2, Save, Zap } from "lucide-react"

import { AI_SETTINGS_CHANGED_EVENT } from "@/lib/ai-settings"
import {
  GEMINI_LIVE_MODEL,
  readGeminiLiveSettings,
  validateGeminiLiveSettings,
  writeGeminiLiveSettings,
  type GeminiLiveSettings,
} from "@/lib/gemini-live-settings"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

type SetupStatus = {
  type: "idle" | "success" | "error" | "info"
  message: string
}

async function verifyGeminiKey(apiKey: string): Promise<void> {
  const response = await fetch("/api/gemini-live/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey }),
    cache: "no-store",
  })
  const data = await response.json().catch(() => null) as { error?: string } | null
  if (!response.ok) throw new Error(data?.error || "Gemini Live connection failed")
}

export function GeminiLiveSetup({
  mode = "settings",
  onSaved,
}: {
  mode?: "settings" | "onboarding"
  onSaved?: (settings: GeminiLiveSettings) => void
}) {
  const [settings, setSettings] = useState<GeminiLiveSettings>(readGeminiLiveSettings)
  const [showKey, setShowKey] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<SetupStatus>({ type: "idle", message: "" })

  useEffect(() => {
    const syncSharedKey = () => setSettings(readGeminiLiveSettings())
    window.addEventListener(AI_SETTINGS_CHANGED_EVENT, syncSharedKey)
    return () => window.removeEventListener(AI_SETTINGS_CHANGED_EVENT, syncSharedKey)
  }, [])

  const normalized = (): GeminiLiveSettings => ({ apiKey: settings.apiKey.trim() })

  const save = () => {
    const next = normalized()
    const error = validateGeminiLiveSettings(next)
    if (error) {
      setStatus({ type: "error", message: error })
      return
    }
    writeGeminiLiveSettings(next)
    setSettings(next)
    setStatus({ type: "success", message: "Gemini Live settings saved" })
    onSaved?.(next)
  }

  const saveAndContinue = async () => {
    const next = normalized()
    const error = validateGeminiLiveSettings(next)
    if (error) {
      setStatus({ type: "error", message: error })
      return
    }
    setBusy(true)
    setStatus({ type: "info", message: "Checking Gemini Live…" })
    try {
      await verifyGeminiKey(next.apiKey)
      writeGeminiLiveSettings(next)
      setSettings(next)
      setStatus({ type: "success", message: "Gemini Live is ready" })
      onSaved?.(next)
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : "Gemini Live connection failed" })
    } finally {
      setBusy(false)
    }
  }

  const test = async () => {
    const next = normalized()
    const error = validateGeminiLiveSettings(next)
    if (error) {
      setStatus({ type: "error", message: error })
      return
    }
    setBusy(true)
    setStatus({ type: "info", message: "Testing Gemini Live…" })
    try {
      await verifyGeminiKey(next.apiKey)
      setStatus({ type: "success", message: "Gemini Live is ready" })
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : "Gemini Live connection failed" })
    } finally {
      setBusy(false)
    }
  }

  const onboarding = mode === "onboarding"

  if (!onboarding) {
    return (
      <section data-testid="gemini-live-compact" className="mx-auto w-full max-w-xl rounded-[20px] border border-black/[0.065] bg-card p-4 dark:border-white/[0.09]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-base font-semibold tracking-[-0.025em]">Gemini Live</h3>
            <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
              Uses the same API key as the provider above when it points to Google Gemini. OpenAI-compatible providers keep a separate Live key.
            </p>
          </div>
          <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="shrink-0 text-[10px] font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">Get key</a>
        </div>
        <div className="relative mt-3">
          <Input
            id="gemini-live-key"
            type={showKey ? "text" : "password"}
            value={settings.apiKey}
            autoComplete="off"
            placeholder="Gemini API key"
            className="h-10 bg-background pr-10 font-mono text-xs"
            onChange={(event) => {
              setSettings({ apiKey: event.target.value })
              setStatus({ type: "idle", message: "" })
            }}
          />
          <button type="button" aria-label={showKey ? "Hide Gemini API key" : "Show Gemini API key"} onClick={() => setShowKey((visible) => !visible)} className="absolute right-1.5 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-[9px] text-muted-foreground hover:bg-muted hover:text-foreground">
            {showKey ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          </button>
        </div>
        <div className="mt-2 flex items-center justify-between gap-3 text-[10px] text-muted-foreground">
          <span className="truncate font-mono">{GEMINI_LIVE_MODEL}</span>
          <span className="shrink-0">Shared when possible</span>
        </div>
        {status.message ? <p role="status" className={cn("mt-3 rounded-[11px] px-3 py-2 text-xs font-medium", status.type === "error" ? "bg-destructive/8 text-destructive" : status.type === "success" ? "bg-energy/14 text-foreground" : "bg-muted/60 text-muted-foreground")}>{status.message}</p> : null}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" className="h-10" disabled={busy} onClick={() => void test()}>{busy ? "Testing…" : "Test"}</Button>
          <Button type="button" className="h-10" disabled={busy} onClick={save}>Save</Button>
        </div>
      </section>
    )
  }

  return (
    <section
      className={cn(
        "mx-auto w-full max-w-xl rounded-[22px] border border-black/[0.065] bg-card shadow-[0_18px_46px_-42px_rgba(0,0,0,0.45)] dark:border-white/[0.09]",
        onboarding ? "p-5 sm:p-6" : "p-4 sm:p-5"
      )}
    >
      <div className="flex items-start gap-3.5">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-energy/18 text-foreground">
          <Mic2 className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.17em] text-muted-foreground">Gemini Live</p>
          <h3 className="mt-1 text-xl font-semibold tracking-[-0.035em]">
            {onboarding ? "Set up Voice Tutor" : "Voice Tutor"}
          </h3>
          <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
            {onboarding
              ? "One Gemini API key can power both AI generation and the real-time Voice Tutor."
              : "Real-time voice uses Gemini 3.1 Flash Live while normal AI generation keeps its own selected model."}
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-[16px] border border-black/[0.055] bg-background/55 p-3.5 dark:border-white/[0.07]">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor={onboarding ? "gemini-live-key-onboarding" : "gemini-live-key"} className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Gemini API key
          </Label>
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noreferrer"
            className="text-[10px] font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Get a key
          </a>
        </div>
        <div className="relative mt-2">
          <Input
            id={onboarding ? "gemini-live-key-onboarding" : "gemini-live-key"}
            type={showKey ? "text" : "password"}
            value={settings.apiKey}
            autoComplete="off"
            placeholder="AIza…"
            className="h-11 bg-card pr-11 font-mono text-xs"
            onChange={(event) => {
              setSettings({ apiKey: event.target.value })
              setStatus({ type: "idle", message: "" })
            }}
          />
          <button
            type="button"
            aria-label={showKey ? "Hide Gemini API key" : "Show Gemini API key"}
            onClick={() => setShowKey((visible) => !visible)}
            className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {showKey ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          </button>
        </div>
        <div className="mt-2 flex items-center justify-between gap-3 text-[10px] text-muted-foreground">
          <span className="truncate font-mono">{GEMINI_LIVE_MODEL}</span>
          <span className="shrink-0">Stored on this device</span>
        </div>
      </div>

      {status.message ? (
        <div
          role="status"
          className={cn(
            "mt-3 flex items-start gap-2 rounded-[13px] px-3 py-2.5 text-xs font-medium",
            status.type === "success"
              ? "bg-energy/14 text-foreground"
              : status.type === "error"
                ? "bg-destructive/8 text-destructive"
                : "bg-muted/60 text-muted-foreground"
          )}
        >
          {status.type === "success" ? <Check className="mt-0.5 size-3.5 shrink-0" /> : <LoaderCircle className={cn("mt-0.5 size-3.5 shrink-0", busy && "animate-spin")} />}
          <span className="leading-5">{status.message}</span>
        </div>
      ) : null}

      {onboarding ? (
        <Button type="button" className="mt-4 h-12 w-full" disabled={busy} onClick={() => void saveAndContinue()}>
          {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Mic2 className="size-4" />}
          {busy ? "Checking…" : "Save & continue"}
        </Button>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" className="h-11" disabled={busy} onClick={() => void test()}>
            {busy ? <LoaderCircle className="size-3.5 animate-spin" /> : <Zap className="size-3.5" />}
            Test
          </Button>
          <Button type="button" className="h-11" disabled={busy} onClick={save}>
            <Save className="size-3.5" />
            Save
          </Button>
        </div>
      )}

      <p className="mt-3 text-[10px] leading-4 text-muted-foreground">
        The permanent Gemini key stays on this device. Voice Tutor sends it only to this app&apos;s token endpoint to mint a short-lived Live token for each lesson.
      </p>
    </section>
  )
}
