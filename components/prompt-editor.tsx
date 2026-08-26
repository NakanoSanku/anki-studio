"use client"

import { useRef, useState } from "react"
import {
  BookOpen,
  Boxes,
  Check,
  Copy,
  Cpu,
  FileCode,
  Info,
  RotateCcw,
  Sparkles,
} from "lucide-react"

import {
  DEFAULT_AI_SETTINGS,
  PROMPT_SPECS,
  type AiSettings,
  type PromptKey,
} from "@/lib/ai-settings"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CodeEditor, type CodeEditorHandle } from "@/components/code-editor"
import { cn } from "@/lib/utils"

const PROMPT_META: Record<
  PromptKey,
  {
    icon: typeof Sparkles
    color: string
    bgColor: string
    description: string
  }
> = {
  cardCompletePrompt: {
    icon: Sparkles,
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-500/10",
    description: "在卡片编辑页面，点击「AI 补全」时只填充空字段",
  },
  batchPrompt: {
    icon: Boxes,
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-500/10",
    description: "在卡包界面根据主题或长文本，一次性批量生成多张卡片",
  },
  templateEditPrompt: {
    icon: FileCode,
    color: "text-sky-600 dark:text-sky-400",
    bgColor: "bg-sky-500/10",
    description: "在模板设计器中，使用自然语言指导 AI 修改 HTML、CSS 与字段布局",
  },
  systemPrompt: {
    icon: Cpu,
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-500/10",
    description: "全局基础系统角色设定，所有 AI 请求都会默认遵从",
  },
}

const VAR_EXPLANATIONS: Record<string, string> = {
  key: "本张卡片的核心主键字段（如英文单词、题目等）",
  fields: "当前卡包模板支持填写的全部字段名称列表",
  notes: "卡片模板中为各个字段配置的填写备注与指导提示",
  context: "当前卡片已经录入的所有已有字段内容",
  references: "从已有卡片库中抽取的参考笔记范例（指导排版与学法）",
}

