"use client"

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react"

import { formatCardContext, requestTemplateAi, type TemplateAiTarget } from "@/lib/ai"
import {
  notesOf,
  setFieldNote,
  textFields,
  tryAddField,
  tryAddTtsField,
  tryRemoveField,
  tryRenameField,
  tryUpdateTtsField,
  ttsOf,
  TTS_LANGS,
  type Card,
  type Deck,
  type TtsLang,
} from "@/lib/deck"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CardPreview } from "@/components/card-preview"
import { CodeEditor, type CodeEditorHandle } from "@/components/code-editor"
import { takeCommittedDraft } from "@/lib/committed-draft"

type Pane = "front" | "back" | "css"

function useCommittedDraft(value: string): [string, Dispatch<SetStateAction<string>>] {
  const [draft, setDraft] = useState(value)
  const [prev, setPrev] = useState(value)
  const synced = takeCommittedDraft(value, prev, draft)
  if (synced.previous !== prev || synced.value !== draft) {
    setPrev(synced.previous)
    setDraft(synced.value)
  }
  return [draft, setDraft]
}

function FieldChip({
  name,
  note,
  canRemove,
  onRename,
  onNoteChange,
  onRemove,
  onInsert,
  onWrap,
}: {
  name: string
  note: string
  canRemove: boolean
  onRename: (next: string) => boolean
  onNoteChange: (note: string) => void
  onRemove: () => void
  onInsert: () => void
  onWrap: () => void
}) {
  const [draft, setDraft] = useCommittedDraft(name)

  return (
    <div className="flex w-full min-w-0 flex-col gap-1 rounded-xl bg-white/80 py-1.5 pr-1 pl-2 ring-1 ring-black/6">
      <div className="flex min-w-0 items-center gap-1">
        <Input
          value={draft}
          aria-label={`字段 ${name}`}
          className="h-7 min-w-0 flex-1 rounded-md border-0 bg-transparent px-1.5 text-sm shadow-none focus-visible:ring-0"
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => {
            const next = draft.trim()
            if (next && next !== name) {
              if (!onRename(next)) setDraft(name)
              return
            }
            setDraft(name)
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur()
          }}
        />
        <Button type="button" size="sm" variant="ghost" className="h-7 shrink-0 px-2 text-xs" onClick={onInsert}>
          插入
        </Button>
        <Button type="button" size="sm" variant="ghost" className="h-7 shrink-0 px-2 text-xs" onClick={onWrap}>
          条件
        </Button>
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          className="shrink-0"
          disabled={!canRemove}
          aria-label={`删除字段 ${name}`}
          onClick={onRemove}
        >
          ×
        </Button>
      </div>
      <Input
        value={note}
        aria-label={`${name} 备注`}
        placeholder="备注，会提供给 AI"
        className="h-7 border-0 bg-transparent px-1.5 text-xs text-foreground/70 shadow-none placeholder:text-foreground/35 focus-visible:ring-0"
        onChange={(event) => onNoteChange(event.target.value)}
      />
    </div>
  )
}

