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

  // Prompt Sheet editing state
  const [editingPromptKey, setEditingPromptKey] = useState<PromptKey | null>(null)
  const [promptDraft, setPromptDraft] = useState<string>("")
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
      if (!next.model || !fetched.includes(next.model)) {
        patch({ model: fetched[0] ?? next.model })
      }
      setStatus({
        type: "success",
        message: `已获取 ${fetched.length} 个可用模型`,
      })
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "拉取模型失败",
      })
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
      const latency = Date.now() - startTime
      setStatus({
        type: "success",
        message: `连接成功 (${latency}ms)`,
      })
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "连接失败，请检查网络或密钥",
      })
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

  // Open prompt editor sheet
  const openPromptEditor = (key: PromptKey) => {
    setEditingPromptKey(key)
    setPromptDraft(settings[key] ?? DEFAULT_AI_SETTINGS[key])
    setCopiedPrompt(false)
  }

  const savePromptDraft = () => {
    if (!editingPromptKey) return
    patch({ [editingPromptKey]: promptDraft })
    const nextSettings = { ...settings, [editingPromptKey]: promptDraft }
    writeAiSettings(nextSettings)
    setEditingPromptKey(null)
    setStatus({ type: "success", message: "提示词已更新" })
  }

  const insertVariable = (varName: string) => {
    const snippet = `{{${varName}}}`
    if (editorRef.current) {
      editorRef.current.insert(snippet)
    } else {
      setPromptDraft((prev) => `${prev}${snippet}`)
    }
  }

  const activeSpec: PromptSpec | undefined = PROMPT_SPECS.find((s) => s.key === editingPromptKey)
  const isDraftModified = editingPromptKey
    ? promptDraft !== DEFAULT_AI_SETTINGS[editingPromptKey]
    : false

  return (
    <div className="mx-auto w-full max-w-lg space-y-3.5 pb-10">
      {/* Card 1: API Settings */}
      <div className="overflow-hidden rounded-2xl bg-card ring-1 ring-border/70 shadow-xs">
        <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">接口设置</h2>
          <button
            type="button"
            onClick={resetAllDefaults}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <RotateCcw className="size-3" />
            <span>重置</span>
          </button>
        </div>

        <div className="divide-y divide-border/60 p-1">
          {/* Base URL */}
          <div className="space-y-1 px-3.5 py-2.5">
            <Label htmlFor="baseURL-input" className="text-xs font-medium text-muted-foreground">
              接口地址 (Base URL)
            </Label>
            <Input
              id="baseURL-input"
              value={settings.baseURL}
              placeholder="https://api.openai.com/v1"
              className="h-9 rounded-xl bg-muted/20 text-xs font-mono"
              onChange={(e) => patch({ baseURL: e.target.value })}
            />
          </div>

          {/* Model Name */}
          <div className="space-y-1 px-3.5 py-2.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="model-input" className="text-xs font-medium text-muted-foreground">
                模型 (Model)
              </Label>
              <button
                type="button"
                disabled={busy}
                onClick={() => void fetchModels()}
                className="flex items-center gap-1 text-[11px] text-primary hover:underline disabled:opacity-50"
              >
                <RefreshCw className={cn("size-2.5", busy && "animate-spin")} />
                <span>{models.length > 0 ? `已拉取 ${models.length} 个` : "拉取模型"}</span>
              </button>
            </div>

            {models.length > 0 ? (
              <Select value={settings.model} onValueChange={(val) => patch({ model: val })}>
                <SelectTrigger id="model-input" className="h-9 w-full rounded-xl bg-muted/20 text-xs font-mono">
                  <SelectValue placeholder="选择模型" />
                </SelectTrigger>
                <SelectContent position="popper" align="start" className="max-h-60 rounded-xl">
                  {!models.includes(settings.model) && settings.model ? (
                    <SelectItem value={settings.model} className="text-xs font-mono">
                      {settings.model}
                    </SelectItem>
                  ) : null}
                  {models.map((id) => (
                    <SelectItem key={id} value={id} className="text-xs font-mono">
                      {id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id="model-input"
                value={settings.model}
                placeholder="gpt-4o-mini"
                className="h-9 rounded-xl bg-muted/20 text-xs font-mono"
                onChange={(e) => patch({ model: e.target.value })}
              />
            )}
          </div>

          {/* API Key */}
          <div className="space-y-1 px-3.5 py-2.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="apiKey-input" className="text-xs font-medium text-muted-foreground">
                API Key
              </Label>
              <button
                type="button"
                onClick={pasteApiKey}
                className="text-[11px] text-primary hover:underline"
              >
                粘贴
              </button>
            </div>

            <div className="relative">
              <Input
                id="apiKey-input"
                type={showApiKey ? "text" : "password"}
                value={settings.apiKey}
                placeholder="sk-... (免密接口可留空)"
                className="h-9 rounded-xl bg-muted/20 pr-9 text-xs font-mono"
                onChange={(e) => patch({ apiKey: e.target.value })}
              />
              <button
                type="button"
                onClick={() => setShowApiKey((prev) => !prev)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showApiKey ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="border-t border-border/70 bg-muted/10 p-3">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              className="h-9 flex-1 rounded-xl text-xs font-semibold shadow-xs"
              disabled={busy}
              onClick={save}
            >
              <Save className="mr-1 size-3.5" />
              保存配置
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-9 px-4 rounded-xl text-xs font-medium"
              disabled={busy}
              onClick={() => void testConnection()}
            >
              <Zap className={cn("mr-1 size-3 text-amber-500", busy && "animate-spin")} />
              {busy ? "测试中…" : "测试连接"}
            </Button>
          </div>

          {status.message ? (
            <div
              className={cn(
                "mt-2 flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs",
                status.type === "success"
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : status.type === "error"
                    ? "bg-rose-500/10 text-rose-700 dark:text-rose-300"
                    : "bg-sky-500/10 text-sky-700 dark:text-sky-300"
              )}
            >
              {status.type === "success" ? (
                <Check className="size-3.5 shrink-0" />
              ) : status.type === "error" ? (
                <AlertCircle className="size-3.5 shrink-0" />
              ) : (
                <LoaderCircle className="size-3.5 shrink-0 animate-spin" />
              )}
              <span className="truncate">{status.message}</span>
            </div>
          ) : null}
        </div>
      </div>

      {/* Card 2: Prompts (Clean Inset Grouped Rows) */}
      <div className="overflow-hidden rounded-2xl bg-card ring-1 ring-border/70 shadow-xs">
        <div className="border-b border-border/70 px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">提示词</h2>
        </div>

        <ul className="divide-y divide-border/60">
          {PROMPT_SPECS.map((spec) => {
            const isModified = settings[spec.key] !== DEFAULT_AI_SETTINGS[spec.key]

            return (
              <li key={spec.key}>
                <button
                  type="button"
                  onClick={() => openPromptEditor(spec.key)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-muted/30 active:bg-muted/50"
                >
                  <span className="text-xs font-medium text-foreground">{spec.label}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-muted-foreground">
                      {isModified ? "已自定义" : "默认"}
                    </span>
                    <ChevronRight className="size-3.5 text-muted-foreground/60" />
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      {/* Prompt Editor Sheet with CodeMirror */}
      <Sheet open={Boolean(editingPromptKey)} onOpenChange={(open) => !open && setEditingPromptKey(null)}>
        <SheetContent
          side="bottom"
          className="h-[88dvh] max-h-[720px] rounded-t-3xl p-0 flex flex-col sm:max-w-lg sm:mx-auto border-border/80 shadow-xl"
        >
          {activeSpec ? (
            <>
              {/* Sheet Header */}
              <SheetHeader className="border-b border-border/70 px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <SheetTitle className="text-sm font-semibold">{activeSpec.label}</SheetTitle>
                    <Badge variant="secondary" className="text-[10px] font-normal font-mono">
                      {promptDraft.length} 字
                    </Badge>
                  </div>

                  <div className="flex items-center gap-1 mr-7">
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      disabled={!isDraftModified}
                      className="h-7 text-xs text-muted-foreground disabled:opacity-30"
                      onClick={() => setPromptDraft(DEFAULT_AI_SETTINGS[activeSpec.key])}
                    >
                      <RotateCcw className="mr-1 size-3" />
                      恢复默认
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      className="h-7 text-xs text-muted-foreground"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(promptDraft)
                          setCopiedPrompt(true)
                          setTimeout(() => setCopiedPrompt(false), 2000)
                        } catch {
                          // ignore
                        }
                      }}
                    >
                      {copiedPrompt ? <Check className="mr-1 size-3 text-emerald-500" /> : <Copy className="mr-1 size-3" />}
                      {copiedPrompt ? "已复制" : "复制"}
                    </Button>
                  </div>
                </div>
                <SheetDescription className="text-xs text-muted-foreground">
                  {activeSpec.hint}
                </SheetDescription>
              </SheetHeader>

              {/* Variable Pills Toolbar */}
              {activeSpec.vars.length > 0 ? (
                <div className="border-b border-border/60 bg-muted/15 px-4 py-2">
                  <div className="flex flex-wrap gap-1">
                    {activeSpec.vars.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => insertVariable(item.id)}
                        className="flex h-6.5 items-center gap-1 rounded-md border border-border/70 bg-card px-2 text-[11px] text-muted-foreground hover:border-primary/50 hover:bg-primary/5 hover:text-foreground active:scale-95 transition-all"
                      >
                        <span className="font-mono font-medium text-primary">{`+ {{${item.id}}}`}</span>
                        <span>{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* CodeMirror Canvas Body */}
              <div className="flex-1 overflow-y-auto p-4 flex flex-col min-h-0">
                <CodeEditor
                  key={activeSpec.key}
                  ref={editorRef}
                  id={`sheet-prompt-${activeSpec.key}`}
                  label={activeSpec.label}
                  value={promptDraft}
                  language="prompt"
                  placeholder="在这里输入提示词…"
                  onChange={setPromptDraft}
                  className="flex-1 rounded-2xl shadow-sm border border-border/70"
                  editorClassName="h-[280px] sm:h-[340px]"
                />
              </div>

              {/* Sheet Footer */}
              <SheetFooter className="border-t border-border/70 bg-card p-3.5">
                <Button
                  type="button"
                  className="h-9 w-full rounded-xl font-semibold shadow-xs"
                  onClick={savePromptDraft}
                >
                  <Save className="mr-1.5 size-3.5" />
                  保存
                </Button>
              </SheetFooter>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  )
}
