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
import { getCachedAccessToken } from "@/lib/firebase-auth"
import type { SpreadsheetInventory } from "@/lib/sync-types"

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
  const connection = useMemo(() => readGoogleSheetConnection({
    getItem: () => connectionSnapshot,
  }), [connectionSnapshot])
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
      const token = getCachedAccessToken()
      const headers: Record<string, string> = {}
      if (token) headers["Authorization"] = `Bearer ${token}`

      const queryParam = searchQuery.trim() ? `?q=${encodeURIComponent(searchQuery.trim())}` : ""
      const response = await fetch(`/api/google-sheets/list${queryParam}`, {
        cache: "no-store",
        headers,
      })
      const data = await response.json().catch(() => null) as { files?: Array<{ id: string; name: string; modifiedTime?: string; webViewLink?: string }> } | null
      setDriveFiles(data?.files || [])
      setDriveLoaded(true)
    } catch {
      setDriveFiles([])
    } finally {
      setDriveLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    if (activeTab === "picker" && enabled && !driveLoaded) {
      const token = getCachedAccessToken()
      const headers: Record<string, string> = {}
      if (token) headers["Authorization"] = `Bearer ${token}`

      void fetch("/api/google-sheets/list", { cache: "no-store", headers })
        .then((res) => res.json())
        .then((data: { files?: Array<{ id: string; name: string; modifiedTime?: string; webViewLink?: string }> }) => {
          if (active) {
            setDriveFiles(data?.files || [])
            setDriveLoaded(true)
          }
        })
        .catch(() => {
          if (active) {
            setDriveFiles([])
            setDriveLoaded(true)
          }
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
      const token = getCachedAccessToken()
      const headers: Record<string, string> = { [GOOGLE_SHEET_ID_HEADER]: spreadsheetId }
      if (token) headers["Authorization"] = `Bearer ${token}`

      const response = await fetch("/api/sync/sheets", {
        cache: "no-store",
        headers,
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
      if (cancelled) return
      await fetchInventory(connection.id)
    })()
    return () => {
      cancelled = true
    }
  }, [connection, enabled, inventoryKey])

  const visibleInventory = connection && inventory?.spreadsheetId === connection.id
    ? inventory
    : null

  const connect = async (spreadsheetId: string) => {
    setBusy("connect")
    setMessage("正在检查表格并初始化同步结构…")
    try {
      const token = getCachedAccessToken()
      const headers: Record<string, string> = { "Content-Type": "application/json" }
      if (token) headers["Authorization"] = `Bearer ${token}`

      const response = await fetch("/api/google-sheets/connect", {
        method: "POST",
        headers,
        body: JSON.stringify({ spreadsheetId }),
      })
      const data = await response.json().catch(() => null) as unknown
      if (!response.ok) {
        const issue = responseError(data, "无法连接这个 Google Sheet")
        throw new Error(response.status === 403
          ? `${issue}。请确认当前 Google 帐号拥有该表格的编辑权限，并重新授权 Google 表格访问。`
          : issue)
      }
      const sheet = data && typeof data === "object"
        ? (data as { sheet?: Partial<GoogleSheetConnection> }).sheet
        : undefined
      if (
        typeof sheet?.id !== "string"
        || typeof sheet.name !== "string"
        || typeof sheet.url !== "string"
      ) {
        throw new Error("Google Sheet 连接响应无效")
      }
      const next = { id: sheet.id, name: sheet.name, url: sheet.url }
      writeGoogleSheetConnection(next)
      setLink(next.url)
      setMessage("表格已成功连接！正在同步卡包数据…")
      onConnectionChange?.(true)
      try {
        if (onConnected) {
          await Promise.resolve(onConnected())
        }
        setMessage("表格绑定成功，已完成双向同步！")
      } catch {
        setMessage("表格已绑定成功！")
      }
      await fetchInventory(next.id)
      setTimeout(() => {
        setMessage((current) => current.includes("成功") ? "" : current)
      }, 4000)
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
      const token = getCachedAccessToken()
      const headers: Record<string, string> = { "Content-Type": "application/json" }
      if (token) headers["Authorization"] = `Bearer ${token}`

      const response = await fetch("/api/google-sheets/create", {
        method: "POST",
        headers,
        body: JSON.stringify({ title: newSheetTitle.trim() || "Anki Studio · 闪卡同步" }),
      })
      const data = await response.json().catch(() => null) as unknown
      if (!response.ok) {
        const issue = responseError(data, "在 Google Drive 中创建表格失败")
        throw new Error(issue)
      }
      const sheet = data && typeof data === "object"
        ? (data as { sheet?: Partial<GoogleSheetConnection> }).sheet
        : undefined
      if (
        typeof sheet?.id !== "string"
        || typeof sheet.name !== "string"
        || typeof sheet.url !== "string"
      ) {
        throw new Error("创建表格响应无效")
      }
      const next = { id: sheet.id, name: sheet.name, url: sheet.url }
      writeGoogleSheetConnection(next)
      setLink(next.url)
      setMessage("已创建表格！正在同步卡包数据…")
      onConnectionChange?.(true)
      try {
        if (onConnected) {
          await Promise.resolve(onConnected())
        }
        setMessage("已在 Google Drive 中创建表格并完成首次同步！")
      } catch {
        setMessage("已成功在 Google Drive 中创建并连接表格！")
      }
      await fetchInventory(next.id)
      setTimeout(() => {
        setMessage((current) => current.includes("成功") ? "" : current)
      }, 4000)
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
      const token = getCachedAccessToken()
      const headers: Record<string, string> = {}
      if (token) headers["Authorization"] = `Bearer ${token}`

      const [picker, response] = await Promise.all([
        loadPickerApi(),
        fetch("/api/google-sheets/picker", { cache: "no-store", headers }),
      ])
      const data = await response.json().catch(() => null) as unknown
      if (!response.ok) throw new Error(responseError(data, "无法启动 Google Picker"))
      const config = data as Partial<PickerConfig>
      if (!config.accessToken || !config.developerKey || !config.appId) {
        throw new Error("Google Picker 配置不完整")
      }
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
        <div className="rounded-2xl border border-border/70 bg-card p-3.5 shadow-xs sm:p-4">
          {/* Header with Title and Action buttons */}
          <div className="flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <FileSpreadsheet className="size-4.5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <p className="truncate text-sm font-bold text-foreground">{connection.name}</p>
                  <Badge variant="outline" className="hidden shrink-0 border-emerald-500/30 bg-emerald-50/50 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300 xs:inline-flex">
                    已绑定
                  </Badge>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs">
                  <a
                    href={connection.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-emerald-700 hover:underline dark:text-emerald-400"
                  >
                    在 Sheets 打开
                    <ExternalLink className="size-2.5" />
                  </a>
                  <span className="text-muted-foreground/30">·</span>
                  <a
                    href={driveUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground hover:underline"
                  >
                    云端硬盘
                    <ExternalLink className="size-2.5" />
                  </a>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 rounded-xl px-2.5 text-xs font-medium"
                disabled={busy !== null}
                onClick={() => {
                  setBusy("refresh")
                  void fetchInventory(connection.id).finally(() => setBusy(null))
                }}
              >
                <RefreshCw className={busy === "refresh" ? "size-3 animate-spin" : "size-3 sm:mr-1"} />
                <span className="hidden sm:inline">检查结构</span>
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 rounded-xl px-2 text-xs font-medium text-destructive hover:bg-destructive/10"
                onClick={remove}
                title="断开与此表格的连接"
              >
                <Trash2 className="size-3 sm:mr-1" />
                <span className="hidden sm:inline">断开</span>
              </Button>
            </div>
          </div>

          {/* Sync Decks Inventory */}
          {visibleInventory ? (
            <div className="mt-3 border-t border-border/50 pt-2.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-medium text-foreground">
                  已同步 {visibleInventory.decks.length} 个卡包
                </span>
                <span className="text-[11px] opacity-70">
                  共 {visibleInventory.sheetCount} 张工作表
                </span>
              </div>
              {visibleInventory.decks.length > 0 ? (
                <div className="mt-2 divide-y divide-border/40 rounded-xl border border-border/50 bg-muted/20">
                  {visibleInventory.decks.map((deck) => {
                    const previewSheets = deck.sheets.filter((s) => s.kind === "preview")
                    return (
                      <div key={deck.deckId} className="flex items-center justify-between gap-2 p-2.5 text-xs">
                        <span className="font-medium text-foreground truncate">{deck.name}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {previewSheets.map((sheet) => (
                            <span
                              key={sheet.sheetId}
                              className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300"
                            >
                              <FileSpreadsheet className="size-2.5" />
                              工作表: {sheet.title}
                            </span>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="mt-2 rounded-xl border border-dashed border-border/70 p-3 text-center text-xs text-muted-foreground">
                  暂未同步卡包，点击下方“立即同步”即可将当前卡包写入此表格。
                </p>
              )}
            </div>
          ) : null}

          {inventoryError ? (
            <p className="mt-2 text-xs leading-5 text-amber-700 dark:text-amber-300">{inventoryError}</p>
          ) : null}
        </div>
      ) : (
        <div className="rounded-2xl border border-border/70 bg-card p-3.5 shadow-xs sm:p-5">
          {/* Header */}
          <div className="flex items-start gap-3 min-w-0">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 sm:size-10 sm:rounded-2xl">
              <FileSpreadsheet className="size-4.5 sm:size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-foreground">绑定 Google 表格</p>
                <Badge variant="secondary" className="border-border/60 text-[10px] font-normal text-muted-foreground">
                  未绑定
                </Badge>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                卡包数据与进度将安全保存在您的专属 Google 表格中，支持多端实时双向同步。
              </p>
            </div>
          </div>

          {/* Segmented Control */}
          <div className="mt-3.5 grid grid-cols-3 gap-1 rounded-xl bg-muted/50 p-1 text-xs">
            <button
              type="button"
              className={`flex items-center justify-center gap-1 rounded-lg py-1.5 font-medium whitespace-nowrap transition-all ${
                activeTab === "create" ? "bg-card text-foreground shadow-2xs font-semibold" : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setActiveTab("create")}
            >
              <FolderPlus className="size-3.5 shrink-0" />
              <span>新建表格</span>
            </button>
            <button
              type="button"
              className={`flex items-center justify-center gap-1 rounded-lg py-1.5 font-medium whitespace-nowrap transition-all ${
                activeTab === "picker" ? "bg-card text-foreground shadow-2xs font-semibold" : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setActiveTab("picker")}
            >
              <HardDrive className="size-3.5 shrink-0" />
              <span>云端挑选</span>
            </button>
            <button
              type="button"
              className={`flex items-center justify-center gap-1 rounded-lg py-1.5 font-medium whitespace-nowrap transition-all ${
                activeTab === "link" ? "bg-card text-foreground shadow-2xs font-semibold" : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setActiveTab("link")}
            >
              <Link2 className="size-3.5 shrink-0" />
              <span>粘贴链接</span>
            </button>
          </div>

          {/* Tab Content - Flattened layout without nested card borders */}
          <div className="mt-3.5">
            {activeTab === "create" ? (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="new-sheet-title" className="text-xs font-medium text-muted-foreground">
                    表格名称
                  </Label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      id="new-sheet-title"
                      value={newSheetTitle}
                      onChange={(event) => setNewSheetTitle(event.target.value)}
                      placeholder="Anki Studio · 闪卡同步"
                      disabled={!enabled || busy !== null}
                      className="h-9 rounded-xl text-xs sm:text-sm"
                    />
                    <Button
                      type="button"
                      disabled={!enabled || busy !== null || !newSheetTitle.trim()}
                      onClick={() => void createNewSheet()}
                      className="h-9 shrink-0 rounded-xl px-4 text-xs font-semibold shadow-xs"
                    >
                      {busy === "create" ? <LoaderCircle className="mr-1.5 size-3.5 animate-spin" /> : <Plus className="mr-1.5 size-3.5" />}
                      在 Drive 中创建
                    </Button>
                  </div>
                </div>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  系统将在您的 Google Drive 根目录自动创建此表格并初始化数据与预览结构。
                </p>
              </div>
            ) : null}

            {activeTab === "picker" ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">挑选或搜索云端已有表格</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 rounded-lg px-2 text-[11px] text-muted-foreground hover:text-foreground"
                    disabled={!enabled || driveLoading}
                    onClick={() => void loadDriveSpreadsheets(driveSearch)}
                  >
                    <RefreshCw className={driveLoading ? "mr-1 size-3 animate-spin" : "mr-1 size-3"} />
                    刷新
                  </Button>
                </div>

                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="搜索云端硬盘中的表格名称…"
                    className="h-8.5 rounded-xl pl-8.5 text-xs"
                    value={driveSearch}
                    onChange={(e) => {
                      setDriveSearch(e.target.value)
                      void loadDriveSpreadsheets(e.target.value)
                    }}
                    disabled={!enabled || driveLoading}
                  />
                </div>

                {driveLoading ? (
                  <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
                    <LoaderCircle className="size-3.5 animate-spin text-primary" />
                    正在读取云端硬盘表格…
                  </div>
                ) : driveFiles.length > 0 ? (
                  <div className="max-h-52 overflow-y-auto divide-y divide-border/40 rounded-xl border border-border/50 bg-muted/20">
                    {driveFiles.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center justify-between gap-2.5 p-2.5 transition-colors hover:bg-muted/40"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <FileSpreadsheet className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                            <p className="truncate text-xs font-medium text-foreground">{file.name}</p>
                          </div>
                          {file.modifiedTime ? (
                            <p className="mt-0.5 pl-5 text-[10px] text-muted-foreground">
                              修改于 {new Date(file.modifiedTime).toLocaleDateString()}
                            </p>
                          ) : null}
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          className="h-7.5 shrink-0 rounded-lg px-2.5 text-xs font-medium"
                          disabled={busy !== null}
                          onClick={() => void connect(file.id)}
                        >
                          {busy === "connect" ? <LoaderCircle className="mr-1 size-3 animate-spin" /> : <Check className="mr-1 size-3" />}
                          绑定
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border/70 p-4 text-center">
                    <p className="text-xs text-muted-foreground">
                      {driveLoaded ? "未找到匹配的表格" : "暂未加载表格列表"}
                    </p>
                    <div className="mt-2.5 flex flex-wrap justify-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7.5 rounded-lg px-2.5 text-xs"
                        onClick={() => setActiveTab("create")}
                      >
                        <FolderPlus className="mr-1 size-3" />
                        新建表格
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7.5 rounded-lg px-2.5 text-xs"
                        disabled={!enabled || busy !== null}
                        onClick={() => void openPicker()}
                      >
                        <HardDrive className="mr-1 size-3" />
                        Google Picker
                      </Button>
                    </div>
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
                <div className="space-y-1.5">
                  <Label htmlFor="google-sheet-link" className="text-xs font-medium text-muted-foreground">
                    表格链接或 Spreadsheet ID
                  </Label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <div className="relative min-w-0 flex-1">
                      <Link2 className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="google-sheet-link"
                        className="h-9 rounded-xl pl-8.5 text-xs sm:text-sm"
                        type="text"
                        inputMode="url"
                        autoComplete="off"
                        placeholder="https://docs.google.com/spreadsheets/d/…/edit"
                        value={link}
                        onChange={(event) => setLink(event.target.value)}
                      />
                    </div>
                    <Button
                      type="submit"
                      variant="outline"
                      className="h-9 shrink-0 rounded-xl px-4 text-xs font-medium"
                      disabled={busy !== null || !link.trim()}
                    >
                      {busy === "connect" ? <LoaderCircle className="mr-1.5 size-3.5 animate-spin" /> : <Check className="mr-1.5 size-3.5" />}
                      绑定此表
                    </Button>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  支持粘贴来自 Google Sheets 的浏览器分享或编辑链接。
                </p>
              </form>
            ) : null}
          </div>
        </div>
      )}

      {message ? (
        <div className="rounded-xl bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground" role="status" aria-live="polite">
          {message}
        </div>
      ) : null}
    </div>
  )
}
