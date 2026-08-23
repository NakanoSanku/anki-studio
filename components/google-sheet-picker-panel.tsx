"use client"

import Script from "next/script"
import { useEffect, useMemo, useState, useSyncExternalStore } from "react"
import {
  ExternalLink,
  FileSpreadsheet,
  Link2,
  LoaderCircle,
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
import { parseGoogleSpreadsheetId } from "@/lib/google-sheet-id"

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
}: {
  enabled: boolean
  onConnectionChange?: (connected: boolean) => void
  onConnected?: () => void
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
  const [scriptReady, setScriptReady] = useState(false)
  const [busy, setBusy] = useState<"picker" | "connect" | null>(null)
  const [message, setMessage] = useState("")

  useEffect(() => {
    onConnectionChange?.(Boolean(connection))
  }, [connection, onConnectionChange])

  const connect = async (spreadsheetId: string) => {
    setBusy("connect")
    setMessage("正在检查表格并初始化同步页…")
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
          ? `${issue}。请先用“选择 Google 表格”授权这个文件。`
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
      setMessage("表格已连接，同步页已准备好")
      onConnectionChange?.(true)
      onConnected?.()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "无法连接这个 Google Sheet")
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
      setMessage("请粘贴完整的 Google Sheets 编辑链接")
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
    setMessage("已从当前设备移除表格连接，本机数据没有变化")
    onConnectionChange?.(false)
  }

  return (
    <div className="space-y-4 rounded-xl border border-border/70 p-4">
      {enabled ? (
        <Script
          id="google-picker-api"
          src="https://apis.google.com/js/api.js"
          strategy="afterInteractive"
          onReady={() => setScriptReady(true)}
          onError={() => setMessage("Google Picker 脚本加载失败")}
        />
      ) : null}

      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
          <FileSpreadsheet className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">同步表格</p>
            <Badge variant={connection ? "outline" : "secondary"}>
              {connection ? "已选择" : "未选择"}
            </Badge>
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Picker 只授权你选中的文件；同一台设备也可以直接粘贴已授权表格的链接。
          </p>
        </div>
      </div>

      {connection ? (
        <div className="flex flex-col gap-3 rounded-lg bg-muted/45 p-3 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{connection.name}</p>
            <a
              href={connection.url}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-flex max-w-full items-center gap-1 text-xs text-primary hover:underline"
            >
              <span className="truncate">{connection.url}</span>
              <ExternalLink className="size-3 shrink-0" />
            </a>
          </div>
          <Button type="button" size="sm" variant="ghost" onClick={remove}>
            <Trash2 className="size-4" />
            移除
          </Button>
        </div>
      ) : null}

      <Button
        type="button"
        className="w-full sm:w-fit"
        disabled={!enabled || busy !== null}
        onClick={() => void openPicker()}
      >
        {busy === "picker" ? <LoaderCircle className="size-4 animate-spin" /> : <FileSpreadsheet className="size-4" />}
        {connection ? "更换 Google 表格" : "选择 Google 表格"}
      </Button>

      <div className="relative py-1 text-center text-xs text-muted-foreground before:absolute before:inset-x-0 before:top-1/2 before:border-t before:border-border/70">
        <span className="relative bg-card px-2">或粘贴链接</span>
      </div>

      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault()
          connectLink()
        }}
      >
        <Label htmlFor="google-sheet-link">Google Sheets 链接</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <Link2 className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="google-sheet-link"
              className="pl-9"
              type="url"
              inputMode="url"
              autoComplete="off"
              placeholder="https://docs.google.com/spreadsheets/d/…/edit"
              value={link}
              onChange={(event) => setLink(event.target.value)}
            />
          </div>
          <Button type="submit" variant="outline" disabled={busy !== null || !link.trim()}>
            {busy === "connect" ? <LoaderCircle className="size-4 animate-spin" /> : null}
            连接链接
          </Button>
        </div>
      </form>

      {message ? (
        <p className="text-xs leading-5 text-muted-foreground" role="status" aria-live="polite">
          {message}
        </p>
      ) : null}
    </div>
  )
}
