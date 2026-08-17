"use client"

import { useEffect, useRef, useState } from "react"

import { hasAnkiPush, markNotesPushed, planAnkiPush, withAnkiIdentity, type AnkiPushPlan } from "@/lib/anki-sync"
import { exportApkg, importDeckFile } from "@/lib/apkg"
import { deckToCsv } from "@/lib/csv"
import { listTtsJobs } from "@/lib/tts"
import {
  readStoredDeck,
  safeFilename,
  serializeDeck,
  STORAGE_KEY,
  ttsOf,
  type Deck,
} from "@/lib/deck"
import { expireStatus, replaceTimer } from "@/lib/transient-status"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CardEditor } from "@/components/card-editor"
import { SettingsForm } from "@/components/settings-form"
import { TemplateEditor } from "@/components/template-editor"

type StudioTab = "template" | "cards" | "settings"

const TAB_KEY = "anki-studio.studio-tab"

function readTab(): StudioTab {
  if (typeof window === "undefined") return "template"
  const query = new URLSearchParams(window.location.search).get("tab")
  if (query === "template" || query === "cards" || query === "settings") return query
  const stored = window.localStorage.getItem(TAB_KEY)
  if (stored === "template" || stored === "cards" || stored === "settings") return stored
  return "template"
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

function pushButtonLabel(plan: AnkiPushPlan): string {
  if (plan.cards.length > 0) return `推送到 Anki（${plan.cards.length}）`
  if (plan.templateChanged) return "推送到 Anki（模板）"
  return "推送到 Anki"
}

async function shareOrDownload(blob: Blob, filename: string): Promise<"shared" | "downloaded"> {
  const file = new File([blob], filename, { type: "application/apkg" })
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: filename })
      return "shared"
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error
  }
  downloadBlob(blob, filename)
  return "downloaded"
}

