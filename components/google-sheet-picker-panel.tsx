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
  Sparkles,
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

type PickerConfig = {
  accessToken: string
  developerKey: string
  appId: string
}

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

type PickerView = {
  setMimeTypes(mimeTypes: string): PickerView
  setMode(mode: string): PickerView
}

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
    gapi?: {
      load(
        api: string,
        options: {
          callback: () => void
          onerror: () => void
          ontimeout: () => void
          timeout: number
        }
      ): void
    }
    google?: { picker?: PickerNamespace }
  }
}

const tabStyles = {
  create: "bg-[#d8f4aa] text-[#315f18] dark:bg-[#385528] dark:text-[#e4f8c5]",
  picker: "bg-[#dff1ff] text-[#174f85] dark:bg-[#244d74] dark:text-[#dceeff]",
  link: "bg-[#ffe39a] text-[#654600] dark:bg-[#68551f] dark:text-[#ffedb8]",
} as const

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
    window.gapi!.load("picker", {
      callback: () => {
        if (window.google?.picker) resolve(window.google.picker)
        else failed()
      },
      onerror: failed,
      ontimeout: failed,
      timeout: 10_000,
    })
  })
}

export function GoogleSheetPickerPanel({
  enabled,
  onConnectionChange,
  onConnected,
  inventoryKey,
}: {
  enabled: boolean
  onConnectionChange?: (connected: boolean) => void
  onConnected?: () => void
  inventoryKey?: number | string
}) {
  const connectionSnapshot = useSyncExternalStore(
    subscribeGoogleSheetConnection,
    readGoogleSheetConnectionSnapshot,
    () => null
  )
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
      void fetch("/api/google-sheets/list", { cache: "no-store" })
        .then((response) => response.json())
        .then((data: { files?: Array<{ id: string; name: string; modifiedTime?: string; webViewLink?: string }> }) => {
          if (!active) return
          setDriveFiles(data?.files || [])
          setDriveLoaded(true)
        })
        .catch(() => {
          if (!active) return
          setDriveFiles([])
          setDriveLoaded(true)
        })
    }
    return () => {
      active = false
    }
  }, [activeTab, enabled, driveLoaded])

  useEffect(() => {
    onConnectionChange?.(Boolean(connection))
  }, [connection, onConnectionChange])

  const fetchInventory = async (spreadsheetId: string) => {
    try {
      const response = await fetch("/api/sync/sheets", {
        cache: "no-store",
        headers: { [GOOGLE_SHEET_ID_HEADER]: spreadsheetId },
      })
      const data = await response.json().catch(() => null) as unknown
      if (!response.ok) {
        const issue = data && typeof data === "object" && "error" in data && typeof (data as { error?: unknown }).error === "string"
          ? (data as { error: string }).error
          : "无法读取表格工作表"
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
    void (async () => {
      if (!cancelled) await fetchInventory(connection.id)
    })()
    return () => {
      cancelled = true
    }
  }, [connection, enabled, inventoryKey])

  const visibleInventory = connection && inventory?.spreadsheetId === connection.id ? inventory : null

  const connect = async (spreadsheetId: string) => {
    setBusy("connect")
    setMessage("正在检查表格并初始化同步结构…")
    try {
      const response = await fetch("/api/google-sheets/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spreadsheetId }),
      })
      const data = await response.json().catch(() => null) as unknown
      if (!response.ok) {
        const issue = responseError(data, "无法连接这个 Google Sheet")
        throw new Error(response.status === 403
          ? `${issue}。请确认当前 Google 帐号拥有该表格的编辑权限，并重新授权 Google 表格访问。`
          : issue)
      }
      const sheet = data && typeof data === "object" ? (data as { sheet?: Partial<GoogleSheetConnection> }).sheet : undefined
      if (typeof sheet?.id !== "string" || typeof sheet.name !== "string" || typeof sheet.url !== "string") {
        throw new Error("Google Sheet 连接响应无效")
      }
      const next = { id: sheet.id, name: sheet.name, url: sheet.url }
      writeGoogleSheetConnection(next)
      setLink(next.url)
      setMessage("表格已连接，正在同步卡包数据…")
      onConnectionChange?.(true)
      try {
        if (onConnected) await Promise.resolve(onConnected())
        setMessage("表格绑定成功，已完成双向同步！")
      } catch {
        setMessage("表格已绑定成功！")
      }
      await fetchInventory(next.id)
      window.setTimeout(() => setMessage((current) => current.includes("成功") ? "" : current), 4000)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "无法连接这个 Google Sheet")
    } finally {
      setBusy(null)
    }
  }

  const createNewSheet = async () => {
    if (!enabled) {
      setMessage("请先连接 Google 帐号并授权表格访问")
      return
    }
    setBusy("create")
    setMessage("正在您的 Google Drive 中创建专属闪卡同步表格…")
    try {
      const response = await fetch("/api/google-sheets/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newSheetTitle.trim() || "Anki Studio · 闪卡同步" }),
      })
      const data = await response.json().catch(() => null) as unknown
      if (!response.ok) throw new Error(responseError(data, "在 Google Drive 中创建表格失败"))
      const sheet = data && typeof data === "object" ? (data as { sheet?: Partial<GoogleSheetConnection> }).sheet : undefined
      if (typeof sheet?.id !== "string" || typeof sheet.name !== "string" || typeof sheet.url !== "string") {
        throw new Error("创建表格响应无效")
      }
      const next = { id: sheet.id, name: sheet.name, url: sheet.url }
      writeGoogleSheetConnection(next)
      setLink(next.url)
      setMessage("已创建表格，正在同步卡包数据…")
      onConnectionChange?.(true)
      try {
        if (onConnected) await Promise.resolve(onConnected())
        setMessage("已在 Google Drive 中创建表格并完成首次同步！")
      } catch {
        setMessage("已成功在 Google Drive 中创建并连接表格！")
      }
      await fetchInventory(next.id)
      window.setTimeout(() => setMessage((current) => current.includes("成功") ? "" : current), 4000)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "创建表格失败")
    } finally {
      setBusy(null)
    }
  }

  const openPicker = async () => {
    if (!enabled) {
      setMessage("请先连接 Google 帐号并授权表格访问")
      return
    }
    if (!scriptReady && !window.gapi) {
      setMessage("Google Picker 正在加载，请稍后再试")
      return
    }
    setBusy("picker")
    setMessage("")
    try {
      const [picker, response] = await Promise.all([
        loadPickerApi(),
        fetch("/api/google-sheets/picker", { cache: "no-store" }),
      ])
      const data = await response.json().catch(() => null) as unknown
      if (!response.ok) throw new Error(responseError(data, "无法启动 Google Picker"))
      const config = data as Partial<PickerConfig>
      if (!config.accessToken || !config.developerKey || !config.appId) throw new Error("Google Picker 配置不完整")
      const view = new picker.DocsView(picker.ViewId.SPREADSHEETS)
        .setMimeTypes("application/vnd.google-apps.spreadsheet")
        .setMode(picker.DocsViewMode.LIST)
      new picker.PickerBuilder()
        .addView(view)
        .setAppId(config.appId)
        .setDeveloperKey(config.developerKey)
        .setOAuthToken(config.accessToken)
        .setOrigin(window.location.origin)
        .setTitle("选择用于 Anki Studio 同步的表格")
        .setCallback((pickerData) => {
          if (pickerData[picker.Response.ACTION] !== picker.Action.PICKED) return
          const documents = pickerData[picker.Response.DOCUMENTS]
          const document = Array.isArray(documents) && documents[0] && typeof documents[0] === "object"
            ? documents[0] as Record<string, unknown>
            : null
          const id = document?.[picker.Document.ID]
          if (typeof id === "string") void connect(id)
        })
        .build()
        .setVisible(true)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "无法启动 Google Picker")
    } finally {
      setBusy(null)
    }
  }

  const connectLink = () => {
    const id = parseGoogleSpreadsheetId(link)
    if (!id) {
      setMessage("请粘贴完整的 Google Sheets 编辑链接或有效 Spreadsheet ID")
      return
    }
    if (!enabled) {
      setMessage("链接已识别；请先连接 Google 帐号并授权表格访问")
      return
    }
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
      {enabled ? (
        <Script
          id="google-picker-api"
          src="https://apis.google.com/js/api.js"
          strategy="afterInteractive"
          onReady={() => setScriptReady(true)}
          onError={() => setMessage("Google Picker 脚本加载失败")}
        />
      ) : null}

      {connection ? (
        <section className="relative overflow-hidden rounded-[2rem] bg-[#d8f4aa] p-5 text-[#315f18] shadow-[0_22px_60px_-46px_rgba(0,0,0,0.7)] dark:bg-[#385528] dark:text-[#e4f8c5]">
          <div className="pointer-events-none absolute -right-12 -top-10 size-40 rounded-[48%_52%_60%_40%/56%_44%_56%_44%] bg-[#ffe39a] opacity-80 dark:bg-[#68551f]" aria-hidden="true" />
          <div className="relative z-10">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <span className="inline-flex items-center rounded-full bg-white/50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] dark:bg-black/15">
                  <Check className="mr-1 size-3" />sheet connected
                </span>
                <h3 className="mt-4 truncate text-2xl font-black tracking-[-0.055em]">{connection.name}</h3>
                <p className="mt-1 text-xs font-semibold opacity-55">你的同步数据库已经绑定。</p>
              </div>
              <span className="flex size-12 shrink-0 items-center justify-center rounded-[1.2rem] bg-white/55 dark:bg-black/15">
                <FileSpreadsheet className="size-5" />
              </span>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <a href={connection.url} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-full bg-black px-3.5 text-[10px] font-black text-white dark:bg-white dark:text-black">
                在 Sheets 打开 <ExternalLink className="size-3" />
              </a>
              <a href={driveUrl} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white/55 px-3.5 text-[10px] font-black dark:bg-black/15">
                Google Drive <ExternalLink className="size-3" />
              </a>
            </div>

            {visibleInventory ? (
              <div className="mt-5 rounded-[1.5rem] bg-white/45 p-3.5 dark:bg-black/15">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] opacity-45">inventory</p>
                    <p className="mt-0.5 text-lg font-black tracking-[-0.035em]">{visibleInventory.decks.length} 个卡包</p>
                  </div>
                  <Badge className="border-0 bg-black px-2.5 py-1 text-[9px] font-black text-white shadow-none dark:bg-white dark:text-black">{visibleInventory.sheetCount} sheets</Badge>
                </div>
                {visibleInventory.decks.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {visibleInventory.decks.map((deck) => (
                      <span key={deck.deckId} className="max-w-full truncate rounded-full bg-white/60 px-3 py-1.5 text-[10px] font-black dark:bg-white/10">
                        {deck.name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs font-semibold opacity-55">还没有同步卡包，执行一次同步即可初始化。</p>
                )}
              </div>
            ) : null}

            {inventoryError ? <p className="mt-3 text-xs font-bold text-[#7b3f00] dark:text-[#ffd29f]">{inventoryError}</p> : null}

            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="ghost"
                className="h-11 bg-white/50 text-xs font-black text-current hover:bg-white/75 hover:text-current dark:bg-black/15 dark:hover:bg-black/25"
                disabled={busy !== null}
                onClick={() => {
                  setBusy("refresh")
                  void fetchInventory(connection.id).finally(() => setBusy(null))
                }}
              >
                <RefreshCw className={cn("size-3.5", busy === "refresh" && "animate-spin")} />检查结构
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-11 bg-black/8 text-xs font-black text-current hover:bg-black/12 hover:text-current dark:bg-white/10 dark:hover:bg-white/15"
                onClick={remove}
              >
                <Trash2 className="size-3.5" />断开表格
              </Button>
            </div>
          </div>
        </section>
      ) : (
        <section className="rounded-[2rem] bg-card p-4 shadow-[0_22px_60px_-46px_rgba(0,0,0,0.7)] sm:p-5">
          <div className="flex items-start gap-3.5">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-[1.2rem] bg-[#d8f4aa] text-[#315f18] dark:bg-[#385528] dark:text-[#e4f8c5]">
              <FileSpreadsheet className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">sync database</p>
              <h3 className="mt-1 text-xl font-black tracking-[-0.045em]">选择 Google Sheet</h3>
              <p className="mt-1 text-xs font-medium leading-5 text-muted-foreground">新建一张专用表格，或者绑定 Drive 中已有的表格。</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-1.5">
            {([
              ["create", "新建", FolderPlus],
              ["picker", "Drive", HardDrive],
              ["link", "链接", Link2],
            ] as const).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={cn(
                  "flex min-h-16 flex-col items-center justify-center gap-1 rounded-[1.25rem] text-[10px] font-black transition-transform active:scale-95",
                  activeTab === id ? tabStyles[id] : "bg-muted/55 text-muted-foreground"
                )}
              >
                <Icon className="size-4" />{label}
              </button>
            ))}
          </div>

          <div className={cn("mt-3 rounded-[1.6rem] p-3.5", tabStyles[activeTab])}>
            {activeTab === "create" ? (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="new-sheet-title" className="text-[10px] font-black uppercase tracking-[0.14em] text-current opacity-50">Sheet name</Label>
                  <Input
                    id="new-sheet-title"
                    value={newSheetTitle}
                    onChange={(event) => setNewSheetTitle(event.target.value)}
                    placeholder="Anki Studio · 闪卡同步"
                    disabled={!enabled || busy !== null}
                    className="mt-2 h-11 border-0 bg-white/60 text-xs font-bold shadow-none dark:bg-black/15"
                  />
                </div>
                <Button
                  type="button"
                  disabled={!enabled || busy !== null || !newSheetTitle.trim()}
                  onClick={() => void createNewSheet()}
                  className="h-11 w-full bg-black text-xs font-black text-white hover:bg-black/85 dark:bg-white dark:text-black"
                >
                  {busy === "create" ? <LoaderCircle className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
                  在 Drive 中创建并绑定
                </Button>
              </div>
            ) : null}

            {activeTab === "picker" ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="relative min-w-0 flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 opacity-45" />
                    <Input
                      placeholder="搜索 Drive 中的表格…"
                      className="h-10 border-0 bg-white/60 pl-9 text-xs font-semibold shadow-none dark:bg-black/15"
                      value={driveSearch}
                      onChange={(event) => {
                        setDriveSearch(event.target.value)
                        void loadDriveSpreadsheets(event.target.value)
                      }}
                      disabled={!enabled || driveLoading}
                    />
                  </div>
                  <Button
                    type="button"
                    size="icon-lg"
                    variant="ghost"
                    className="bg-white/55 text-current hover:bg-white/75 hover:text-current dark:bg-black/15"
                    disabled={!enabled || driveLoading}
                    onClick={() => void loadDriveSpreadsheets(driveSearch)}
                    aria-label="刷新 Drive 表格"
                  >
                    <RefreshCw className={cn("size-3.5", driveLoading && "animate-spin")} />
                  </Button>
                </div>

                {driveLoading ? (
                  <div className="flex min-h-28 items-center justify-center text-xs font-bold opacity-55"><LoaderCircle className="mr-2 size-4 animate-spin" />读取 Drive…</div>
                ) : driveFiles.length > 0 ? (
                  <div className="max-h-56 space-y-1.5 overflow-y-auto">
                    {driveFiles.map((file) => (
                      <div key={file.id} className="flex items-center gap-2 rounded-[1.15rem] bg-white/55 p-2.5 dark:bg-black/15">
                        <FileSpreadsheet className="size-4 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-black">{file.name}</p>
                          {file.modifiedTime ? <p className="mt-0.5 text-[9px] font-semibold opacity-45">{new Date(file.modifiedTime).toLocaleDateString()}</p> : null}
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          className="h-8 bg-black px-3 text-[10px] font-black text-white hover:bg-black/85 dark:bg-white dark:text-black"
                          disabled={busy !== null}
                          onClick={() => void connect(file.id)}
                        >
                          {busy === "connect" ? <LoaderCircle className="size-3 animate-spin" /> : <Check className="size-3" />}
                          绑定
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex min-h-28 flex-col items-center justify-center text-center">
                    <p className="text-xs font-bold opacity-55">{driveLoaded ? "没有找到表格" : "还没有读取 Drive"}</p>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="mt-2 h-8 bg-white/50 px-3 text-[10px] font-black text-current hover:bg-white/75 hover:text-current dark:bg-black/15"
                      disabled={!enabled || busy !== null}
                      onClick={() => void openPicker()}
                    >
                      <HardDrive className="size-3" />打开 Google Picker
                    </Button>
                  </div>
                )}
              </div>
            ) : null}

            {activeTab === "link" ? (
              <form
                className="space-y-3"
                onSubmit={(event) => {
                  event.preventDefault()
                  connectLink()
                }}
              >
                <div>
                  <Label htmlFor="google-sheet-link" className="text-[10px] font-black uppercase tracking-[0.14em] text-current opacity-50">Sheet URL / ID</Label>
                  <div className="relative mt-2">
                    <Link2 className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 opacity-45" />
                    <Input
                      id="google-sheet-link"
                      className="h-11 border-0 bg-white/60 pl-9 text-xs font-semibold shadow-none dark:bg-black/15"
                      type="text"
                      inputMode="url"
                      autoComplete="off"
                      placeholder="https://docs.google.com/spreadsheets/d/…/edit"
                      value={link}
                      onChange={(event) => setLink(event.target.value)}
                    />
                  </div>
                </div>
                <Button
                  type="submit"
                  className="h-11 w-full bg-black text-xs font-black text-white hover:bg-black/85 dark:bg-white dark:text-black"
                  disabled={busy !== null || !link.trim()}
                >
                  {busy === "connect" ? <LoaderCircle className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                  绑定此表格
                </Button>
              </form>
            ) : null}
          </div>
        </section>
      )}

      {message ? (
        <div className="flex items-start gap-2 rounded-[1.4rem] bg-[#dff1ff] p-3.5 text-xs font-bold leading-5 text-[#174f85] dark:bg-[#244d74] dark:text-[#dceeff]" role="status" aria-live="polite">
          {busy ? <LoaderCircle className="mt-0.5 size-4 shrink-0 animate-spin" /> : <Sparkles className="mt-0.5 size-4 shrink-0" />}
          <span>{message}</span>
        </div>
      ) : null}
    </div>
  )
}
