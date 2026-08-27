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
    <div className="mx-auto w-full max-w-xl space-y-5 pb-12">
      <section className="px-1 pb-1 pt-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <span className="size-2 rounded-full bg-energy" />
            AI workspace
          </div>
          <Button type="button" size="sm" variant="ghost" className="h-8 px-2.5 text-xs text-muted-foreground" onClick={resetAllDefaults}>
            <RotateCcw className="size-3.5" />
            默认配置
          </Button>
        </div>
        <h2 className="mt-3 text-[30px] font-semibold leading-[1.03] tracking-[-0.045em] sm:text-[34px]">把 AI 变成安静的助手</h2>
        <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
          连接兼容 OpenAI 的接口，用于补全、批量生成和模板编辑。配置集中在这里，其余时候尽量不打扰。
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] font-medium">
          <span className="rounded-full border border-black/[0.07] bg-card px-3 py-1.5 font-mono dark:border-white/[0.09]">
            {settings.model.trim() || "未选择模型"}
          </span>
          <span className="rounded-full bg-muted px-3 py-1.5 text-muted-foreground">{customPromptCount} 个自定义提示词</span>
        </div>
      </section>

      <section className="rounded-[22px] border border-black/[0.065] bg-card p-4 shadow-[0_18px_46px_-42px_rgba(0,0,0,0.45)] dark:border-white/[0.09] sm:p-5">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.17em] text-muted-foreground">Provider</p>
            <h3 className="mt-1 text-xl font-semibold tracking-[-0.035em]">模型连接</h3>
          </div>
          <Button type="button" size="sm" variant="outline" className="h-9 px-3 text-xs" disabled={busy} onClick={() => void testConnection()}>
            <Zap className={cn("size-3.5", busy && "animate-pulse")} />
            {busy ? "测试中" : "测试连接"}
          </Button>
        </div>

        <div className="overflow-hidden rounded-[18px] border border-black/[0.06] dark:border-white/[0.08]">
          <div className="p-3.5">
            <Label htmlFor="baseURL-input" className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Base URL</Label>
            <Input
              id="baseURL-input"
              value={settings.baseURL}
              placeholder="https://api.openai.com/v1"
              className="mt-2 h-11 bg-background font-mono text-xs"
              onChange={(event) => patch({ baseURL: event.target.value })}
            />
          </div>

          <div className="border-t border-black/[0.055] p-3.5 dark:border-white/[0.07]">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="model-input" className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Model</Label>
              <button
                type="button"
                disabled={busy}
                onClick={() => void fetchModels()}
                className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-35"
              >
                <RefreshCw className={cn("size-3", busy && "animate-spin")} />
                {models.length > 0 ? `${models.length} models` : "拉取模型"}
              </button>
            </div>
            {models.length > 0 ? (
              <Select value={settings.model} onValueChange={(model) => patch({ model })}>
                <SelectTrigger id="model-input" className="mt-2 h-11 w-full bg-background font-mono text-xs">
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
                className="mt-2 h-11 bg-background font-mono text-xs"
                onChange={(event) => patch({ model: event.target.value })}
              />
            )}
          </div>

          <div className="border-t border-black/[0.055] p-3.5 dark:border-white/[0.07]">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="apiKey-input" className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">API Key</Label>
              <button type="button" onClick={() => void pasteApiKey()} className="text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground">
                从剪贴板粘贴
              </button>
            </div>
            <div className="relative mt-2">
              <Input
                id="apiKey-input"
                type={showApiKey ? "text" : "password"}
                value={settings.apiKey}
                placeholder="sk-... · 免密接口可留空"
                className="h-11 bg-background pr-11 font-mono text-xs"
                onChange={(event) => patch({ apiKey: event.target.value })}
              />
              <button
                type="button"
                aria-label={showApiKey ? "隐藏 API Key" : "显示 API Key"}
                onClick={() => setShowApiKey((visible) => !visible)}
                className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {showApiKey ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              </button>
            </div>
          </div>
        </div>

        {status.message ? (
          <div
            className={cn(
              "mt-3 flex items-start gap-2 rounded-[14px] border px-3.5 py-3 text-xs font-medium",
              status.type === "success"
                ? "border-energy/30 bg-energy/12 text-foreground"
                : status.type === "error"
                  ? "border-destructive/20 bg-destructive/8 text-destructive"
                  : "border-black/[0.06] bg-muted/55 text-muted-foreground dark:border-white/[0.08]"
            )}
            role="status"
          >
            {status.type === "success" ? <Check className="mt-0.5 size-4 shrink-0" /> : status.type === "error" ? <AlertCircle className="mt-0.5 size-4 shrink-0" /> : <LoaderCircle className={cn("mt-0.5 size-4 shrink-0", status.type === "info" && busy && "animate-spin")} />}
            <span className="leading-5">{status.message}</span>
          </div>
        ) : null}

        <Button type="button" className="mt-3 h-[50px] w-full rounded-[15px] text-sm" disabled={busy} onClick={save}>
          <Save className="size-4" />
          保存 AI 配置
        </Button>
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between px-1">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.17em] text-muted-foreground">Prompts</p>
            <h3 className="mt-1 text-xl font-semibold tracking-[-0.035em]">提示词</h3>
          </div>
          <span className="text-[10px] font-medium text-muted-foreground">点击编辑</span>
        </div>

        <div className="overflow-hidden rounded-[22px] border border-black/[0.065] bg-card dark:border-white/[0.09]">
          {PROMPT_SPECS.map((spec, index) => {
            const modified = settings[spec.key] !== DEFAULT_AI_SETTINGS[spec.key]
            return (
              <button
                key={spec.key}
                type="button"
                onClick={() => openPromptEditor(spec.key)}
                className={cn(
                  "group flex min-h-[72px] w-full items-center gap-3.5 px-4 py-3 text-left transition-colors hover:bg-muted/55 active:bg-muted/75",
                  index > 0 && "border-t border-black/[0.055] dark:border-white/[0.07]"
                )}
              >
                <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-[13px]", modified ? "bg-energy text-black" : "bg-muted text-foreground")}>
                  {index % 2 === 0 ? <WandSparkles className="size-4" /> : <Sparkles className="size-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold tracking-[-0.02em]">{spec.label}</span>
                  <span className="mt-1 block truncate text-[11px] text-muted-foreground">{modified ? "已自定义" : "使用默认提示词"}</span>
                </span>
                {modified ? <span className="size-2 shrink-0 rounded-full bg-energy" aria-label="已自定义" /> : null}
                <ChevronRight className="size-4 shrink-0 text-foreground/22 transition-transform duration-150 group-active:translate-x-0.5" />
              </button>
            )
          })}
        </div>
      </section>

      <Sheet open={Boolean(editingPromptKey)} onOpenChange={(open) => !open && setEditingPromptKey(null)}>
        <SheetContent side="bottom" className="mx-auto flex h-[92dvh] max-h-[820px] flex-col p-0 sm:max-w-xl">
          {activeSpec ? (
            <>
              <SheetHeader className="px-5 pb-3 pt-5">
                <div className="mb-2 flex items-center gap-2 pr-8">
                  <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    <span className="size-2 rounded-full bg-energy" />
                    Prompt lab
                  </span>
                  <Badge className="border border-black/[0.07] bg-muted px-2.5 py-1 font-mono text-[9px] font-medium text-muted-foreground shadow-none dark:border-white/[0.09]">{promptDraft.length} 字</Badge>
                </div>
                <SheetTitle className="text-2xl font-semibold tracking-[-0.045em]">{activeSpec.label}</SheetTitle>
                <SheetDescription className="max-w-md text-xs leading-5">{activeSpec.hint}</SheetDescription>
              </SheetHeader>

              <div className="flex items-center gap-1.5 overflow-x-auto px-5 pb-3">
                {activeSpec.vars.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => insertVariable(item.id)}
                    className="shrink-0 rounded-[10px] border border-black/[0.07] bg-card px-2.5 py-1.5 font-mono text-[10px] font-medium text-muted-foreground transition-[background-color,color,transform] hover:bg-muted hover:text-foreground active:scale-[0.98] dark:border-white/[0.09]"
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
                <Button type="button" size="sm" variant="outline" disabled={!isDraftModified} className="h-12 px-3 text-xs" onClick={() => setPromptDraft(DEFAULT_AI_SETTINGS[activeSpec.key])}>
                  <RotateCcw className="size-3.5" />
                  默认
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-12 px-3 text-xs"
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
                <Button type="button" className="h-12 text-sm" onClick={savePromptDraft}>
                  <Save className="size-4" />
                  保存提示词
                </Button>
              </SheetFooter>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  )
}