export function Studio() {
  const [deck, setDeck] = useState<Deck>(readStoredDeck)
  const [tab, setTab] = useState<StudioTab>(readTab)
  const [selectedId, setSelectedId] = useState<string>("")
  const [previewSide, setPreviewSide] = useState<"front" | "back">("front")
  const [status, setStatus] = useState<string>("")
  const [busy, setBusy] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState<{ done: number; total: number } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const exportAbort = useRef<AbortController | null>(null)
  const statusTimer = useRef(0)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, serializeDeck(deck))
  }, [deck])

  useEffect(() => {
    localStorage.setItem(TAB_KEY, tab)
    const url = new URL(window.location.href)
    if (!url.searchParams.has("tab")) return
    url.searchParams.delete("tab")
    const next = `${url.pathname}${url.search}${url.hash}`
    window.history.replaceState(null, "", next)
  }, [tab])

  const previewCard = deck.cards.find((card) => card.id === selectedId) ?? deck.cards[0]

  useEffect(() => () => window.clearTimeout(statusTimer.current), [])

  const showStatus = (message: string) => {
    setStatus(message)
    statusTimer.current = replaceTimer(
      statusTimer.current,
      window.setTimeout.bind(window),
      window.clearTimeout.bind(window),
      3200,
      () => setStatus((current) => expireStatus(current, message))
    )
  }

  const replaceDeck = (next: Deck) => {
    setDeck(next)
    setSelectedId(next.cards[0]?.id ?? "")
    setPreviewSide("front")
  }

  const onImport = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    try {
      const imported = await importDeckFile(file, deck)
      replaceDeck(imported.deck)
      showStatus(
        imported.warnings.length > 0
          ? `已导入 ${file.name}。${imported.warnings.join("；")}`
          : `已导入 ${file.name}`
      )
    } catch (error) {
      showStatus(error instanceof Error ? error.message : "导入失败")
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  const onExportJson = () => {
    const blob = new Blob([serializeDeck(deck)], { type: "application/json" })
    downloadBlob(blob, safeFilename(deck.name, "json"))
    showStatus("已导出 JSON")
  }

  const onExportCsv = () => {
    const blob = new Blob([deckToCsv(deck)], { type: "text/csv;charset=utf-8" })
    downloadBlob(blob, safeFilename(deck.name, "csv"))
    showStatus("已导出 CSV")
  }

  const cancelExport = () => {
    exportAbort.current?.abort()
  }

  const persistIdentity = (identified: Deck) => {
    setDeck((current) => {
      if (current.anki?.modelId && current.anki.deckId) return current
      return { ...current, anki: identified.anki }
    })
  }

  const onExportApkg = () => {
    if (exportAbort.current) {
      showStatus("正在导出，请稍候或取消后重试")
      return
    }

    const snapshot = withAnkiIdentity(JSON.parse(serializeDeck(deck)) as Deck)
    persistIdentity(snapshot)
    const controller = new AbortController()
    exportAbort.current = controller
    setExporting(true)
    setExportProgress(null)

    void (async () => {
      try {
        const jobs = await listTtsJobs(snapshot)
        if (jobs.length > 0) {
          const minutes = Math.max(1, Math.ceil((jobs.length * 1.5) / 60))
          showStatus(`将生成 ${jobs.length} 条语音，大约 ${minutes} 分钟，可继续编辑，不要关闭标签页`)
        }
        const blob = await exportApkg(snapshot, {
          signal: controller.signal,
          onProgress: (done, total) => setExportProgress({ done, total }),
        })
        if (controller.signal.aborted) return
        downloadBlob(blob, safeFilename(snapshot.name, "apkg"))
        showStatus("已导出 APKG")
      } catch (error) {
        if (controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) {
          showStatus("已取消导出")
        } else {
          showStatus(error instanceof Error ? error.message : "导出失败")
        }
      } finally {
        if (exportAbort.current === controller) exportAbort.current = null
        setExporting(false)
        setExportProgress(null)
      }
    })()
  }

  const onPushAnki = () => {
    if (exportAbort.current) {
      showStatus("正在导出，请稍候或取消后重试")
      return
    }

    const snapshot = withAnkiIdentity(JSON.parse(serializeDeck(deck)) as Deck)
    const plan = planAnkiPush(snapshot)
    if (!hasAnkiPush(plan)) {
      showStatus("没有需要推送的变更")
      return
    }

    persistIdentity(snapshot)
    const controller = new AbortController()
    exportAbort.current = controller
    setExporting(true)
    setExportProgress(null)

    void (async () => {
      try {
        const jobs = await listTtsJobs(snapshot, plan.cards)
        if (jobs.length > 0) {
          const minutes = Math.max(1, Math.ceil((jobs.length * 1.5) / 60))
          showStatus(`将生成 ${jobs.length} 条语音，大约 ${minutes} 分钟，可继续编辑，不要关闭标签页`)
        } else if (plan.cards.length > 0) {
          showStatus(`将推送 ${plan.cards.length} 张卡片到 Anki`)
        } else {
          showStatus("将更新 Anki 模板")
        }
        const blob = await exportApkg(snapshot, {
          cards: plan.cards,
          signal: controller.signal,
          onProgress: (done, total) => setExportProgress({ done, total }),
        })
        if (controller.signal.aborted) return
        const filename = safeFilename(`${snapshot.name}-增量`, "apkg")
        const result = await shareOrDownload(blob, filename)
        setDeck((current) =>
          markNotesPushed(current, {
            noteHashes: plan.noteHashes,
            templateHash: plan.templateHash,
            anki: snapshot.anki!,
          })
        )
        showStatus(
          result === "shared"
            ? "已分享增量卡包，用 Anki 打开即可更新"
            : "已下载增量卡包，发给 Anki 导入即可"
        )
      } catch (error) {
        if (controller.signal.aborted || (error instanceof Error && error.name === "AbortError")) {
          showStatus("已取消推送")
        } else {
          showStatus(error instanceof Error ? error.message : "推送失败")
        }
      } finally {
        if (exportAbort.current === controller) exportAbort.current = null
        setExporting(false)
        setExportProgress(null)
      }
    })()
  }

  const pushPlan = planAnkiPush(deck)

  return (
    <div className="flex min-h-[100dvh] min-w-0 flex-col overflow-x-clip bg-[#f4f1ea] text-foreground">
      <header className="border-b border-black/6 px-4 py-4 md:px-6">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <p className="shrink-0 text-sm tracking-[0.18em] text-foreground/55 uppercase">
              Anki Studio
            </p>
            <Input
              value={deck.name}
              aria-label="卡包名称"
              className="h-9 max-w-xs border-black/8 bg-white/70"
              onChange={(event) => setDeck({ ...deck, name: event.target.value })}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".json,.csv,.apkg,.colpkg"
              className="hidden"
              onChange={(event) => void onImport(event.target.files?.[0])}
            />
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
            >
              导入
            </Button>
            <Button type="button" variant="outline" disabled={busy} onClick={onExportJson}>
              导出 JSON
            </Button>
            <Button type="button" variant="outline" disabled={busy} onClick={onExportCsv}>
              导出 CSV
            </Button>
            {exporting ? (
              <Button type="button" variant="outline" onClick={cancelExport}>
                {exportProgress && exportProgress.total > 0
                  ? `语音 ${exportProgress.done}/${exportProgress.total} · 取消`
                  : "取消导出"}
              </Button>
            ) : (
              <>
                <Button type="button" variant="outline" disabled={busy} onClick={onExportApkg}>
                  {Object.keys(ttsOf(deck)).length > 0 ? "导出 APKG（含语音）" : "导出 APKG"}
                </Button>
                <Button type="button" disabled={busy} onClick={onPushAnki}>
                  {pushButtonLabel(pushPlan)}
                </Button>
              </>
            )}
          </div>
        </div>
        {status ? (
          <p className="mx-auto mt-2 w-full max-w-7xl text-sm text-foreground/60">{status}</p>
        ) : null}
      </header>

      <main className="mx-auto flex w-full min-w-0 max-w-7xl flex-1 flex-col px-4 py-5 md:px-6">
        <Tabs value={tab} onValueChange={(value) => setTab(value as StudioTab)} className="flex min-h-0 min-w-0 flex-1 gap-4">
          <TabsList>
            <TabsTrigger value="template">模板</TabsTrigger>
            <TabsTrigger value="cards">卡片</TabsTrigger>
            <TabsTrigger value="settings">设置</TabsTrigger>
          </TabsList>
          <TabsContent value="template" className="flex min-h-0 min-w-0 flex-col">
            <TemplateEditor
              deck={deck}
              previewCard={previewCard}
              previewSide={previewSide}
              onChange={setDeck}
              onPreviewSideChange={setPreviewSide}
            />
          </TabsContent>
          <TabsContent value="cards" className="flex min-h-0 min-w-0 flex-col">
            <CardEditor
              deck={deck}
              selectedId={selectedId}
              previewSide={previewSide}
              onChange={setDeck}
              onSelect={setSelectedId}
              onPreviewSideChange={setPreviewSide}
            />
          </TabsContent>
          <TabsContent value="settings" className="flex min-h-0 min-w-0 flex-col pb-8">
            <SettingsForm />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
