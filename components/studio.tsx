"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { hasAnkiPush, markNotesPushed, planAnkiPush, withAnkiIdentity, type AnkiPushPlan } from "@/lib/anki-sync"
import { exportApkg, importDeckFile } from "@/lib/apkg"
import { PATHS, noteIdFromPath, notePath } from "@/lib/app-paths"
import { deckToCsv } from "@/lib/csv"
import {
  addLibraryDeck,
  createLibraryDeck,
  deleteLibraryDeck,
  duplicateLibraryDeck,
  loadLibrarySession,
  persistActiveDeck,
  readLibrary,
  switchLibraryDeck,
  type Library,
} from "@/lib/library"
import {
  applyTextImport,
  defaultImportMode,
  inspectImportFile,
  isTextImportName,
  type ImportMode,
  type ImportPreview,
} from "@/lib/import-preview"
import { listTtsJobs } from "@/lib/tts"
import {
  createCard,
  createDefaultDeck,
  safeFilename,
  serializeDeck,
  ttsOf,
  type Deck,
} from "@/lib/deck"
import { shouldDiscardNoteOnLeave, withoutDiscardedNote } from "@/lib/empty-note"
import { readEditorState } from "@/lib/editor-state"
import { expireStatus, replaceTimer } from "@/lib/transient-status"
import { dirtyCount, runSyncCycle } from "@/lib/sync-client"
import { getStudyQueue } from "@/lib/fsrs"
import { createHttpTransport } from "@/lib/sync-transport"
import { createIdbStore } from "@/lib/studio-store-idb"
import { createMemoryStore, getStudioStore, setStudioStore } from "@/lib/studio-store"
import type { ConflictChoice, SyncConflict } from "@/lib/sync-types"
import { AppShell } from "@/components/app-shell"
import { CardEditor } from "@/components/card-editor"
import { DeckLibraryDialog } from "@/components/deck-library-dialog"
import { DeckSwitcher } from "@/components/deck-switcher"
import { DeckToolsPanel } from "@/components/deck-tools-panel"
import { ImportPreviewDialog } from "@/components/import-preview-dialog"
import { SettingsForm } from "@/components/settings-form"
import { SettingsOverview } from "@/components/settings-overview"
import { SyncConflictDialog } from "@/components/sync-conflict-dialog"
import { StudyOverview } from "@/components/study-overview"
import { StudySession } from "@/components/study-session"
import { TemplateEditor } from "@/components/template-editor"

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
  const pathname = usePathname() ?? PATHS.home
  const router = useRouter()
  const searchParams = useSearchParams()
  const [ready, setReady] = useState(false)
  const [library, setLibrary] = useState<Library>({
    version: 1,
    activeId: "pending",
    decks: [],
  })
  const [deck, setDeck] = useState<Deck>(createDefaultDeck)
  const [studyImmersive, setStudyImmersive] = useState(false)
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const [selectedId, setSelectedId] = useState("")
  const [previewSide, setPreviewSide] = useState<"front" | "back">("front")
  const editorNoteId = noteIdFromPath(pathname)
  const createdInSession = searchParams.get("new") === "1"
  const [status, setStatus] = useState<string>("")
  const [busy, setBusy] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState<{ done: number; total: number } | null>(null)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null)
  const [importMode, setImportMode] = useState<ImportMode>("merge")
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState("尚未同步")
  const [lastSyncAt, setLastSyncAt] = useState<number | undefined>()
  const [dirty, setDirty] = useState(0)
  const [syncUnavailable, setSyncUnavailable] = useState<string | undefined>()
  const [conflict, setConflict] = useState<SyncConflict | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const exportAbort = useRef<AbortController | null>(null)
  const statusTimer = useRef(0)
  const libraryRef = useRef(library)
  const deckRef = useRef(deck)
  const conflictWaiter = useRef<((choice: ConflictChoice) => void) | null>(null)
  const syncingRef = useRef(false)

  useEffect(() => {
    libraryRef.current = library
    deckRef.current = deck
  }, [library, deck])

  const discardRef = useRef<{ id: string; created: boolean } | null>(null)
  useEffect(() => {
    const prev = discardRef.current
    discardRef.current = editorNoteId ? { id: editorNoteId, created: createdInSession } : null
    if (!prev?.created) return
    const card = deckRef.current.cards.find((item) => item.id === prev.id)
    if (!shouldDiscardNoteOnLeave(card, deckRef.current.fields, true)) return
    setDeck((current) => ({
      ...current,
      cards: withoutDiscardedNote(current.cards, prev.id),
    }))
  }, [createdInSession, editorNoteId])

  const previewCard = deck.cards.find((card) => card.id === (editorNoteId ?? selectedId)) ?? deck.cards[0]

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

  const applySession = (next: { library: Library; deck: Deck }, message: string) => {
    setLibrary(next.library)
    setDeck(next.deck)
    setSelectedId(readEditorState(next.library.activeId, next.deck).selectedId)
    setPreviewSide("front")
    showStatus(message)
  }

  const reloadFromStore = async () => {
    const nextLibrary = await readLibrary()
    const record = await getStudioStore().getRecord(nextLibrary.activeId)
    setLibrary(nextLibrary)
    setDirty(await dirtyCount(getStudioStore()))
    if (!record || record.deletedAt) return
    setDeck(record.deck)
    setSelectedId(readEditorState(nextLibrary.activeId, record.deck).selectedId)
  }

  const runSync = async (reason: "auto" | "manual") => {
    if (syncingRef.current || conflictWaiter.current) return
    syncingRef.current = true
    setSyncing(true)
    try {
      await persistActiveDeck(libraryRef.current, deckRef.current)
      const store = getStudioStore()
      const summary = await runSyncCycle({
        store,
        transport: createHttpTransport(),
        resolveConflict: (item) =>
          new Promise((resolve) => {
            setConflict(item)
            conflictWaiter.current = resolve
          }),
      })
      await reloadFromStore()
      const meta = await store.getSyncMeta()
      setLastSyncAt(meta?.lastSyncAt)
      if (summary.unavailable) {
        setSyncUnavailable(summary.unavailable)
        setSyncMessage(summary.unavailable)
        if (reason === "manual") showStatus(summary.unavailable)
      } else if (summary.error) {
        setSyncUnavailable(undefined)
        setSyncMessage(summary.error)
        showStatus(summary.error)
      } else if (summary.deferred) {
        setSyncUnavailable(undefined)
        setSyncMessage("有冲突未处理")
      } else {
        setSyncUnavailable(undefined)
        setSyncMessage("已同步")
        if (reason === "manual") {
          showStatus(
            summary.pulled + summary.pushed === 0
              ? "已是最新"
              : `已同步，上传 ${summary.pushed}，下载 ${summary.pulled}`
          )
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "同步失败"
      setSyncMessage(message)
      showStatus(message)
    } finally {
      syncingRef.current = false
      setSyncing(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setStudioStore(typeof indexedDB === "undefined" ? createMemoryStore() : createIdbStore())
      const session = await loadLibrarySession()
      if (cancelled) return
      setLibrary(session.library)
      setDeck(session.deck)
      setSelectedId(readEditorState(session.library.activeId, session.deck).selectedId)
      setReady(true)
      void runSync("auto")
    })()
    return () => {
      cancelled = true
    }
    // Initial load only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!ready) return
    const timer = window.setTimeout(() => {
      void persistActiveDeck(library, deck).then(async () => {
        setDirty(await dirtyCount(getStudioStore()))
      }).catch((error: unknown) => {
        showStatus(error instanceof Error ? error.message : "本机保存失败")
      })
    }, 400)
    return () => window.clearTimeout(timer)
  }, [deck, library, ready])

  useEffect(() => {
    if (!ready) return
    const flush = () => {
      void persistActiveDeck(library, deck)
    }
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush()
    }
    window.addEventListener("pagehide", flush)
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      window.removeEventListener("pagehide", flush)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [library, deck, ready])

  useEffect(() => {
    if (!ready || conflict || dirty === 0) return
    const timer = window.setTimeout(() => {
      void runSync("auto")
    }, 2500)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, ready, conflict])

  useEffect(() => {
    const onOnline = () => {
      if (dirty > 0) void runSync("auto")
    }
    window.addEventListener("online", onOnline)
    return () => window.removeEventListener("online", onOnline)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty])

  const replaceDeck = (next: Deck, keepSelection = true) => {
    setDeck(next)
    setSelectedId((id) =>
      keepSelection && next.cards.some((card) => card.id === id) ? id : next.cards[0]?.id ?? ""
    )
    setPreviewSide("front")
  }

  const onImport = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    try {
      if (isTextImportName(file.name)) {
        const preview = await inspectImportFile(file, deck)
        setImportPreview(preview)
        setImportMode(defaultImportMode(preview.kind))
        return
      }
      const imported = await importDeckFile(file, deck)
      applySession(
        await addLibraryDeck(library, deck, imported.deck),
        imported.warnings.length > 0
          ? `已新建卡包「${imported.deck.name}」。${imported.warnings.join("；")}`
          : `已新建卡包「${imported.deck.name}」`
      )
    } catch (error) {
      showStatus(error instanceof Error ? error.message : "导入失败")
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  const handleImportConfirm = (result: ReturnType<typeof applyTextImport>) => {
    setImportPreview(null)
    if (result.mode === "new") {
      void addLibraryDeck(library, deck, result.deck)
        .then((session) => {
          applySession(session, `已新建卡包「${result.deck.name}」，${result.added} 张卡片`)
        })
        .catch((error: unknown) => {
          showStatus(error instanceof Error ? error.message : "导入失败")
        })
      return
    }
    replaceDeck(result.deck, result.mode !== "replace")
    showStatus(
      result.mode === "replace"
        ? `已替换当前卡包，${result.added} 张卡片`
        : `已合并 ${result.added} 张新卡片`
    )
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
  const libraryView: Library = {
    ...library,
    decks: library.decks.map((entry) =>
      entry.id === library.activeId
        ? { ...entry, name: deck.name.trim() || entry.name, cardCount: deck.cards.length }
        : entry
    ),
  }

  const studyQueueCount = getStudyQueue(deck).length
  const settingsSection =
    pathname === PATHS.settingsDeck
      ? "deck"
      : pathname === PATHS.settingsStudy
        ? "study"
        : pathname === PATHS.settingsAi
          ? "ai"
          : pathname === PATHS.settingsSync
            ? "sync"
            : null

  const addNote = () => {
    const card = createCard(deck.fields)
    setDeck((current) => ({ ...current, cards: [...current.cards, card] }))
    setSelectedId(card.id)
    router.push(`${notePath(card.id)}?new=1`)
  }

  const openNote = (id: string) => {
    setSelectedId(id)
    router.push(notePath(id))
  }

  const switchDeck = (id: string, close = false) => {
    void switchLibraryDeck(library, deck, id)
      .then((session) => {
        applySession(session, "已切换卡包")
        if (close) setLibraryOpen(false)
      })
      .catch((error: unknown) => {
        showStatus(error instanceof Error ? error.message : "切换失败")
      })
  }

  const createDeck = () => {
    void createLibraryDeck(library, deck)
      .then((session) => applySession(session, "已新建卡包"))
      .catch((error: unknown) => {
        showStatus(error instanceof Error ? error.message : "新建失败")
      })
  }

  const duplicateDeck = () => {
    void duplicateLibraryDeck(library, deck)
      .then((session) => applySession(session, "已复制当前卡包"))
      .catch((error: unknown) => {
        showStatus(error instanceof Error ? error.message : "复制失败")
      })
  }

  const removeDeck = (id: string) => {
    void deleteLibraryDeck(library, deck, id)
      .then((session) => applySession(session, "已删除卡包"))
      .catch((error: unknown) => {
        showStatus(error instanceof Error ? error.message : "删除失败")
      })
  }

  if (!ready) {
    return (
      <div className="min-h-[100dvh] bg-background p-5">
        <div className="mx-auto mt-20 h-48 max-w-5xl animate-pulse rounded-3xl bg-muted" />
      </div>
    )
  }

  const leaveStudy = () => {
    setStudyImmersive(false)
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined)
    }
    router.push(PATHS.home)
  }

  const deckTools = (
    <DeckToolsPanel
      deckName={deck.name.trim() || "未命名卡包"}
      cardCount={deck.cards.length}
      deckCount={libraryView.decks.length}
      busy={busy}
      exporting={exporting}
      exportProgress={exportProgress}
      pushLabel={pushButtonLabel(pushPlan)}
      hasTts={Object.keys(ttsOf(deck)).length > 0}
      onOpenLibrary={() => setLibraryOpen(true)}
      onImport={() => fileRef.current?.click()}
      onExportJson={onExportJson}
      onExportCsv={onExportCsv}
      onExportApkg={onExportApkg}
      onPushAnki={onPushAnki}
      onCancelExport={cancelExport}
    />
  )

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept=".json,.csv,.apkg,.colpkg"
        className="hidden"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0]
          event.currentTarget.value = ""
          void onImport(file)
        }}
      />
      <AppShell
        dueCount={studyQueueCount}
        dirtyCount={dirty}
        syncing={syncing}
        syncUnavailable={syncUnavailable}
        deckName={deck.name}
        status={status}
        onSync={() => void runSync("manual")}
        onDeckClick={() => setSwitcherOpen(true)}
      >
        {pathname === PATHS.home ? (
          <StudyOverview
            deck={deck}
            onStart={() => router.push(PATHS.studySession)}
            onAddNote={addNote}
          />
        ) : null}

        {pathname === PATHS.studySession ? (
          <StudySession
            key={library.activeId}
            deck={deck}
            onChange={setDeck}
            immersive={studyImmersive}
            onImmersiveChange={setStudyImmersive}
            onExit={leaveStudy}
          />
        ) : null}

        {pathname === PATHS.notes || editorNoteId ? (
          <div className="mx-auto w-full max-w-7xl">
            <CardEditor
              deck={deck}
              deckId={library.activeId}
              selectedId={editorNoteId ?? selectedId}
              previewSide={previewSide}
              layout={editorNoteId ? "detail" : "list"}
              onChange={setDeck}
              onSelect={setSelectedId}
              onOpenNote={openNote}
              onAddNote={addNote}
              onPreviewSideChange={setPreviewSide}
            />
          </div>
        ) : null}

        {pathname === PATHS.settingsTemplates ? (
          <div className="mx-auto w-full max-w-7xl">
            <TemplateEditor
              key={library.activeId}
              deck={deck}
              previewCard={previewCard}
              previewSide={previewSide}
              onChange={setDeck}
              onPreviewSideChange={setPreviewSide}
            />
          </div>
        ) : null}

        {pathname === PATHS.settings ? <SettingsOverview /> : null}

        {settingsSection ? (
          <div className="mx-auto w-full max-w-7xl pb-8">
            <SettingsForm
              section={settingsSection}
              deckTools={settingsSection === "deck" ? deckTools : undefined}
              deck={deck}
              onDeckChange={setDeck}
              sync={{
                syncing,
                message: syncMessage,
                lastSyncAt,
                dirtyCount: dirty,
                unavailable: syncUnavailable,
              }}
              onSyncNow={() => void runSync("manual")}
            />
          </div>
        ) : null}
      </AppShell>

      <DeckSwitcher
        open={switcherOpen}
        library={libraryView}
        activeName={deck.name.trim() || "未命名卡包"}
        onOpenChange={setSwitcherOpen}
        onSwitch={(id) => switchDeck(id)}
      />
      <DeckLibraryDialog
        open={libraryOpen}
        library={libraryView}
        activeName={deck.name}
        onOpenChange={setLibraryOpen}
        onSwitch={(id) => switchDeck(id, true)}
        onCreate={createDeck}
        onDuplicate={duplicateDeck}
        onDelete={removeDeck}
        onRename={(name) => setDeck({ ...deck, name })}
      />
      <ImportPreviewDialog
        preview={importPreview}
        current={deck}
        mode={importMode}
        busy={busy}
        onModeChange={setImportMode}
        onCancel={() => setImportPreview(null)}
        onConfirm={handleImportConfirm}
      />
      <SyncConflictDialog
        conflict={conflict}
        onChoose={(choice) => {
          setConflict(null)
          conflictWaiter.current?.(choice)
          conflictWaiter.current = null
        }}
      />
    </>
  )
}
