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
  if (!window.gapi) throw new Error("Google Picker 脚本尚未加载")
  return new Promise((resolve, reject) => {
    const failed = () => reject(new Error("Google Picker 加载失败，请稍后重试"))
    window.gapi!.load("picker", { callback: () => { if (window.google?.picker) resolve(window.google.picker); else failed() }, onerror: failed, ontimeout: failed, timeout: 10_000 })
  })
}

export function GoogleSheetPickerPanel({ enabled, onConnectionChange, onConnected, inventoryKey }: { enabled: boolean; onConnectionChange?: (connected: boolean) => void; onConnected?: () => void; inventoryKey?: number | string }) {
  const connectionSnapshot = useSyncExternalStore(subscribeGoogleSheetConnection, readGoogleSheetConnectionSnapshot, () => null)
  const connection = useMemo(() => readGoogleSheetConnection({ getItem: () => connectionSnapshot }), [connectionSnapshot])
  const [link, setLink] = useState("")
  const [newSheetTitle, setNewSheetTitle] = useState("Anki Studio · 闪卡同步")
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
        const issue = data && typeof data === "object" && "error" in data && typeof (data as { error?: unknown }).error === "string" ? (data as { error: string }).error : "无法读取表格工作表"
        throw new Error(issue)
      }
      setInventory(data as SpreadsheetInventory)
      setInventoryError("")
    } catch (error) {
      setInventoryError(error instanceof Error ? error.message : "无法读取表格工作表")
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
    setMessage("正在检查表格并初始化同步结构…")
    try {
      const response = await fetch("/api/google-sheets/connect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ spreadsheetId }) })
      const data = await response.json().catch(() => null) as unknown
      if (!response.ok) {
        const issue = responseError(data, "无法连接这个 Google Sheet")
        throw new Error(response.status === 403 ? `${issue}。请确认当前 Google 帐号拥有该表格的编辑权限，并重新授权 Google 表格访问。` : issue)
      }
      const sheet = data && typeof data === "object" ? (data as { sheet?: Partial<GoogleSheetConnection> }).sheet : undefined
      if (typeof sheet?.id !== "string" || typeof sheet.name !== "string" || typeof sheet.url !== "string") throw new Error("Google Sheet 连接响应无效")
      const next = { id: sheet.id, name: sheet.name, url: sheet.url }
      writeGoogleSheetConnection(next)
      setLink(next.url)
      setMessage("表格已连接，正在同步卡包数据…")
      onConnectionChange?.(true)
      try { if (onConnected) await Promise.resolve(onConnected()); setMessage("表格绑定成功，已完成双向同步！") } catch { setMessage("表格已绑定成功！") }
      await fetchInventory(next.id)
      window.setTimeout(() => setMessage((current) => current.includes("成功") ? "" : current), 4000)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "无法连接这个 Google Sheet")
    } finally { setBusy(null) }
  }

  const createNewSheet = async () => {
    if (!enabled) { setMessage("请先连接 Google 帐号并授权表格访问"); return }
    setBusy("create")
    setMessage("正在您的 Google Drive 中创建专属闪卡同步表格…")
    try {
      const response = await fetch("/api/google-sheets/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: newSheetTitle.trim() || "Anki Studio · 闪卡同步" }) })
      const data = await response.json().catch(() => null) as unknown
      if (!response.ok) throw new Error(responseError(data, "在 Google Drive 中创建表格失败"))
      const sheet = data && typeof data === "object" ? (data as { sheet?: Partial<GoogleSheetConnection> }).sheet : undefined
      if (typeof sheet?.id !== "string" || typeof sheet.name !== "string" || typeof sheet.url !== "string") throw new Error("创建表格响应无效")
      const next = { id: sheet.id, name: sheet.name, url: sheet.url }
      writeGoogleSheetConnection(next)
      setLink(next.url)
      setMessage("已创建表格，正在同步卡包数据…")
      onConnectionChange?.(true)
      try { if (onConnected) await Promise.resolve(onConnected()); setMessage("已在 Google Drive 中创建表格并完成首次同步！") } catch { setMessage("已成功在 Google Drive 中创建并连接表格！") }
      await fetchInventory(next.id)
      window.setTimeout(() => setMessage((current) => current.includes("成功") ? "" : current), 4000)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "创建表格失败")
    } finally { setBusy(null) }
  }

  const openPicker = async () => {
    if (!enabled) { setMessage("请先连接 Google 帐号并授权表格访问"); return }
    if (!scriptReady && !window.gapi) { setMessage("Google Picker 正在加载，请稍后再试"); return }
    setBusy("picker")
    setMessage("")
    try {
      const [picker, response] = await Promise.all([loadPickerApi(), fetch("/api/google-sheets/picker", { cache: "no-store" })])
      const data = await response.json().catch(() => null) as unknown
      if (!response.ok) throw new Error(responseError(data, "无法启动 Google Picker"))
      const config = data as Partial<PickerConfig>
      if (!config.accessToken || !config.developerKey || !config.appId) throw new Error("Google Picker 配置不完整")
      const view = new picker.DocsView(picker.ViewId.SPREADSHEETS).setMimeTypes("application/vnd.google-apps.spreadsheet").setMode(picker.DocsViewMode.LIST)
      new picker.PickerBuilder().addView(view).setAppId(config.appId).setDeveloperKey(config.developerKey).setOAuthToken(config.accessToken).setOrigin(window.location.origin).setTitle("选择用于 Anki Studio 同步的表格").setCallback((pickerData) => {
        if (pickerData[picker.Response.ACTION] !== picker.Action.PICKED) return
        const documents = pickerData[picker.Response.DOCUMENTS]
        const document = Array.isArray(documents) && documents[0] && typeof documents[0] === "object" ? documents[0] as Record<string, unknown> : null
        const id = document?.[picker.Document.ID]
        if (typeof id === "string") void connect(id)
      }).build().setVisible(true)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "无法启动 Google Picker")
    } finally { setBusy(null) }
  }

  const connectLink = () => {
    const id = parseGoogleSpreadsheetId(link)
    if (!id) { setMessage("请粘贴完整的 Google Sheets 编辑链接或有效 Spreadsheet ID"); return }
    if (!enabled) { setMessage("链接已识别；请先连接 Google 帐号并授权表格访问"); return }
    void connect(id)
  }

  const remove = () => {
    clearGoogleSheetConnection()
    setLink("")
    setInventory(null)
    setMessage("已从当前设备断开表格连接，表格中及本地的数据均完整保留")
    onConnectionChange?.(false)
  }

  const driveUrl = connection ? `https://drive.google.com/file/d/${connection.id}/view` : ""

  return (
    <div className="space-y-3">
      {enabled ? <Script id="google-picker-api" src="https://apis.google.com/js/api.js" strategy="afterInteractive" onReady={() => setScriptReady(true)} onError={() => setMessage("Google Picker 脚本加载失败")} /> : null}

      {connection ? (
        <section className="rounded-[20px] border border-black/[0.065] bg-card p-5 shadow-[0_18px_46px_-42px_rgba(0,0,0,0.45)] dark:border-white/[0.09]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <span className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground"><span className="size-2 rounded-full bg-energy" />Sheet connected</span>
              <h3 className="mt-3 truncate text-xl font-semibold tracking-[-0.035em]">{connection.name}</h3>
              <p className="mt-1 text-xs text-muted-foreground">你的同步数据库已经绑定。</p>
            </div>
            <span className="flex size-11 shrink-0 items-center justify-center rounded-[13px] bg-muted"><FileSpreadsheet className="size-5" /></span>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <a href={connection.url} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-[12px] bg-foreground px-3.5 text-[10px] font-semibold text-background">在 Sheets 打开 <ExternalLink className="size-3" /></a>
            <a href={driveUrl} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-[12px] border border-black/[0.065] bg-card px-3.5 text-[10px] font-semibold dark:border-white/[0.09]">Google Drive <ExternalLink className="size-3" /></a>
          </div>

          {visibleInventory ? (
            <div className="mt-4 rounded-[16px] border border-black/[0.055] bg-background/55 p-3.5 dark:border-white/[0.07]">
              <div className="flex items-center justify-between gap-3"><div><p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Inventory</p><p className="mt-1 text-[15px] font-semibold tracking-[-0.02em]">{visibleInventory.decks.length} 个卡包</p></div><Badge className="border border-black/[0.06] bg-muted px-2.5 py-1 text-[9px] font-medium text-foreground shadow-none dark:border-white/[0.08]">{visibleInventory.sheetCount} sheets</Badge></div>
              {visibleInventory.decks.length > 0 ? <div className="mt-3 flex flex-wrap gap-1.5">{visibleInventory.decks.map((deck) => <span key={deck.deckId} className="max-w-full truncate rounded-[9px] bg-card px-2.5 py-1.5 text-[10px] font-medium">{deck.name}</span>)}</div> : <p className="mt-2 text-xs text-muted-foreground">还没有同步卡包，执行一次同步即可初始化。</p>}
            </div>
          ) : null}

          {inventoryError ? <p className="mt-3 text-xs font-medium text-destructive">{inventoryError}</p> : null}

          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" className="h-11 text-xs" disabled={busy !== null} onClick={() => { setBusy("refresh"); void fetchInventory(connection.id).finally(() => setBusy(null)) }}><RefreshCw className={cn("size-3.5", busy === "refresh" && "animate-spin")} />检查结构</Button>
            <Button type="button" variant="ghost" className="h-11 text-xs text-destructive" onClick={remove}><Trash2 className="size-3.5" />断开表格</Button>
          </div>
        </section>
      ) : (
        <section className="rounded-[20px] border border-black/[0.065] bg-card p-4 shadow-[0_18px_46px_-42px_rgba(0,0,0,0.45)] dark:border-white/[0.09] sm:p-5">
          <div className="flex items-start gap-3.5"><span className="flex size-11 shrink-0 items-center justify-center rounded-[13px] bg-muted"><FileSpreadsheet className="size-5" /></span><div className="min-w-0 flex-1"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Sync database</p><h3 className="mt-1 text-xl font-semibold tracking-[-0.035em]">选择 Google Sheet</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">新建一张专用表格，或者绑定 Drive 中已有的表格。</p></div></div>

          <div className="mt-4 grid grid-cols-3 gap-1.5 rounded-[14px] border border-black/[0.06] bg-muted/55 p-1 dark:border-white/[0.08]">
            {([["create", "新建", FolderPlus], ["picker", "Drive", HardDrive], ["link", "链接", Link2]] as const).map(([id, label, Icon]) => (
              <button key={id} type="button" onClick={() => setActiveTab(id)} className={cn("flex min-h-14 flex-col items-center justify-center gap-1 rounded-[10px] text-[10px] font-medium transition-[background-color,color,transform] active:scale-[0.98]", activeTab === id ? "bg-card text-foreground shadow-[0_6px_16px_-14px_rgba(0,0,0,0.6)]" : "text-muted-foreground")}><Icon className="size-4" />{label}</button>
            ))}
          </div>

          <div className="mt-3 rounded-[16px] border border-black/[0.055] bg-background/55 p-3.5 dark:border-white/[0.07]">
            {activeTab === "create" ? <div className="space-y-3"><div><Label htmlFor="new-sheet-title" className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Sheet name</Label><Input id="new-sheet-title" value={newSheetTitle} onChange={(event) => setNewSheetTitle(event.target.value)} placeholder="Anki Studio · 闪卡同步" disabled={!enabled || busy !== null} className="mt-2 h-11" /></div><Button type="button" disabled={!enabled || busy !== null || !newSheetTitle.trim()} onClick={() => void createNewSheet()} className="h-11 w-full text-xs">{busy === "create" ? <LoaderCircle className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}在 Drive 中创建并绑定</Button></div> : null}

            {activeTab === "picker" ? <div className="space-y-3"><div className="flex items-center gap-2"><div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" /><Input placeholder="搜索 Drive 中的表格…" className="h-10 pl-9 text-xs" value={driveSearch} onChange={(event) => { setDriveSearch(event.target.value); void loadDriveSpreadsheets(event.target.value) }} disabled={!enabled || driveLoading} /></div><Button type="button" size="icon-lg" variant="outline" disabled={!enabled || driveLoading} onClick={() => void loadDriveSpreadsheets(driveSearch)} aria-label="刷新 Drive 表格"><RefreshCw className={cn("size-3.5", driveLoading && "animate-spin")} /></Button></div>
              {driveLoading ? <div className="flex min-h-28 items-center justify-center text-xs text-muted-foreground"><LoaderCircle className="mr-2 size-4 animate-spin" />读取 Drive…</div> : driveFiles.length > 0 ? <div className="max-h-56 space-y-1.5 overflow-y-auto">{driveFiles.map((file) => <div key={file.id} className="flex items-center gap-2 rounded-[12px] bg-card p-2.5"><FileSpreadsheet className="size-4 shrink-0 text-muted-foreground" /><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{file.name}</p>{file.modifiedTime ? <p className="mt-0.5 text-[9px] text-muted-foreground">{new Date(file.modifiedTime).toLocaleDateString()}</p> : null}</div><Button type="button" size="sm" className="h-8 px-3 text-[10px]" disabled={busy !== null} onClick={() => void connect(file.id)}>{busy === "connect" ? <LoaderCircle className="size-3 animate-spin" /> : <Check className="size-3" />}绑定</Button></div>)}</div> : <div className="flex min-h-28 flex-col items-center justify-center text-center"><p className="text-xs text-muted-foreground">{driveLoaded ? "没有找到表格" : "还没有读取 Drive"}</p><Button type="button" size="sm" variant="ghost" className="mt-2 h-8 px-3 text-[10px]" disabled={!enabled || busy !== null} onClick={() => void openPicker()}><HardDrive className="size-3" />打开 Google Picker</Button></div>}
            </div> : null}

            {activeTab === "link" ? <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); connectLink() }}><div><Label htmlFor="google-sheet-link" className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Sheet URL / ID</Label><div className="relative mt-2"><Link2 className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" /><Input id="google-sheet-link" className="h-11 pl-9 text-xs" type="text" inputMode="url" autoComplete="off" placeholder="https://docs.google.com/spreadsheets/d/…/edit" value={link} onChange={(event) => setLink(event.target.value)} /></div></div><Button type="submit" className="h-11 w-full text-xs" disabled={busy !== null || !link.trim()}>{busy === "connect" ? <LoaderCircle className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}绑定此表格</Button></form> : null}
          </div>
        </section>
      )}

      {message ? <div className="flex items-start gap-2 rounded-[14px] border border-black/[0.06] bg-card p-3.5 text-xs font-medium leading-5 text-foreground dark:border-white/[0.08]" role="status" aria-live="polite">{busy ? <LoaderCircle className="mt-0.5 size-4 shrink-0 animate-spin" /> : <span className="mt-1 size-2 shrink-0 rounded-full bg-energy" />}<span>{message}</span></div> : null}
    </div>
  )
}
