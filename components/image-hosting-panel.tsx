"use client"

import { useState } from "react"
import { Eye, EyeOff, KeyRound, Trash2 } from "lucide-react"

import {
  DEFAULT_MEDIA_UPLOAD_ENDPOINT,
  DEFAULT_MEDIA_UPLOAD_STORAGE,
  readImageUploadSettings,
  writeImageUploadSettings,
  clearImageUploadSettings,
  type ImageUploadSettings,
} from "@/lib/media-host"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

export function ImageHostingPanel() {
  const [settings, setSettings] = useState<ImageUploadSettings>(readImageUploadSettings)
  const [showToken, setShowToken] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<{ type: "idle" | "success" | "error"; message: string }>({ type: "idle", message: "" })

  const save = () => {
    writeImageUploadSettings(settings)
    setSettings({ apiToken: settings.apiToken.trim() })
    setStatus({ type: "success", message: "Image hosting settings saved on this device." })
  }

  const clear = () => {
    clearImageUploadSettings()
    setSettings({ apiToken: "" })
    setStatus({ type: "success", message: "Image hosting token cleared." })
  }

  const test = async () => {
    if (!settings.apiToken.trim()) {
      setStatus({ type: "error", message: "Enter an API token first." })
      return
    }
    setBusy(true)
    setStatus({ type: "idle", message: "" })
    try {
      const form = new FormData()
      const canvas = document.createElement("canvas")
      canvas.width = 1
      canvas.height = 1
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"))
      if (!blob) throw new Error("Could not create a test image.")
      form.append("file", blob, "test.png")
      form.append("storage", DEFAULT_MEDIA_UPLOAD_STORAGE)
      const response = await fetch("/api/media/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${settings.apiToken.trim()}` },
        body: form,
      })
      const payload = await response.json().catch(() => null) as { error?: string }
      if (!response.ok) throw new Error(payload?.error || "Image service test failed.")
      setStatus({ type: "success", message: "Image service connection is working." })
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : "Image service test failed." })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mx-auto w-full max-w-xl rounded-[20px] border border-black/[0.065] bg-card p-4 dark:border-white/[0.09] sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground"><KeyRound className="size-3" />Image hosting</p>
          <h2 className="mt-2 text-lg font-semibold tracking-[-0.03em]">K-Vault uploads</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">Upload images from the note editor and save their HTTPS download URL. The token stays on this device.</p>
        </div>
        <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-medium text-muted-foreground">{DEFAULT_MEDIA_UPLOAD_STORAGE}</span>
      </div>

      <div className="mt-4 space-y-3">
        <div>
          <Label htmlFor="media-upload-endpoint" className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Upload endpoint</Label>
          <Input id="media-upload-endpoint" value={DEFAULT_MEDIA_UPLOAD_ENDPOINT} readOnly className="mt-1.5 h-10 bg-muted/45 font-mono text-xs" />
        </div>
        <div>
          <Label htmlFor="media-upload-token" className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">API token</Label>
          <div className="relative mt-1.5">
            <Input id="media-upload-token" type={showToken ? "text" : "password"} value={settings.apiToken} placeholder="K-Vault API token" className="h-10 bg-background pr-10 font-mono text-xs" onChange={(event) => { setSettings({ apiToken: event.target.value }); setStatus({ type: "idle", message: "" }) }} />
            <button type="button" aria-label={showToken ? "Hide image hosting token" : "Show image hosting token"} onClick={() => setShowToken((value) => !value)} className="absolute right-1.5 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-[9px] text-muted-foreground hover:bg-muted hover:text-foreground">{showToken ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}</button>
          </div>
        </div>
      </div>

      {status.message ? <p role="status" className={cn("mt-3 rounded-[11px] px-3 py-2 text-xs font-medium", status.type === "error" ? "bg-destructive/8 text-destructive" : "bg-energy/14 text-foreground")}>{status.message}</p> : null}
      <div className="mt-4 grid grid-cols-3 gap-2">
        <Button type="button" variant="outline" className="h-10" disabled={busy} onClick={() => void test()}>{busy ? "Testing…" : "Test"}</Button>
        <Button type="button" className="h-10" disabled={busy} onClick={save}>Save</Button>
        <Button type="button" variant="ghost" className="h-10 text-destructive" disabled={busy || !settings.apiToken} onClick={clear}><Trash2 className="size-3.5" />Clear</Button>
      </div>
    </section>
  )
}