function TtsFieldChip({
  name,
  source,
  lang,
  slow,
  sources,
  canRemove,
  onRename,
  onPatch,
  onRemove,
  onInsert,
  onWrap,
}: {
  name: string
  source: string
  lang: TtsLang
  slow: boolean
  sources: string[]
  canRemove: boolean
  onRename: (next: string) => boolean
  onPatch: (patch: { source?: string; lang?: TtsLang; slow?: boolean }) => void
  onRemove: () => void
  onInsert: () => void
  onWrap: () => void
}) {
  const [draft, setDraft] = useCommittedDraft(name)

  return (
    <div className="flex w-full min-w-0 flex-col gap-1 rounded-xl bg-white/80 py-1.5 pr-1 pl-2 ring-1 ring-black/6">
      <div className="flex min-w-0 items-center gap-1">
        <Input
          value={draft}
          aria-label={`TTS 字段 ${name}`}
          className="h-7 min-w-0 flex-1 rounded-md border-0 bg-transparent px-1.5 text-sm shadow-none focus-visible:ring-0"
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => {
            const next = draft.trim()
            if (next && next !== name) {
              if (!onRename(next)) setDraft(name)
              return
            }
            setDraft(name)
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur()
          }}
        />
        <span className="shrink-0 rounded-md bg-black/5 px-1.5 py-0.5 text-[10px] tracking-wide text-foreground/55">
          TTS
        </span>
        <Button type="button" size="sm" variant="ghost" className="h-7 shrink-0 px-2 text-xs" onClick={onInsert}>
          插入
        </Button>
        <Button type="button" size="sm" variant="ghost" className="h-7 shrink-0 px-2 text-xs" onClick={onWrap}>
          条件
        </Button>
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          className="shrink-0"
          disabled={!canRemove}
          aria-label={`删除字段 ${name}`}
          onClick={onRemove}
        >
          ×
        </Button>
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-1 px-1.5 pb-0.5">
        <select
          aria-label={`${name} 朗读字段`}
          value={source}
          className="h-7 min-w-0 flex-1 rounded-md border-0 bg-transparent text-xs text-foreground/70 outline-none"
          onChange={(event) => onPatch({ source: event.target.value })}
        >
          {sources.map((item) => (
            <option key={item} value={item}>
              朗读 {item}
            </option>
          ))}
        </select>
        <select
          aria-label={`${name} 语言`}
          value={lang}
          className="h-7 w-20 rounded-md border-0 bg-transparent text-xs text-foreground/70 outline-none"
          onChange={(event) => onPatch({ lang: event.target.value as TtsLang })}
        >
          {TTS_LANGS.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
        <Button
          type="button"
          size="xs"
          variant={slow ? "secondary" : "ghost"}
          className="shrink-0"
          onClick={() => onPatch({ slow: !slow })}
        >
          慢速
        </Button>
      </div>
    </div>
  )
}

type TemplateEditorProps = {
  deck: Deck
  previewCard: Card | undefined
  previewSide: "front" | "back"
  onChange: (deck: Deck) => void
  onPreviewSideChange: (side: "front" | "back") => void
}

