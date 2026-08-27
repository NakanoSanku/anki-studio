"use client"

import Script from "next/script"
import { useEffect, useMemo, useState, useSyncExternalStore } from "react"
import {
  Check,
  ExternalLink,
  FileSpreadsheet,
  FolderPlus,
  HardDrive,
  Link2,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  clearGoogleSheetConnection,
  readGoogleSheetConnection,
  readGoogleSheetConnectionSnapshot,
  subscribeGoogleSheetConnection,
  writeGoogleSheetConnection,
  type GoogleSheetConnection,
} from "@/lib/google-sheet-connection"
import { GOOGLE_SHEET_ID_HEADER, parseGoogleSpreadsheetId } from "@/lib/google-sheet-id"
import type { SpreadsheetInventory } from "@/lib/sync-types"
import { cn } from "@/lib/utils"

type PickerConfig = { accessToken: string; developerKey: string; appId: string }
type PickerBuilder = {
  addView(view: PickerView): PickerBuilder
  setAppId(appId: string): PickerBuilder
  setCallback(callback: (data: Record<string, unknown>) => void): PickerBuilder
  setDeveloperKey(key: string): PickerBuilder
  setOAuthToken(token: string): PickerBuilder
  setOrigin(origin: string): PickerBuilder
  setTitle(title: string): PickerBuilder
  build(): { setVisible(visible: boolean): void }
}
type PickerView = { setMimeTypes(mimeTypes: string): PickerView; setMode(mode: string): PickerView }
type PickerNamespace = {
  Action: { PICKED: string }
  Document: { ID: string; NAME: string; URL: string }
  Response: { ACTION: string; DOCUMENTS: string }
  DocsViewMode: { LIST: string }
  ViewId: { SPREADSHEETS: string }
  DocsView: new (viewId: string) => PickerView
  PickerBuilder: new () => PickerBuilder
}

declare global {
  interface Window {
    gapi?: { load(api: string, options: { callback: () => void; onerror: () => void; ontimeout: () => void; timeout: number }): void }
    google?: { picker?: PickerNamespace }
  }
}

function responseError(data: unknown, fallback: string): string {
  if (data && typeof data === "object" && "error" in data) {
    const error = (data as Record<string, unknown>).error
    if (typeof error === "string" && error.trim()) return error
  }
  return fallback
}

async function loadPickerApi(): Promise<PickerNamespace> {
  if (window.google?.picker) return window.google.picker
  if (!window.gapi) throw new Error("The Google Picker script has not loaded yet")
  return new Promise((resolve, reject) => {
    const failed = () => reject(new Error("Google Picker failed to load. Try again in a moment."))
    window.gapi!.load("picker", { callback: () => { if (window.google?.picker) resolve(window.google.picker); else failed() }, onerror: failed, ontimeout: failed, timeout: 10_000 })
  })
}

