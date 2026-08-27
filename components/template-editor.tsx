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
    <div className="flex w-full min-w-0 flex-col gap-1.5 rounded-[1.35rem] bg-[#dff5c8] p-2.5 shadow-[0_12px_30px_-28px_rgba(0,0,0,0.6)] dark:bg-[#314c25]">
      <div className="flex min-w-0 items-center gap-1.5">
        <Input
          value={draft}
          aria-label={`字段 ${name}`}
          className="h-8 min-w-0 flex-1 rounded-full border-0 bg-white/55 px-3 text-sm font-black shadow-none focus-visible:ring-black/10 dark:bg-black/15 dark:focus-visible:ring-white/10"
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
            <Button type="button" size="icon-sm" variant="ghost" className="bg-white/45 dark:bg-black/15" aria-label={`${name} 字段操作`}>
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
        className="h-8 border-0 bg-white/45 px-3 text-xs font-semibold text-foreground/75 shadow-none placeholder:text-muted-foreground focus-visible:ring-black/10 dark:bg-black/10 dark:focus-visible:ring-white/10"
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
    <div className="flex w-full min-w-0 flex-col gap-1.5 rounded-[1.35rem] bg-[#dff1ff] p-2.5 shadow-[0_12px_30px_-28px_rgba(0,0,0,0.6)] dark:bg-[#1e3b55]">
      <div className="flex min-w-0 items-center gap-1.5">
        <Input
          value={draft}
          aria-label={`TTS 字段 ${name}`}
          className="h-8 min-w-0 flex-1 rounded-full border-0 bg-white/55 px-3 text-sm font-black shadow-none focus-visible:ring-black/10 dark:bg-black/15 dark:focus-visible:ring-white/10"
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
        <span className="shrink-0 rounded-full bg-black px-2 py-1 text-[9px] font-black tracking-[0.1em] text-white dark:bg-white dark:text-black">
          TTS
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" size="icon-sm" variant="ghost" className="bg-white/45 dark:bg-black/15" aria-label={`${name} TTS 字段操作`}>
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
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_5rem_auto] items-center gap-1.5 px-1 pb-0.5 max-[380px]:grid-cols-2">
        <select
          aria-label={`${name} 朗读字段`}
          value={source}
          className="h-8 min-w-0 rounded-full border-0 bg-white/45 px-2.5 text-xs font-bold text-foreground/75 outline-none dark:bg-black/10"
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
          className="h-8 rounded-full border-0 bg-white/45 px-2.5 text-xs font-bold text-foreground/75 outline-none dark:bg-black/10"
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
          variant="ghost"
          className={cn(
            "h-8 shrink-0 rounded-full px-2.5 font-black max-[380px]:col-span-2",
            slow ? "bg-black text-white hover:bg-black/85 dark:bg-white dark:text-black" : "bg-white/45 dark:bg-black/10"
          )}
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
  const [fieldOpen, setFieldOpen] = useState(false)
  const [newFieldName, setNewFieldName] = useState("")
  const [newFieldNote, setNewFieldNote] = useState("")
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

  const openFieldDialog = () => {
    setNewFieldName("")
    setNewFieldNote("")
    setFieldOpen(true)
  }

  const addField = () => {
    const result = tryAddField(deck, {
      name: newFieldName,
      note: newFieldNote,
    })
    if (!applyFieldChange(result)) return
    setFieldOpen(false)
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
    <div className="flex min-w-0 flex-col gap-4 pb-6">
      <div className="relative overflow-hidden rounded-[2rem] bg-[#ffdce9] p-4 shadow-[0_20px_54px_-42px_rgba(0,0,0,0.68)] dark:bg-[#5e3047] sm:p-5">
        <div className="pointer-events-none absolute -right-8 -top-10 size-28 rounded-full bg-[#ffe39a]/70 dark:bg-[#68551f]/70" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-10 right-20 size-24 rounded-[48%_52%_58%_42%/42%_58%_42%_58%] bg-[#c8f889]/65 dark:bg-[#385528]/70" aria-hidden="true" />
        <div className="relative z-10 flex items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-black/40 dark:text-white/45">template studio</p>
            <h2 className="mt-1 truncate text-2xl font-black tracking-[-0.055em] text-foreground sm:text-3xl">{template.name}</h2>
            <p className="mt-1 text-xs font-semibold text-muted-foreground">设计卡片结构、字段与显示样式</p>
          </div>
          <div className="grid shrink-0 grid-cols-2 gap-1.5 text-center">
            <div className="rounded-[1.15rem] bg-white/55 px-3 py-2 dark:bg-black/15">
              <p className="text-lg font-black leading-none">{templates.length}</p>
              <p className="mt-1 text-[9px] font-black uppercase tracking-[0.12em] opacity-45">templates</p>
            </div>
            <div className="rounded-[1.15rem] bg-white/55 px-3 py-2 dark:bg-black/15">
              <p className="text-lg font-black leading-none">{deck.fields.length}</p>
              <p className="mt-1 text-[9px] font-black uppercase tracking-[0.12em] opacity-45">fields</p>
            </div>
          </div>
        </div>
      </div>

      <Tabs
        value={mobileSection}
        className="sticky top-[calc(env(safe-area-inset-top)+4.25rem)] z-20 xl:hidden"
        onValueChange={(value) => setMobileSection(value as MobileSection)}
      >
        <TabsList className="grid h-11 w-full grid-cols-4 rounded-full bg-[#fffaf5]/94 p-1 shadow-[0_12px_28px_-22px_rgba(0,0,0,0.6)] backdrop-blur-xl dark:bg-[#171512]/94">
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
              "rounded-[2rem] border-0 bg-[#ffe39a] p-4 shadow-[0_20px_48px_-38px_rgba(0,0,0,0.62)] dark:bg-[#68551f]",
              mobileSection === "manage" ? "block" : "hidden xl:block"
            )}
          >
            <div className="mb-4">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-black/40 dark:text-white/45">manage</p>
              <p className="mt-0.5 text-lg font-black tracking-[-0.035em]">模板管理</p>
              <p className="mt-0.5 text-xs font-semibold text-muted-foreground">{templates.length} 个卡片模板</p>
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="card-template-picker">当前模板</Label>
                <Select value={template.id} onValueChange={setTemplateId}>
                  <SelectTrigger id="card-template-picker" className="w-full border-0 bg-white/60 dark:bg-black/15">
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
                  className="border-0 bg-white/60 font-bold dark:bg-black/15"
                  onChange={(event) => onChange(updateCardTemplate(deck, template.id, { name: event.target.value }))}
                />
              </div>
              <div className="grid grid-cols-3 gap-1.5 max-[380px]:grid-cols-1">
                <Button type="button" className="bg-black text-white hover:bg-black/85 dark:bg-white dark:text-black" onClick={createTemplate}>
                  <Plus data-icon="inline-start" />
                  新建
                </Button>
                <Button type="button" variant="ghost" className="bg-white/55 dark:bg-black/15" onClick={copyTemplate}>
                  <Copy data-icon="inline-start" />
                  复制
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="bg-white/45 text-destructive hover:bg-white/65 dark:bg-black/15"
                  disabled={templates.length <= 1}
                  onClick={() => setDeleteTemplateOpen(true)}
                >
                  <Trash2 data-icon="inline-start" />
                  删除
                </Button>
              </div>
            </div>
            <p className="mt-3 text-xs font-medium leading-5 text-muted-foreground">
              每个模板都会为同一条笔记生成独立卡片，并保留自己的 FSRS 学习进度。
            </p>
          </section>

          <section
            className={cn(
              "min-w-0 flex-col gap-3 rounded-[2rem] bg-[#dff5c8] p-3.5 shadow-[0_20px_48px_-40px_rgba(0,0,0,0.62)] dark:bg-[#314c25]",
              mobileSection === "fields" ? "flex" : "hidden xl:flex"
            )}
          >
            <div className="flex items-center justify-between gap-3 px-1">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-black/40 dark:text-white/45">data shape</p>
                <p className="mt-0.5 text-lg font-black tracking-[-0.035em]">字段</p>
                <p className="mt-0.5 text-xs font-semibold text-muted-foreground">共 {deck.fields.length} 个</p>
              </div>
              <div className="flex items-center gap-1.5">
                <Button type="button" size="sm" variant="ghost" className="bg-white/55 dark:bg-black/15" disabled={sources.length === 0} onClick={openTtsDialog}>
                  <Volume2 data-icon="inline-start" />
                  TTS
                </Button>
                <Button type="button" size="sm" className="bg-black text-white hover:bg-black/85 dark:bg-white dark:text-black" onClick={openFieldDialog}>
                  <Plus data-icon="inline-start" />
                  字段
                </Button>
              </div>
            </div>
            <div className="space-y-2 overflow-visible bg-transparent xl:max-h-[calc(100vh-34rem)] xl:min-h-[260px] xl:overflow-y-auto xl:pr-1">
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
            <p className="px-1 text-xs font-medium leading-5 text-muted-foreground">
              字段备注会作为上下文传给 AI。通过每张字段卡右侧菜单可插入字段、条件块或删除字段。
            </p>
          </section>
        </aside>

        <section
          className={cn(
            "min-w-0 flex-col gap-3 rounded-[2rem] bg-[#ffdce9] p-3.5 shadow-[0_20px_54px_-42px_rgba(0,0,0,0.64)] dark:bg-[#5e3047] xl:flex",
            mobileSection === "code" ? "flex" : "hidden"
          )}
        >
          <div className="flex items-center justify-between gap-3 px-1">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-black/40 dark:text-white/45">code canvas</p>
              <p className="mt-0.5 text-lg font-black tracking-[-0.035em]">代码编辑</p>
              <p className="truncate text-xs font-semibold text-muted-foreground">{template.name}</p>
            </div>
            <Button type="button" variant="ghost" className="bg-black text-white hover:bg-black/85 dark:bg-white dark:text-black dark:hover:bg-white/90" onClick={() => setAiOpen(true)}>
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
              <TabsList className="grid w-full grid-cols-3 bg-white/55 xl:w-auto dark:bg-black/15">
                <TabsTrigger value="front">正面</TabsTrigger>
                <TabsTrigger value="back">背面</TabsTrigger>
                <TabsTrigger value="css">样式</TabsTrigger>
              </TabsList>
            </Tabs>
            {pane === "back" ? (
              <Button type="button" size="sm" variant="ghost" className="bg-white/55 dark:bg-black/15" onClick={() => insertSnippet("{{FrontSide}}")}>
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
          <p className="rounded-[1.2rem] bg-white/45 px-3 py-2.5 text-xs font-medium leading-5 break-words text-muted-foreground dark:bg-black/10">
            <span className="font-black text-foreground/80">字段语法：</span>
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

      <Dialog open={fieldOpen} onOpenChange={setFieldOpen}>
        <DialogContent>
          <DialogHeader>
            <div className="mb-1 inline-flex w-fit rounded-full bg-[#c8f889]/55 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em]">new field</div>
            <DialogTitle>添加字段</DialogTitle>
            <DialogDescription>
              字段名用于模板变量；备注会提示笔记填写要求，并作为上下文传给 AI。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 rounded-[1.5rem] bg-[#dff5c8] p-3.5 dark:bg-[#314c25]">
            <div className="space-y-2">
              <Label htmlFor="field-name">字段名</Label>
              <Input
                id="field-name"
                autoFocus
                value={newFieldName}
                placeholder="例如：PartOfSpeech"
                className="bg-white/65 dark:bg-black/15"
                onChange={(event) => setNewFieldName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="field-note">字段备注</Label>
              <Textarea
                id="field-note"
                value={newFieldNote}
                placeholder="说明字段含义、格式或生成要求"
                className="min-h-24 resize-y bg-white/65 dark:bg-black/15"
                onChange={(event) => setNewFieldNote(event.target.value)}
              />
              <p className="text-xs font-medium leading-5 text-muted-foreground">
                备注会淡色显示在空输入框内，已有内容时不会显示。
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setFieldOpen(false)}>
              取消
            </Button>
            <Button type="button" disabled={!newFieldName.trim()} onClick={addField}>
              添加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={ttsOpen} onOpenChange={setTtsOpen}>
        <DialogContent>
          <DialogHeader>
            <div className="mb-1 inline-flex w-fit rounded-full bg-[#dff1ff] px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] dark:bg-[#1e3b55]">voice field</div>
            <DialogTitle>添加 TTS 字段</DialogTitle>
            <DialogDescription>
              根据已有字段在导出 APKG 时生成 Google 语音。编辑器里可以试听，不会写入卡片内容。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 rounded-[1.5rem] bg-[#dff1ff] p-3.5 dark:bg-[#1e3b55]">
            <div className="space-y-2">
              <Label htmlFor="tts-name">字段名</Label>
              <Input
                id="tts-name"
                value={ttsName}
                className="bg-white/65 dark:bg-black/15"
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
                <SelectTrigger id="tts-source" className="w-full bg-white/65 dark:bg-black/15">
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
              <div className="flex flex-wrap gap-1.5">
                {TTS_LANGS.map((item) => (
                  <Button
                    key={item.id}
                    type="button"
                    size="sm"
                    variant="ghost"
                    className={cn(
                      "rounded-full",
                      ttsLang === item.id
                        ? "bg-black text-white dark:bg-white dark:text-black"
                        : "bg-white/55 dark:bg-black/15"
                    )}
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
            <label className="flex min-h-11 touch-manipulation items-center gap-2 rounded-full bg-white/50 px-3 text-sm font-bold [-webkit-tap-highlight-color:transparent] dark:bg-black/10">
              <input
                type="checkbox"
                checked={ttsSlow}
                className="size-4 accent-black dark:accent-white"
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
            <div className="mb-1 inline-flex w-fit rounded-full bg-[#ff9bd6]/35 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em]">ai design</div>
            <DialogTitle>AI 编辑模板</DialogTitle>
            <DialogDescription>
              用一句话说明想怎么改。例如：正面只保留 Word 和 Phonetic，背面加上 Example。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 rounded-[1.5rem] bg-[#ffdce9] p-3.5 dark:bg-[#5e3047]">
            <div className="space-y-2">
              <Label htmlFor="template-ai-instruction">修改说明</Label>
              <Textarea
                id="template-ai-instruction"
                value={aiInstruction}
                placeholder="例如：背面不要重复正面，Translation 用更大的字，TTS 字段放在 Word 下面"
                className="min-h-28 bg-white/65 dark:bg-black/15"
                disabled={aiBusy}
                onChange={(event) => setAiInstruction(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>修改范围</Label>
              <div className="flex flex-wrap gap-1.5">
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
                    variant="ghost"
                    className={cn(
                      "rounded-full",
                      aiTarget === id
                        ? "bg-black text-white dark:bg-white dark:text-black"
                        : "bg-white/55 dark:bg-black/15"
                    )}
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
              {aiBusy ? "生成中" : "开始生成"}
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
