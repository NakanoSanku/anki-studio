"use client"

import { useRef, useState } from "react"
import {
  AlertCircle,
  Check,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  LoaderCircle,
  RefreshCw,
  RotateCcw,
  Save,
  Sparkles,
  WandSparkles,
  Zap,
} from "lucide-react"

import {
  DEFAULT_AI_SETTINGS,
  PROMPT_SPECS,
  readAiSettings,
  validateAiSettings,
  validateProviderEndpoint,
  writeAiSettings,
  type AiSettings,
  type PromptKey,
  type PromptSpec,
} from "@/lib/ai-settings"
import { listProviderModels, withBrowserCorsHint } from "@/lib/ai-upstream"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CodeEditor, type CodeEditorHandle } from "@/components/code-editor"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

const promptColors = [
  "bg-[#dff1ff] text-[#174f85] dark:bg-[#244d74] dark:text-[#dceeff]",
  "bg-[#d8f4aa] text-[#315f18] dark:bg-[#385528] dark:text-[#e4f8c5]",
  "bg-[#ffe39a] text-[#654600] dark:bg-[#68551f] dark:text-[#ffedb8]",
  "bg-[#ffd8df] text-[#761c31] dark:bg-[#6a2835] dark:text-[#ffdce3]",
] as const

export function AiSettingsPanel() {
  const [settings, setSettings] = useState<AiSettings>(readAiSettings)
  const [models, setModels] = useState<string[]>([])
  const [showApiKey, setShowApiKey] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<{ type: "idle" | "success" | "error" | "info"; message: string }>({
    type: "idle",
    message: "",
  })
  const [editingPromptKey, setEditingPromptKey] = useState<PromptKey | null>(null)
  const [promptDraft, setPromptDraft] = useState("")
  const [copiedPrompt, setCopiedPrompt] = useState(false)
  const editorRef = useRef<CodeEditorHandle>(null)

  const patch = (partial: Partial<AiSettings>) => {
    setSettings((current) => ({ ...current, ...partial }))
    setStatus({ type: "idle", message: "" })
  }

  const trimmed = (): AiSettings => ({
    ...settings,
    model: settings.model.trim(),
    apiKey: settings.apiKey.trim(),
    baseURL: settings.baseURL.trim(),
    systemPrompt: settings.systemPrompt.trim(),
    cardCompletePrompt: settings.cardCompletePrompt.trim(),
    batchPrompt: settings.batchPrompt.trim(),
    templateEditPrompt: settings.templateEditPrompt.trim(),
  })

  const save = () => {
    const next = trimmed()
    const error = validateAiSettings(next)
    if (error) {
      setStatus({ type: "error", message: error })
      return
    }
    writeAiSettings(next)
    setSettings(next)
    setStatus({ type: "success", message: "配置已保存" })
  }

  const fetchModels = async () => {
    const next = trimmed()
    const error = validateProviderEndpoint(next.baseURL)
    if (error) {
      setStatus({ type: "error", message: error })
      return
    }
    setBusy(true)
    setStatus({ type: "info", message: "正在拉取在线模型列表…" })
    try {
      const fetched = await withBrowserCorsHint(() => listProviderModels(next))
      setModels(fetched)
      if (!next.model || !fetched.includes(next.model)) patch({ model: fetched[0] ?? next.model })
      setStatus({ type: "success", message: `已获取 ${fetched.length} 个可用模型` })
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : "拉取模型失败" })
    } finally {
      setBusy(false)
    }
  }

  const testConnection = async () => {
    const next = trimmed()
    const error = validateAiSettings(next)
    if (error) {
      setStatus({ type: "error", message: error })
      return
    }
    setBusy(true)
    setStatus({ type: "info", message: "正在测试连接…" })
    const startTime = Date.now()
    try {
      await withBrowserCorsHint(async () => {
        const { runTestAi } = await import("@/lib/ai-run")
        await runTestAi(next)
      })
      setStatus({ type: "success", message: `连接成功 (${Date.now() - startTime}ms)` })
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : "连接失败，请检查网络或密钥" })
    } finally {
      setBusy(false)
    }
  }

  const pasteApiKey = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text) {
        patch({ apiKey: text.trim() })
        setStatus({ type: "info", message: "已粘贴 API Key" })
      }
    } catch {
      setStatus({ type: "error", message: "无法读取剪贴板，请手动粘贴" })
    }
  }

  const resetAllDefaults = () => {
    setSettings({ ...DEFAULT_AI_SETTINGS })
    setModels([])
    setStatus({ type: "info", message: "已恢复默认配置" })
  }

  const openPromptEditor = (key: PromptKey) => {
    setEditingPromptKey(key)
    setPromptDraft(settings[key] ?? DEFAULT_AI_SETTINGS[key])
    setCopiedPrompt(false)
  }

  const savePromptDraft = () => {
    if (!editingPromptKey) return
    patch({ [editingPromptKey]: promptDraft })
    writeAiSettings({ ...settings, [editingPromptKey]: promptDraft })
    setEditingPromptKey(null)
    setStatus({ type: "success", message: "提示词已更新" })
  }

  const insertVariable = (varName: string) => {
    const snippet = `{{${varName}}}`
    if (editorRef.current) editorRef.current.insert(snippet)
    else setPromptDraft((previous) => `${previous}${snippet}`)
  }

  const activeSpec: PromptSpec | undefined = PROMPT_SPECS.find((spec) => spec.key === editingPromptKey)
  const isDraftModified = editingPromptKey ? promptDraft !== DEFAULT_AI_SETTINGS[editingPromptKey] : false
  const customPromptCount = PROMPT_SPECS.filter((spec) => settings[spec.key] !== DEFAULT_AI_SETTINGS[spec.key]).length

  return (
    <div className="mx-auto w-full max-w-xl space-y-4 pb-12">
      <section className="relative overflow-hidden rounded-[2.25rem] bg-[#ffb4dd] p-5 text-[#5c1942] shadow-[0_24px_64px_-44px_rgba(0,0,0,0.72)] dark:bg-[#613552] dark:text-[#ffe1f2] sm:p-6">
        <div className="pointer-events-none absolute -right-10 -top-8 size-40 rounded-[54%_46%_58%_42%/44%_57%_43%_56%] bg-[#ffe39a] opacity-90 dark:bg-[#68551f]" aria-hidden="true" />
        <div className="pointer-events-none absolute bottom-5 right-10 flex size-20 rotate-6 items-center justify-center rounded-[40%_60%_56%_44%/58%_43%_57%_42%] bg-[#dff1ff] text-[#174f85] dark:bg-[#244d74] dark:text-[#dceeff]" aria-hidden="true">
          <Sparkles className="size-7" />
        </div>

        <div className="relative z-10">
          <div className="flex items-center justify-between gap-3">
            <span className="rounded-full bg-white/45 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] dark:bg-black/15">ai brain</span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-9 bg-white/45 px-3 text-xs font-black text-current hover:bg-white/70 hover:text-current dark:bg-black/15 dark:hover:bg-black/25"
              onClick={resetAllDefaults}
            >
              <RotateCcw className="size-3.5" />默认配置
            </Button>
          </div>
          <h2 className="mt-6 max-w-[75%] text-3xl font-black tracking-[-0.06em] sm:text-4xl">让 AI 帮你做卡片</h2>
          <p className="mt-2 max-w-[72%] text-sm font-semibold leading-6 opacity-55">
            连接兼容 OpenAI 的接口，用于补全卡片、批量生成和改模板。
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <span className="rounded-full bg-black px-3 py-1.5 text-[10px] font-black text-white dark:bg-white dark:text-black">
              {settings.model.trim() || "未选择模型"}
            </span>
            <span className="rounded-full bg-white/55 px-3 py-1.5 text-[10px] font-black">
              {customPromptCount} 个自定义提示词
            </span>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] bg-card p-4 shadow-[0_22px_60px_-46px_rgba(0,0,0,0.7)] sm:p-5">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">provider</p>
            <h3 className="mt-0.5 text-xl font-black tracking-[-0.045em]">连接模型</h3>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-9 px-3 text-xs font-black"
            disabled={busy}
            onClick={() => void testConnection()}
          >
            <Zap className={cn("size-3.5", busy && "animate-pulse")} />
            {busy ? "测试中" : "测试连接"}
          </Button>
        </div>

        <div className="space-y-3">
          <div className="rounded-[1.45rem] bg-[#dff1ff] p-3.5 text-[#174f85] dark:bg-[#244d74] dark:text-[#dceeff]">
            <Label htmlFor="baseURL-input" className="text-[10px] font-black uppercase tracking-[0.14em] text-current opacity-50">Base URL</Label>
            <Input
              id="baseURL-input"
              value={settings.baseURL}
              placeholder="https://api.openai.com/v1"
              className="mt-2 h-11 border-0 bg-white/60 font-mono text-xs font-semibold shadow-none dark:bg-black/15"
              onChange={(event) => patch({ baseURL: event.target.value })}
            />
          </div>

          <div className="rounded-[1.45rem] bg-[#d8f4aa] p-3.5 text-[#315f18] dark:bg-[#385528] dark:text-[#e4f8c5]">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="model-input" className="text-[10px] font-black uppercase tracking-[0.14em] text-current opacity-50">Model</Label>
              <button
                type="button"
                disabled={busy}
                onClick={() => void fetchModels()}
                className="flex items-center gap-1 text-[10px] font-black opacity-65 transition-opacity hover:opacity-100 disabled:opacity-30"
              >
                <RefreshCw className={cn("size-3", busy && "animate-spin")} />
                {models.length > 0 ? `${models.length} models` : "拉取模型"}
              </button>
            </div>
            {models.length > 0 ? (
              <Select value={settings.model} onValueChange={(model) => patch({ model })}>
                <SelectTrigger id="model-input" className="mt-2 h-11 w-full border-0 bg-white/60 font-mono text-xs font-bold dark:bg-black/15">
                  <SelectValue placeholder="选择模型" />
                </SelectTrigger>
                <SelectContent position="popper" align="start" className="max-h-64">
                  {!models.includes(settings.model) && settings.model ? <SelectItem value={settings.model}>{settings.model}</SelectItem> : null}
                  {models.map((model) => <SelectItem key={model} value={model}>{model}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id="model-input"
                value={settings.model}
                placeholder="gpt-4o-mini"
                className="mt-2 h-11 border-0 bg-white/60 font-mono text-xs font-bold shadow-none dark:bg-black/15"
                onChange={(event) => patch({ model: event.target.value })}
              />
            )}
          </div>

          <div className="rounded-[1.45rem] bg-[#ffe39a] p-3.5 text-[#654600] dark:bg-[#68551f] dark:text-[#ffedb8]">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="apiKey-input" className="text-[10px] font-black uppercase tracking-[0.14em] text-current opacity-50">API Key</Label>
              <button type="button" onClick={() => void pasteApiKey()} className="text-[10px] font-black opacity-60 hover:opacity-100">从剪贴板粘贴</button>
            </div>
            <div className="relative mt-2">
              <Input
                id="apiKey-input"
                type={showApiKey ? "text" : "password"}
                value={settings.apiKey}
                placeholder="sk-... · 免密接口可留空"
                className="h-11 border-0 bg-white/60 pr-11 font-mono text-xs font-semibold shadow-none dark:bg-black/15"
                onChange={(event) => patch({ apiKey: event.target.value })}
              />
              <button
                type="button"
                aria-label={showApiKey ? "隐藏 API Key" : "显示 API Key"}
                onClick={() => setShowApiKey((visible) => !visible)}
                className="absolute right-3 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full bg-black/8"
              >
                {showApiKey ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              </button>
            </div>
          </div>
        </div>

        {status.message ? (
          <div
            className={cn(
              "mt-3 flex items-start gap-2 rounded-[1.3rem] px-3.5 py-3 text-xs font-semibold",
              status.type === "success"
                ? "bg-[#d8f4aa] text-[#315f18] dark:bg-[#385528] dark:text-[#e4f8c5]"
                : status.type === "error"
                  ? "bg-[#ffd8df] text-[#761c31] dark:bg-[#6a2835] dark:text-[#ffdce3]"
                  : "bg-[#dff1ff] text-[#174f85] dark:bg-[#244d74] dark:text-[#dceeff]"
            )}
            role="status"
          >
            {status.type === "success" ? <Check className="mt-0.5 size-4 shrink-0" /> : status.type === "error" ? <AlertCircle className="mt-0.5 size-4 shrink-0" /> : <LoaderCircle className={cn("mt-0.5 size-4 shrink-0", status.type === "info" && busy && "animate-spin")} />}
            <span className="leading-5">{status.message}</span>
          </div>
        ) : null}

        <Button
          type="button"
          className="mt-3 h-13 w-full bg-black text-sm font-black text-white hover:bg-black/85 dark:bg-white dark:text-black dark:hover:bg-white/90"
          disabled={busy}
          onClick={save}
        >
          <Save className="size-4" />保存 AI 配置
        </Button>
      </section>

      <section>
        <div className="mb-2.5 flex items-end justify-between px-1">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">prompts</p>
            <h3 className="mt-0.5 text-xl font-black tracking-[-0.045em]">AI 怎么思考</h3>
          </div>
          <span className="text-[10px] font-bold text-muted-foreground">点击卡片编辑</span>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {PROMPT_SPECS.map((spec, index) => {
            const modified = settings[spec.key] !== DEFAULT_AI_SETTINGS[spec.key]
            return (
              <button
                key={spec.key}
                type="button"
                onClick={() => openPromptEditor(spec.key)}
                className={cn(
                  "group relative min-h-32 rounded-[1.7rem] p-4 text-left transition-transform active:scale-[0.985]",
                  promptColors[index % promptColors.length]
                )}
              >
                <span className="flex size-9 items-center justify-center rounded-full bg-white/50 dark:bg-black/15">
                  {index % 2 === 0 ? <WandSparkles className="size-4" /> : <Sparkles className="size-4" />}
                </span>
                <span className="mt-4 block text-sm font-black tracking-[-0.035em]">{spec.label}</span>
                <span className="mt-1 flex items-center gap-1 text-[10px] font-bold opacity-50">
                  {modified ? "已自定义" : "使用默认"}
                  <ChevronRight className="size-3 transition-transform group-hover:translate-x-0.5" />
                </span>
              </button>
            )
          })}
        </div>
      </section>

      <Sheet open={Boolean(editingPromptKey)} onOpenChange={(open) => !open && setEditingPromptKey(null)}>
        <SheetContent
          side="bottom"
          className="mx-auto flex h-[92dvh] max-h-[820px] flex-col rounded-t-[2.25rem] border-0 bg-[#fffaf5] p-0 shadow-[0_-28px_80px_-42px_rgba(0,0,0,0.72)] dark:bg-[#171512] sm:max-w-xl"
        >
          {activeSpec ? (
            <>
              <SheetHeader className="px-5 pb-3 pt-5">
                <div className="mb-2 flex items-center gap-2 pr-8">
                  <span className="rounded-full bg-[#ff9bd6]/30 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em]">prompt lab</span>
                  <Badge className="border-0 bg-black px-2.5 py-1 font-mono text-[9px] font-bold text-white shadow-none dark:bg-white dark:text-black">{promptDraft.length} 字</Badge>
                </div>
                <SheetTitle className="text-2xl font-black tracking-[-0.05em]">{activeSpec.label}</SheetTitle>
                <SheetDescription className="max-w-md text-xs font-medium leading-5">{activeSpec.hint}</SheetDescription>
              </SheetHeader>

              <div className="flex items-center gap-1.5 overflow-x-auto px-5 pb-3">
                {activeSpec.vars.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => insertVariable(item.id)}
                    className="shrink-0 rounded-full bg-[#dff1ff] px-3 py-1.5 font-mono text-[10px] font-black text-[#174f85] transition-transform active:scale-95 dark:bg-[#244d74] dark:text-[#dceeff]"
                  >
                    + {`{{${item.id}}}`}
                  </button>
                ))}
              </div>

              <div className="min-h-0 flex-1 px-4 pb-3">
                <CodeEditor
                  key={activeSpec.key}
                  ref={editorRef}
                  id={`sheet-prompt-${activeSpec.key}`}
                  label={activeSpec.label}
                  value={promptDraft}
                  language="prompt"
                  placeholder="在这里输入提示词…"
                  onChange={setPromptDraft}
                  className="h-full"
                  editorClassName="h-full min-h-[320px]"
                />
              </div>

              <SheetFooter className="grid grid-cols-[auto_auto_1fr] gap-2 px-4 pb-4 pt-0 sm:grid-cols-[auto_auto_1fr]">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!isDraftModified}
                  className="h-12 px-3 text-xs font-black"
                  onClick={() => setPromptDraft(DEFAULT_AI_SETTINGS[activeSpec.key])}
                >
                  <RotateCcw className="size-3.5" />默认
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-12 px-3 text-xs font-black"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(promptDraft)
                      setCopiedPrompt(true)
                      window.setTimeout(() => setCopiedPrompt(false), 2000)
                    } catch {
                      setCopiedPrompt(false)
                    }
                  }}
                >
                  {copiedPrompt ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  {copiedPrompt ? "已复制" : "复制"}
                </Button>
                <Button
                  type="button"
                  className="h-12 bg-black text-sm font-black text-white hover:bg-black/85 dark:bg-white dark:text-black dark:hover:bg-white/90"
                  onClick={savePromptDraft}
                >
                  <Save className="size-4" />保存提示词
                </Button>
              </SheetFooter>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  )
}