export function GoogleSheetPickerPanel({ enabled, onConnectionChange, onConnected, inventoryKey }: { enabled: boolean; onConnectionChange?: (connected: boolean) => void; onConnected?: () => void; inventoryKey?: number | string }) {
  const connectionSnapshot = useSyncExternalStore(subscribeGoogleSheetConnection, readGoogleSheetConnectionSnapshot, () => null)
  const connection = useMemo(() => readGoogleSheetConnection({ getItem: () => connectionSnapshot }), [connectionSnapshot])
  const [link, setLink] = useState("")
  const [newSheetTitle, setNewSheetTitle] = useState("Anki Studio · Flashcard Sync")
  const [scriptReady, setScriptReady] = useState(false)
  const [busy, setBusy] = useState<"picker" | "connect" | "create" | "refresh" | null>(null)
  const [message, setMessage] = useState("")
  const [inventory, setInventory] = useState<SpreadsheetInventory | null>(null)
  const [inventoryError, setInventoryError] = useState("")
  const [activeTab, setActiveTab] = useState<"create" | "picker" | "link">("create")
  const [driveFiles, setDriveFiles] = useState<Array<{ id: string; name: string; modifiedTime?: string; webViewLink?: string }>>([])
  const [driveLoading, setDriveLoading] = useState(false)
  const [driveSearch, setDriveSearch] = useState("")
  const [driveLoaded, setDriveLoaded] = useState(false)

  const loadDriveSpreadsheets = async (searchQuery = "") => {
    if (!enabled) return
    setDriveLoading(true)
    try {
      const queryParam = searchQuery.trim() ? `?q=${encodeURIComponent(searchQuery.trim())}` : ""
      const response = await fetch(`/api/google-sheets/list${queryParam}`, { cache: "no-store" })
      const data = await response.json().catch(() => null) as { files?: Array<{ id: string; name: string; modifiedTime?: string; webViewLink?: string }> } | null
      setDriveFiles(data?.files || [])
      setDriveLoaded(true)
    } catch {
      setDriveFiles([])
      setDriveLoaded(true)
    } finally {
      setDriveLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    if (activeTab === "picker" && enabled && !driveLoaded) {
      void fetch("/api/google-sheets/list", { cache: "no-store" }).then((response) => response.json()).then((data: { files?: Array<{ id: string; name: string; modifiedTime?: string; webViewLink?: string }> }) => {
        if (!active) return
        setDriveFiles(data?.files || [])
        setDriveLoaded(true)
      }).catch(() => {
        if (!active) return
        setDriveFiles([])
        setDriveLoaded(true)
      })
    }
    return () => { active = false }
  }, [activeTab, enabled, driveLoaded])

  useEffect(() => { onConnectionChange?.(Boolean(connection)) }, [connection, onConnectionChange])

  const fetchInventory = async (spreadsheetId: string) => {
    try {
      const response = await fetch("/api/sync/sheets", { cache: "no-store", headers: { [GOOGLE_SHEET_ID_HEADER]: spreadsheetId } })
      const data = await response.json().catch(() => null) as unknown
      if (!response.ok) {
        const issue = data && typeof data === "object" && "error" in data && typeof (data as { error?: unknown }).error === "string" ? (data as { error: string }).error : "Unable to read spreadsheet tabs"
        throw new Error(issue)
      }
      setInventory(data as SpreadsheetInventory)
      setInventoryError("")
    } catch (error) {
      setInventoryError(error instanceof Error ? error.message : "Unable to read spreadsheet tabs")
    }
  }

  useEffect(() => {
    if (!connection || !enabled) return
    let cancelled = false
    void (async () => { if (!cancelled) await fetchInventory(connection.id) })()
    return () => { cancelled = true }
  }, [connection, enabled, inventoryKey])

  const visibleInventory = connection && inventory?.spreadsheetId === connection.id ? inventory : null

  const connect = async (spreadsheetId: string) => {
    setBusy("connect")
    setMessage("Checking the spreadsheet and initializing the sync structure…")
    try {
      const response = await fetch("/api/google-sheets/connect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ spreadsheetId }) })
      const data = await response.json().catch(() => null) as unknown
      if (!response.ok) {
        const issue = responseError(data, "Unable to connect this Google Sheet")
        throw new Error(response.status === 403 ? `${issue}. Make sure the current Google account can edit this spreadsheet, then authorize Google Sheets again.` : issue)
      }
      const sheet = data && typeof data === "object" ? (data as { sheet?: Partial<GoogleSheetConnection> }).sheet : undefined
      if (typeof sheet?.id !== "string" || typeof sheet.name !== "string" || typeof sheet.url !== "string") throw new Error("The Google Sheet connection response is invalid")
      const next = { id: sheet.id, name: sheet.name, url: sheet.url }
      writeGoogleSheetConnection(next)
      setLink(next.url)
      setMessage("Sheet connected. Syncing deck data…")
      onConnectionChange?.(true)
      try { if (onConnected) await Promise.resolve(onConnected()); setMessage("Sheet connected and two-way sync completed") } catch { setMessage("Sheet connected successfully") }
      await fetchInventory(next.id)
      window.setTimeout(() => setMessage((current) => current.toLowerCase().includes("success") || current.toLowerCase().includes("completed") ? "" : current), 4000)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to connect this Google Sheet")
    } finally { setBusy(null) }
  }

  const createNewSheet = async () => {
    if (!enabled) { setMessage("Connect your Google account and authorize Sheets access first"); return }
    setBusy("create")
    setMessage("Creating a dedicated sync spreadsheet in your Google Drive…")
    try {
      const response = await fetch("/api/google-sheets/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: newSheetTitle.trim() || "Anki Studio · Flashcard Sync" }) })
      const data = await response.json().catch(() => null) as unknown
      if (!response.ok) throw new Error(responseError(data, "Unable to create a spreadsheet in Google Drive"))
      const sheet = data && typeof data === "object" ? (data as { sheet?: Partial<GoogleSheetConnection> }).sheet : undefined
      if (typeof sheet?.id !== "string" || typeof sheet.name !== "string" || typeof sheet.url !== "string") throw new Error("The create-spreadsheet response is invalid")
      const next = { id: sheet.id, name: sheet.name, url: sheet.url }
      writeGoogleSheetConnection(next)
      setLink(next.url)
      setMessage("Spreadsheet created. Syncing deck data…")
      onConnectionChange?.(true)
      try { if (onConnected) await Promise.resolve(onConnected()); setMessage("Spreadsheet created in Google Drive and first sync completed") } catch { setMessage("Spreadsheet created and connected successfully") }
      await fetchInventory(next.id)
      window.setTimeout(() => setMessage((current) => current.toLowerCase().includes("success") || current.toLowerCase().includes("completed") ? "" : current), 4000)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create the spreadsheet")
    } finally { setBusy(null) }
  }

  const openPicker = async () => {
    if (!enabled) { setMessage("Connect your Google account and authorize Sheets access first"); return }
    if (!scriptReady && !window.gapi) { setMessage("Google Picker is still loading. Try again in a moment."); return }
    setBusy("picker")
    setMessage("")
    try {
      const [picker, response] = await Promise.all([loadPickerApi(), fetch("/api/google-sheets/picker", { cache: "no-store" })])
      const data = await response.json().catch(() => null) as unknown
      if (!response.ok) throw new Error(responseError(data, "Unable to start Google Picker"))
      const config = data as Partial<PickerConfig>
      if (!config.accessToken || !config.developerKey || !config.appId) throw new Error("Google Picker configuration is incomplete")
      const view = new picker.DocsView(picker.ViewId.SPREADSHEETS).setMimeTypes("application/vnd.google-apps.spreadsheet").setMode(picker.DocsViewMode.LIST)
      new picker.PickerBuilder().addView(view).setAppId(config.appId).setDeveloperKey(config.developerKey).setOAuthToken(config.accessToken).setOrigin(window.location.origin).setTitle("Choose a spreadsheet for Anki Studio sync").setCallback((pickerData) => {
        if (pickerData[picker.Response.ACTION] !== picker.Action.PICKED) return
        const documents = pickerData[picker.Response.DOCUMENTS]
        const document = Array.isArray(documents) && documents[0] && typeof documents[0] === "object" ? documents[0] as Record<string, unknown> : null
        const id = document?.[picker.Document.ID]
        if (typeof id === "string") void connect(id)
      }).build().setVisible(true)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to start Google Picker")
    } finally { setBusy(null) }
  }

  const connectLink = () => {
    const id = parseGoogleSpreadsheetId(link)
    if (!id) { setMessage("Paste a complete Google Sheets edit URL or a valid spreadsheet ID"); return }
    if (!enabled) { setMessage("Link recognized. Connect your Google account and authorize Sheets access first."); return }
    void connect(id)
  }

  const remove = () => {
    clearGoogleSheetConnection()
    setLink("")
    setInventory(null)
    setMessage("Spreadsheet disconnected from this device. Local and Google Sheets data are preserved.")
    onConnectionChange?.(false)
  }

  const driveUrl = connection ? `https://drive.google.com/file/d/${connection.id}/view` : ""

  return (
    <div className="space-y-3">
      {enabled ? <Script id="google-picker-api" src="https://apis.google.com/js/api.js" strategy="afterInteractive" onReady={() => setScriptReady(true)} onError={() => setMessage("Google Picker script failed to load")} /> : null}

      {connection ? (
        <section className="rounded-[20px] border border-black/[0.065] bg-card p-5 shadow-[0_18px_46px_-42px_rgba(0,0,0,0.45)] dark:border-white/[0.09]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <span className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground"><span className="size-2 rounded-full bg-energy" />Sheet connected</span>
              <h3 className="mt-3 truncate text-xl font-semibold tracking-[-0.035em]">{connection.name}</h3>
              <p className="mt-1 text-xs text-muted-foreground">Your sync database is connected.</p>
            </div>
            <span className="flex size-11 shrink-0 items-center justify-center rounded-[13px] bg-muted"><FileSpreadsheet className="size-5" /></span>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <a href={connection.url} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-[12px] bg-foreground px-3.5 text-[10px] font-semibold text-background">Open in Sheets <ExternalLink className="size-3" /></a>
            <a href={driveUrl} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-[12px] border border-black/[0.065] bg-card px-3.5 text-[10px] font-semibold dark:border-white/[0.09]">Google Drive <ExternalLink className="size-3" /></a>
          </div>

          {visibleInventory ? (
            <div className="mt-4 rounded-[16px] border border-black/[0.055] bg-background/55 p-3.5 dark:border-white/[0.07]">
              <div className="flex items-center justify-between gap-3"><div><p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Inventory</p><p className="mt-1 text-[15px] font-semibold tracking-[-0.02em]">{visibleInventory.decks.length} decks</p></div><Badge className="border border-black/[0.06] bg-muted px-2.5 py-1 text-[9px] font-medium text-foreground shadow-none dark:border-white/[0.08]">{visibleInventory.sheetCount} sheets</Badge></div>
              {visibleInventory.decks.length > 0 ? <div className="mt-3 flex flex-wrap gap-1.5">{visibleInventory.decks.map((deck) => <span key={deck.deckId} className="max-w-full truncate rounded-[9px] bg-card px-2.5 py-1.5 text-[10px] font-medium">{deck.name}</span>)}</div> : <p className="mt-2 text-xs text-muted-foreground">No decks have been synced yet. Run sync once to initialize them.</p>}
            </div>
          ) : null}

          {inventoryError ? <p className="mt-3 text-xs font-medium text-destructive">{inventoryError}</p> : null}

          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" className="h-11 text-xs" disabled={busy !== null} onClick={() => { setBusy("refresh"); void fetchInventory(connection.id).finally(() => setBusy(null)) }}><RefreshCw className={cn("size-3.5", busy === "refresh" && "animate-spin")} />Check structure</Button>
            <Button type="button" variant="ghost" className="h-11 text-xs text-destructive" onClick={remove}><Trash2 className="size-3.5" />Disconnect</Button>
          </div>
        </section>
      ) : (
        <section className="rounded-[20px] border border-black/[0.065] bg-card p-4 shadow-[0_18px_46px_-42px_rgba(0,0,0,0.45)] dark:border-white/[0.09] sm:p-5">
          <div className="flex items-start gap-3.5"><span className="flex size-11 shrink-0 items-center justify-center rounded-[13px] bg-muted"><FileSpreadsheet className="size-5" /></span><div className="min-w-0 flex-1"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Sync database</p><h3 className="mt-1 text-xl font-semibold tracking-[-0.035em]">Choose a Google Sheet</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">Create a dedicated spreadsheet or connect one that already exists in Drive.</p></div></div>

          <div className="mt-4 grid grid-cols-3 gap-1.5 rounded-[14px] border border-black/[0.06] bg-muted/55 p-1 dark:border-white/[0.08]">
            {([["create", "Create", FolderPlus], ["picker", "Drive", HardDrive], ["link", "Link", Link2]] as const).map(([id, label, Icon]) => (
              <button key={id} type="button" onClick={() => setActiveTab(id)} className={cn("flex min-h-14 flex-col items-center justify-center gap-1 rounded-[10px] text-[10px] font-medium transition-[background-color,color,transform] active:scale-[0.98]", activeTab === id ? "bg-card text-foreground shadow-[0_6px_16px_-14px_rgba(0,0,0,0.6)]" : "text-muted-foreground")}><Icon className="size-4" />{label}</button>
            ))}
          </div>

          <div className="mt-3 rounded-[16px] border border-black/[0.055] bg-background/55 p-3.5 dark:border-white/[0.07]">
            {activeTab === "create" ? <div className="space-y-3"><div><Label htmlFor="new-sheet-title" className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Sheet name</Label><Input id="new-sheet-title" value={newSheetTitle} onChange={(event) => setNewSheetTitle(event.target.value)} placeholder="Anki Studio · Flashcard Sync" disabled={!enabled || busy !== null} className="mt-2 h-11" /></div><Button type="button" disabled={!enabled || busy !== null || !newSheetTitle.trim()} onClick={() => void createNewSheet()} className="h-11 w-full text-xs">{busy === "create" ? <LoaderCircle className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}Create in Drive & connect</Button></div> : null}

            {activeTab === "picker" ? <div className="space-y-3"><div className="flex items-center gap-2"><div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Search spreadsheets in Drive…" className="h-10 pl-9 text-xs" value={driveSearch} onChange={(event) => { setDriveSearch(event.target.value); void loadDriveSpreadsheets(event.target.value) }} disabled={!enabled || driveLoading} /></div><Button type="button" size="icon-lg" variant="outline" disabled={!enabled || driveLoading} onClick={() => void loadDriveSpreadsheets(driveSearch)} aria-label="Refresh Drive spreadsheets"><RefreshCw className={cn("size-3.5", driveLoading && "animate-spin")} /></Button></div>
              {driveLoading ? <div className="flex min-h-28 items-center justify-center text-xs text-muted-foreground"><LoaderCircle className="mr-2 size-4 animate-spin" />Loading Drive…</div> : driveFiles.length > 0 ? <div className="max-h-56 space-y-1.5 overflow-y-auto">{driveFiles.map((file) => <div key={file.id} className="flex items-center gap-2 rounded-[12px] bg-card p-2.5"><FileSpreadsheet className="size-4 shrink-0 text-muted-foreground" /><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{file.name}</p>{file.modifiedTime ? <p className="mt-0.5 text-[9px] text-muted-foreground">{new Date(file.modifiedTime).toLocaleDateString()}</p> : null}</div><Button type="button" size="sm" className="h-8 px-3 text-[10px]" disabled={busy !== null} onClick={() => void connect(file.id)}>{busy === "connect" ? <LoaderCircle className="size-3 animate-spin" /> : <Check className="size-3" />}Connect</Button></div>)}</div> : <div className="flex min-h-28 flex-col items-center justify-center text-center"><p className="text-xs text-muted-foreground">{driveLoaded ? "No spreadsheets found" : "Drive has not been loaded yet"}</p><Button type="button" size="sm" variant="ghost" className="mt-2 h-8 px-3 text-[10px]" disabled={!enabled || busy !== null} onClick={() => void openPicker()}><HardDrive className="size-3" />Open Google Picker</Button></div>}
            </div> : null}

            {activeTab === "link" ? <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); connectLink() }}><div><Label htmlFor="google-sheet-link" className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Sheet URL / ID</Label><div className="relative mt-2"><Link2 className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" /><Input id="google-sheet-link" className="h-11 pl-9 text-xs" type="text" inputMode="url" autoComplete="off" placeholder="https://docs.google.com/spreadsheets/d/…/edit" value={link} onChange={(event) => setLink(event.target.value)} /></div></div><Button type="submit" className="h-11 w-full text-xs" disabled={busy !== null || !link.trim()}>{busy === "connect" ? <LoaderCircle className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}Connect this sheet</Button></form> : null}
          </div>
        </section>
      )}

      {message ? <div className="flex items-start gap-2 rounded-[14px] border border-black/[0.06] bg-card p-3.5 text-xs font-medium leading-5 text-foreground dark:border-white/[0.08]" role="status" aria-live="polite">{busy ? <LoaderCircle className="mt-0.5 size-4 shrink-0 animate-spin" /> : <span className="mt-1 size-2 shrink-0 rounded-full bg-energy" />}<span>{message}</span></div> : null}
    </div>
  )
}