export function TemplateEditor({
  deck,
  previewCard,
  previewSide,
  onChange,
  onPreviewSideChange,
}: TemplateEditorProps) {
  const [pane, setPane] = useState<Pane>("front")
  const [alert, setAlert] = useState("")
  const [ttsOpen, setTtsOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiInstruction, setAiInstruction] = useState("")
  const [aiTarget, setAiTarget] = useState<TemplateAiTarget>("all")
  const sources = textFields(deck)
  const [ttsName, setTtsName] = useState("")
  const [ttsSource, setTtsSource] = useState(sources[0] ?? "")
  const [ttsLang, setTtsLang] = useState<TtsLang>("en")
  const [ttsSlow, setTtsSlow] = useState(false)
  const editorRef = useRef<CodeEditorHandle>(null)
  const fieldTts = ttsOf(deck)

  const switchPane = (next: Pane) => {
    setPane(next)
    if (next === "front" || next === "back") onPreviewSideChange(next)
  }

  const didMount = useRef(false)
  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true
      return
    }
    editorRef.current?.focus()
  }, [pane])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return
      if (event.key === "1") {
        event.preventDefault()
        setPane("front")
        onPreviewSideChange("front")
      } else if (event.key === "2") {
        event.preventDefault()
        setPane("back")
        onPreviewSideChange("back")
      } else if (event.key === "3") {
        event.preventDefault()
        setPane("css")
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onPreviewSideChange])

  const value = deck[pane]
  const language = pane === "css" ? "css" : "template"

  const updatePane = (next: string) => {
    onChange({ ...deck, [pane]: next })
  }

  const insertSnippet = (snippet: string) => {
    editorRef.current?.insert(snippet)
  }

  const applyFieldChange = (result: ReturnType<typeof tryAddField>) => {
    if (result.ok) {
      onChange(result.deck)
      return true
    }
    setAlert(result.error)
    return false
  }

  const openTtsDialog = () => {
    const source = textFields(deck)[0] ?? ""
    setTtsSource(source)
    setTtsLang("en")
    setTtsSlow(false)
    setTtsName(source ? `${source}_en` : "")
    setTtsOpen(true)
  }

  const addTtsField = () => {
    const result = tryAddTtsField(deck, {
      name: ttsName,
      source: ttsSource,
      lang: ttsLang,
      slow: ttsSlow,
    })
    if (!applyFieldChange(result)) return
    setTtsOpen(false)
  }

  const applyTemplateAi = () => {
    const instruction = aiInstruction.trim()
    if (!instruction) {
      setAlert("请填写修改说明")
      return
    }
    if (aiBusy) return
    setAiBusy(true)
    void (async () => {
      try {
        const next = await requestTemplateAi({
          instruction,
          target: aiTarget,
          pane,
          fields: deck.fields,
          notes: notesOf(deck),
          fieldTts,
          front: deck.front,
          back: deck.back,
          css: deck.css,
          sample: previewCard
            ? formatCardContext(textFields(deck), previewCard.values, notesOf(deck))
            : "",
        })
        onChange({ ...deck, ...next })
        setAiOpen(false)
        setAiInstruction("")
        if (aiTarget === "all" || (aiTarget === "html" && pane === "css")) {
          setPane("front")
          onPreviewSideChange("front")
        } else if (aiTarget === "current" && (pane === "front" || pane === "back")) {
          onPreviewSideChange(pane)
        }
      } catch (error) {
        setAlert(error instanceof Error ? error.message : "模板生成失败")
      } finally {
        setAiBusy(false)
      }
    })()
  }

  return (
    <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
      <div className="flex min-w-0 flex-col gap-4">
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <Label>字段</Label>
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" variant="outline" disabled={sources.length === 0} onClick={openTtsDialog}>
                添加 TTS 字段
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => applyFieldChange(tryAddField(deck))}>
                添加字段
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {deck.fields.map((field) => {
              const tts = fieldTts[field]
              if (tts) {
                return (
                  <TtsFieldChip
                    key={field}
                    name={field}
                    source={tts.source}
                    lang={tts.lang}
                    slow={tts.slow}
                    sources={sources}
                    canRemove
                    onRename={(next) => applyFieldChange(tryRenameField(deck, field, next))}
                    onPatch={(patch) => applyFieldChange(tryUpdateTtsField(deck, field, patch))}
                    onRemove={() => applyFieldChange(tryRemoveField(deck, field))}
                    onInsert={() => insertSnippet(`{{${field}}}`)}
                    onWrap={() => editorRef.current?.wrap(`{{#${field}}}`, `{{/${field}}}`)}
                  />
                )
              }
              return (
                <FieldChip
                  key={field}
                  name={field}
                  note={notesOf(deck)[field] ?? ""}
                  canRemove={textFields(deck).length > 1}
                  onRename={(next) => applyFieldChange(tryRenameField(deck, field, next))}
                  onNoteChange={(note) => onChange(setFieldNote(deck, field, note))}
                  onRemove={() => applyFieldChange(tryRemoveField(deck, field))}
                  onInsert={() => insertSnippet(`{{${field}}}`)}
                  onWrap={() => editorRef.current?.wrap(`{{#${field}}}`, `{{/${field}}}`)}
                />
              )
            })}
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Tabs value={pane} onValueChange={(value) => switchPane(value as Pane)}>
              <TabsList>
                <TabsTrigger value="front">正面</TabsTrigger>
                <TabsTrigger value="back">背面</TabsTrigger>
                <TabsTrigger value="css">样式</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex items-center gap-1">
              {pane === "back" ? (
                <Button type="button" size="sm" variant="outline" onClick={() => insertSnippet("{{FrontSide}}")}>
                  FrontSide
                </Button>
              ) : null}
              <Button type="button" size="sm" variant="outline" onClick={() => setAiOpen(true)}>
                AI 编辑
              </Button>
            </div>
          </div>
          <CodeEditor
            key={pane}
            ref={editorRef}
            id={`template-${pane}`}
            label={pane === "front" ? "正面模板" : pane === "back" ? "背面模板" : "样式 CSS"}
            value={value}
            language={language}
            onChange={updatePane}
          />
          <p className="text-xs leading-5 break-words text-foreground/50">
            {`{{字段}} 替换成卡片内容。{{#字段}}…{{/字段}} 仅在该字段有值时显示。Ctrl+1 / 2 / 3 切换正面、背面、样式。`}
          </p>
        </section>
      </div>

      <CardPreview
        deck={deck}
        values={previewCard?.values ?? {}}
        side={previewSide}
        onSideChange={onPreviewSideChange}
      />

      <Dialog open={ttsOpen} onOpenChange={setTtsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加 TTS 字段</DialogTitle>
            <DialogDescription>
              根据已有字段在导出 APKG 时生成 Google 语音。编辑器里可以试听，不会写入卡片内容。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="tts-name">字段名</Label>
              <Input
                id="tts-name"
                value={ttsName}
                onChange={(event) => setTtsName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tts-source">朗读字段</Label>
              <select
                id="tts-source"
                value={ttsSource}
                className="h-9 w-full rounded-lg border border-black/8 bg-white px-2.5 text-sm"
                onChange={(event) => {
                  const next = event.target.value
                  setTtsSource(next)
                  if (!ttsName.trim() || ttsName === `${ttsSource}_${ttsLang}`) {
                    setTtsName(`${next}_${ttsLang}`)
                  }
                }}
              >
                {sources.map((field) => (
                  <option key={field} value={field}>
                    {field}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>语言</Label>
              <div className="flex gap-1">
                {TTS_LANGS.map((item) => (
                  <Button
                    key={item.id}
                    type="button"
                    size="sm"
                    variant={ttsLang === item.id ? "default" : "outline"}
                    onClick={() => {
                      if (!ttsName.trim() || ttsName === `${ttsSource}_${ttsLang}`) {
                        setTtsName(`${ttsSource}_${item.id}`)
                      }
                      setTtsLang(item.id)
                    }}
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={ttsSlow}
                onChange={(event) => setTtsSlow(event.target.checked)}
              />
              慢速朗读
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setTtsOpen(false)}>
              取消
            </Button>
            <Button type="button" disabled={!ttsSource} onClick={addTtsField}>
              添加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={aiOpen}
        onOpenChange={(open) => {
          if (aiBusy) return
          setAiOpen(open)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>AI 编辑模板</DialogTitle>
            <DialogDescription>
              用一句话说明想怎么改。例如：正面只保留 Word 和 Phonetic，背面加上 Example。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="template-ai-instruction">修改说明</Label>
              <Textarea
                id="template-ai-instruction"
                value={aiInstruction}
                placeholder="例如：背面不要重复正面，Translation 用更大的字，TTS 字段放在 Word 下面"
                className="min-h-28"
                disabled={aiBusy}
                onChange={(event) => setAiInstruction(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>修改范围</Label>
              <div className="flex flex-wrap gap-1">
                {(
                  [
                    ["current", "仅当前面板"],
                    ["html", "正面和背面"],
                    ["all", "全部含样式"],
                  ] as const
                ).map(([id, label]) => (
                  <Button
                    key={id}
                    type="button"
                    size="sm"
                    variant={aiTarget === id ? "default" : "outline"}
                    disabled={aiBusy}
                    onClick={() => setAiTarget(id)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={aiBusy} onClick={() => setAiOpen(false)}>
              取消
            </Button>
            <Button type="button" disabled={aiBusy || !aiInstruction.trim()} onClick={applyTemplateAi}>
              {aiBusy ? "生成中" : "生成"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(alert)} onOpenChange={(open) => { if (!open) setAlert("") }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>无法完成操作</AlertDialogTitle>
            <AlertDialogDescription>{alert}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>知道了</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
