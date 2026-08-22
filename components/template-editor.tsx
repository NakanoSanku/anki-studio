"use client"

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react"
import { Braces, Code2, Copy, MoreHorizontal, Plus, Sparkles, Trash2, Volume2 } from "lucide-react"

import { formatCardContext, requestTemplateAi, type TemplateAiTarget } from "@/lib/ai"
import {
  addCardTemplate,
  duplicateCardTemplate,
  getCardTemplate,
  notesOf,
  removeCardTemplate,
  setFieldNote,
  templatesOf,
  textFields,
  tryAddField,
  tryAddTtsField,
  tryRemoveField,
  tryRenameField,
  tryUpdateTtsField,
  ttsOf,
  updateCardTemplate,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CardPreview } from "@/components/card-preview"
import { CodeEditor, type CodeEditorHandle } from "@/components/code-editor"
import { takeCommittedDraft } from "@/lib/committed-draft"
import { cn } from "@/lib/utils"

type Pane = "front" | "back" | "css"
type MobileSection = "manage" | "fields" | "code" | "preview"

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
    <div className="flex w-full min-w-0 flex-col gap-1 border-b border-border/70 bg-card/60 px-2.5 py-2.5 last:border-b-0">
      <div className="flex min-w-0 items-center gap-1.5">
        <Input
          value={draft}
          aria-label={`字段 ${name}`}
          className="h-7 min-w-0 flex-1 rounded-md border-0 bg-transparent px-1 text-sm font-medium shadow-none focus-visible:ring-0"
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" size="icon-sm" variant="ghost" aria-label={`${name} 字段操作`}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onSelect={onInsert}>
              <Code2 />
              插入字段
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onWrap}>
              <Braces />
              插入条件块
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" disabled={!canRemove} onSelect={onRemove}>
              <Trash2 />
              删除字段
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <Input
        value={note}
        aria-label={`${name} 备注`}
        placeholder="备注，会提供给 AI"
        className="h-7 border-0 bg-transparent px-1 text-xs text-foreground/75 shadow-none placeholder:text-muted-foreground focus-visible:ring-0"
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
    <div className="flex w-full min-w-0 flex-col gap-1 border-b border-border/70 bg-card/60 px-2.5 py-2.5 last:border-b-0">
      <div className="flex min-w-0 items-center gap-1.5">
        <Input
          value={draft}
          aria-label={`TTS 字段 ${name}`}
          className="h-7 min-w-0 flex-1 rounded-md border-0 bg-transparent px-1 text-sm font-medium shadow-none focus-visible:ring-0"
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
        <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[10px] tracking-wide text-muted-foreground">
          TTS
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" size="icon-sm" variant="ghost" aria-label={`${name} TTS 字段操作`}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onSelect={onInsert}>
              <Code2 />
              插入字段
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onWrap}>
              <Braces />
              插入条件块
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" disabled={!canRemove} onSelect={onRemove}>
              <Trash2 />
              删除字段
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-1 px-1.5 pb-0.5">
        <select
          aria-label={`${name} 朗读字段`}
          value={source}
          className="h-7 min-w-0 flex-1 rounded-md border-0 bg-transparent text-xs text-foreground/75 outline-none"
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
          className="h-7 w-20 rounded-md border-0 bg-transparent text-xs text-foreground/75 outline-none"
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
  const [mobileSection, setMobileSection] = useState<MobileSection>("code")
  const [templateId, setTemplateId] = useState(() => templatesOf(deck)[0]!.id)
  const [deleteTemplateOpen, setDeleteTemplateOpen] = useState(false)
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
  const templates = templatesOf(deck)
  const activeTemplateId = templates.some((item) => item.id === templateId)
    ? templateId
    : templates[0]!.id
  const template = getCardTemplate(deck, activeTemplateId)

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

  const value = pane === "css" ? deck.css : template[pane]
  const language = pane === "css" ? "css" : "template"

  const updatePane = (next: string) => {
    if (pane === "css") {
      onChange({ ...deck, css: next })
      return
    }
    onChange(updateCardTemplate(deck, template.id, { [pane]: next }))
  }

  const insertSnippet = (snippet: string) => {
    editorRef.current?.insert(snippet)
  }

  const insertFieldSnippet = (snippet: string) => {
    insertSnippet(snippet)
    setMobileSection("code")
  }

  const wrapFieldSnippet = (field: string) => {
    editorRef.current?.wrap(`{{#${field}}}`, `{{/${field}}}`)
    setMobileSection("code")
  }

  const createTemplate = () => {
    const next = addCardTemplate(deck)
    onChange(next)
    setTemplateId(templatesOf(next).at(-1)!.id)
  }

  const copyTemplate = () => {
    const next = duplicateCardTemplate(deck, template.id)
    onChange(next)
    setTemplateId(templatesOf(next).at(-1)!.id)
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
          front: template.front,
          back: template.back,
          css: deck.css,
          sample: previewCard
            ? formatCardContext(textFields(deck), previewCard.values, notesOf(deck))
            : "",
        })
        let changed = deck
        if (typeof next.front === "string" || typeof next.back === "string") {
          changed = updateCardTemplate(changed, template.id, {
            ...(typeof next.front === "string" ? { front: next.front } : {}),
            ...(typeof next.back === "string" ? { back: next.back } : {}),
          })
        }
        if (typeof next.css === "string") changed = { ...changed, css: next.css }
        onChange(changed)
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
    <div className="flex min-w-0 flex-col gap-4">
      <Tabs
        value={mobileSection}
        className="xl:hidden"
        onValueChange={(value) => setMobileSection(value as MobileSection)}
      >
        <TabsList className="grid h-11 w-full grid-cols-4 rounded-xl p-1">
          <TabsTrigger value="manage">管理</TabsTrigger>
          <TabsTrigger value="fields">字段</TabsTrigger>
          <TabsTrigger value="code">代码</TabsTrigger>
          <TabsTrigger value="preview">预览</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(230px,280px)_minmax(360px,1.15fr)_minmax(300px,0.85fr)] xl:items-start">
        <aside
          className={cn(
            "min-w-0 flex-col gap-4 xl:sticky xl:top-4 xl:flex xl:self-start",
            mobileSection === "manage" || mobileSection === "fields" ? "flex" : "hidden"
          )}
        >
          <section
            className={cn(
              "rounded-2xl border border-border/70 bg-card/75 p-4",
              mobileSection === "manage" ? "block" : "hidden xl:block"
            )}
          >
            <div className="mb-4">
              <p className="text-sm font-medium">模板管理</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{templates.length} 个卡片模板</p>
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="card-template-picker">当前模板</Label>
                <Select value={template.id} onValueChange={setTemplateId}>
                  <SelectTrigger id="card-template-picker" className="w-full bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((item) => (
                      <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="card-template-name">模板名称</Label>
                <Input
                  id="card-template-name"
                  value={template.name}
                  className="bg-background"
                  onChange={(event) => onChange(updateCardTemplate(deck, template.id, { name: event.target.value }))}
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Button type="button" onClick={createTemplate}>
                  <Plus data-icon="inline-start" />
                  新建
                </Button>
                <Button type="button" variant="outline" onClick={copyTemplate}>
                  <Copy data-icon="inline-start" />
                  复制
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={templates.length <= 1}
                  onClick={() => setDeleteTemplateOpen(true)}
                >
                  <Trash2 data-icon="inline-start" />
                  删除
                </Button>
              </div>
            </div>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              每个模板都会为同一条笔记生成独立卡片，并保留自己的 FSRS 学习进度。
            </p>
          </section>

          <section
            className={cn(
              "min-w-0 flex-col gap-3",
              mobileSection === "fields" ? "flex" : "hidden xl:flex"
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">字段</p>
                <p className="mt-0.5 text-xs text-muted-foreground">共 {deck.fields.length} 个</p>
              </div>
              <div className="flex items-center gap-1.5">
                <Button type="button" size="sm" variant="outline" disabled={sources.length === 0} onClick={openTtsDialog}>
                  <Volume2 data-icon="inline-start" />
                  TTS
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => applyFieldChange(tryAddField(deck))}>
                  <Plus data-icon="inline-start" />
                  字段
                </Button>
              </div>
            </div>
            <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/50 xl:max-h-[calc(100vh-34rem)] xl:min-h-[260px] xl:overflow-y-auto">
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
                      onInsert={() => insertFieldSnippet(`{{${field}}}`)}
                      onWrap={() => wrapFieldSnippet(field)}
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
                    onInsert={() => insertFieldSnippet(`{{${field}}}`)}
                    onWrap={() => wrapFieldSnippet(field)}
                  />
                )
              })}
            </div>
            <p className="text-xs leading-5 text-muted-foreground">
              字段备注会作为上下文传给 AI。通过每行右侧菜单可插入字段、条件块或删除字段。
            </p>
          </section>

        </aside>

        <section
          className={cn(
            "min-w-0 flex-col gap-3 xl:flex",
            mobileSection === "code" ? "flex" : "hidden"
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">代码编辑</p>
              <p className="truncate text-xs text-muted-foreground">{template.name}</p>
            </div>
            <Button type="button" variant="outline" onClick={() => setAiOpen(true)}>
              <Sparkles data-icon="inline-start" />
              AI 编辑
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Tabs
              value={pane}
              className="min-w-0 flex-1 xl:flex-none"
              onValueChange={(next) => switchPane(next as Pane)}
            >
              <TabsList className="grid w-full grid-cols-3 xl:w-auto">
                <TabsTrigger value="front">正面</TabsTrigger>
                <TabsTrigger value="back">背面</TabsTrigger>
                <TabsTrigger value="css">样式</TabsTrigger>
              </TabsList>
            </Tabs>
            {pane === "back" ? (
              <Button type="button" size="sm" variant="outline" onClick={() => insertSnippet("{{FrontSide}}")}>
                FrontSide
              </Button>
            ) : null}
          </div>
          <CodeEditor
            key={`${template.id}-${pane}`}
            ref={editorRef}
            id={`template-${pane}`}
            label={pane === "front" ? "正面模板" : pane === "back" ? "背面模板" : "样式 CSS"}
            value={value}
            language={language}
            onChange={updatePane}
          />
          <p className="rounded-xl bg-muted/50 px-3 py-2 text-xs leading-5 break-words text-muted-foreground">
            <span className="font-medium text-foreground/80">字段语法：</span>
            {` {{字段}} 显示内容，{{#字段}}…{{/字段}} 仅在有值时显示。Ctrl+1 / 2 / 3 切换面板。`}
          </p>
        </section>

        <section className={cn("min-h-0 min-w-0 xl:sticky xl:top-4 xl:block", mobileSection === "preview" ? "block" : "hidden")}>
          <CardPreview
            deck={deck}
            values={previewCard?.values ?? {}}
            side={previewSide}
            templateId={template.id}
            onSideChange={onPreviewSideChange}
            fillViewport
          />
        </section>
      </div>

      <AlertDialog open={deleteTemplateOpen} onOpenChange={setDeleteTemplateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除「{template.name}」？</AlertDialogTitle>
            <AlertDialogDescription>
              该模板生成的 FSRS 学习进度会一并删除，笔记字段和其他模板不受影响。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteTemplateOpen(false)}>取消</Button>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                const result = removeCardTemplate(deck, template.id)
                if (!result.ok) {
                  setAlert(result.error)
                  return
                }
                onChange(result.deck)
                setTemplateId(templatesOf(result.deck)[0]!.id)
              }}
            >
              删除模板
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
              <Select
                value={ttsSource}
                onValueChange={(next) => {
                  setTtsSource(next)
                  if (!ttsName.trim() || ttsName === `${ttsSource}_${ttsLang}`) {
                    setTtsName(`${next}_${ttsLang}`)
                  }
                }}
              >
                <SelectTrigger id="tts-source" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sources.map((field) => (
                    <SelectItem key={field} value={field}>{field}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