export function PromptEditor({
  settings,
  onChange,
}: {
  settings: AiSettings
  onChange: (key: PromptKey, value: string) => void
}) {
  const [key, setKey] = useState<PromptKey>("cardCompletePrompt")
  const [copied, setCopied] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const editorRef = useRef<CodeEditorHandle>(null)
  const spec = PROMPT_SPECS.find((item) => item.key === key) ?? PROMPT_SPECS[0]
  const meta = PROMPT_META[spec.key]
  const currentContent = settings[spec.key] ?? ""
  const isModified = currentContent !== DEFAULT_AI_SETTINGS[spec.key]

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(currentContent)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback ignore
    }
  }

  const resetCurrent = () => {
    onChange(spec.key, DEFAULT_AI_SETTINGS[spec.key])
  }

  return (
    <section className="flex min-w-0 flex-col gap-3.5">
      {/* PWA Segmented Control Switcher */}
      <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-muted/60 p-1.5 ring-1 ring-border/50 sm:grid-cols-4">
        {PROMPT_SPECS.map((item) => {
          const itemMeta = PROMPT_META[item.key]
          const Icon = itemMeta.icon
          const active = item.key === spec.key
          const modified = settings[item.key] !== DEFAULT_AI_SETTINGS[item.key]
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setKey(item.key)}
              className={cn(
                "relative flex h-10 items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-medium transition-all",
                active
                  ? "bg-card text-foreground shadow-xs ring-1 ring-border/70 font-semibold"
                  : "text-muted-foreground hover:bg-card/40 hover:text-foreground"
              )}
            >
              <Icon className={cn("size-3.5 shrink-0", active ? itemMeta.color : "text-muted-foreground")} />
              <span className="truncate">{item.label}</span>
              {modified ? (
                <span className="size-1.5 shrink-0 rounded-full bg-primary" title="已自定义修改" />
              ) : null}
            </button>
          )
        })}
      </div>

      {/* Header Info & Actions */}
      <div className="flex flex-col gap-2 rounded-xl bg-card/60 p-3 ring-1 ring-border/60 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-foreground">{spec.label}提示词</span>
            <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-mono text-muted-foreground">
              {currentContent.length} 字
            </Badge>
            {isModified ? (
              <Badge variant="outline" className="border-primary/30 bg-primary/5 text-[10px] font-medium text-primary">
                已自定义
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
                默认
              </Badge>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{meta.description}</p>
        </div>

        <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
          <Button
            type="button"
            size="xs"
            variant="ghost"
            className="h-7 rounded-lg px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={copyPrompt}
          >
            {copied ? (
              <>
                <Check className="mr-1 size-3 text-emerald-500" />
                已复制
              </>
            ) : (
              <>
                <Copy className="mr-1 size-3" />
                复制
              </>
            )}
          </Button>
          <Button
            type="button"
            size="xs"
            variant="ghost"
            disabled={!isModified}
            onClick={resetCurrent}
            className="h-7 rounded-lg px-2 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
          >
            <RotateCcw className="mr-1 size-3" />
            恢复默认
          </Button>
        </div>
      </div>

      {/* Interactive Variable Insertion Pills */}
      {spec.vars.length > 0 ? (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground px-0.5">
            <span className="flex items-center gap-1">
              <Sparkles className="size-3 text-primary" />
              点击插入变量到光标处：
            </span>
            <button
              type="button"
              onClick={() => setShowGuide((prev) => !prev)}
              className="flex items-center gap-0.5 text-[10px] text-primary hover:underline"
            >
              <BookOpen className="size-3" />
              {showGuide ? "收起说明" : "变量说明"}
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {spec.vars.map((item) => {
              const isIncluded = currentContent.includes(`{{${item.id}}}`)
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => editorRef.current?.insert(`{{${item.id}}}`)}
                  title={VAR_EXPLANATIONS[item.id] || `点击插入 {{${item.id}}}：${item.label}`}
                  className={cn(
                    "group flex h-7.5 items-center gap-1.5 rounded-lg border px-2 text-xs transition-all active:scale-95",
                    isIncluded
                      ? "border-emerald-500/40 bg-emerald-50/60 text-foreground dark:bg-emerald-950/30"
                      : "border-border/70 bg-card text-muted-foreground hover:border-primary/50 hover:bg-primary/5 hover:text-foreground"
                  )}
                >
                  <span
                    className={cn(
                      "size-1.5 rounded-full transition-colors",
                      isIncluded ? "bg-emerald-500" : "bg-muted-foreground/40 group-hover:bg-primary"
                    )}
                  />
                  <span className="font-mono text-[11px] font-semibold text-primary">{`{{${item.id}}}`}</span>
                  <span className="text-[11px] opacity-85">{item.label}</span>
                </button>
              )
            })}
          </div>

          {showGuide ? (
            <div className="mt-2 rounded-xl border border-border/70 bg-muted/30 p-2.5 text-[11px] space-y-1.5 animate-in fade-in-0 duration-150">
              {spec.vars.map((v) => (
                <div key={v.id} className="flex items-start gap-2">
                  <span className="font-mono font-semibold text-primary shrink-0">{`{{${v.id}}}`}</span>
                  <span className="text-muted-foreground">{VAR_EXPLANATIONS[v.id] || v.label}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground flex items-center gap-1.5">
          <Info className="size-3.5 text-muted-foreground shrink-0" />
          <span>全局系统提示词无需配置插值变量，将作为 System Prompt 发送给大模型。</span>
        </div>
      )}

      {/* Editor Box */}
      <div className="min-w-0">
        <CodeEditor
          key={spec.key}
          ref={editorRef}
          id={`prompt-${spec.key}`}
          label={spec.label}
          value={settings[spec.key]}
          language="prompt"
          placeholder="在这里编写提示词，点击上方变量药丸可插入到光标处…"
          onChange={(value) => onChange(spec.key, value)}
        />
      </div>
    </section>
  )
}
