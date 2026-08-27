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
    surface: string
    iconSurface: string
    description: string
  }
> = {
  cardCompletePrompt: {
    icon: Sparkles,
    surface: "bg-[#ffe39a] text-[#654600] dark:bg-[#68551f] dark:text-[#ffedb8]",
    iconSurface: "bg-white/55 text-[#654600] dark:bg-white/10 dark:text-[#ffedb8]",
    description: "在卡片编辑页，只补齐当前笔记中仍为空白的字段。",
  },
  batchPrompt: {
    icon: Boxes,
    surface: "bg-[#d8f4aa] text-[#315f18] dark:bg-[#385528] dark:text-[#e4f8c5]",
    iconSurface: "bg-white/55 text-[#315f18] dark:bg-white/10 dark:text-[#e4f8c5]",
    description: "根据主题、词表或长文本，一次生成一组结构一致的新笔记。",
  },
  templateEditPrompt: {
    icon: FileCode,
    surface: "bg-[#cfe6ff] text-[#194f83] dark:bg-[#244d74] dark:text-[#dceeff]",
    iconSurface: "bg-white/55 text-[#194f83] dark:bg-white/10 dark:text-[#dceeff]",
    description: "让 AI 根据自然语言修改模板 HTML、CSS 与字段排版。",
  },
  systemPrompt: {
    icon: Cpu,
    surface: "bg-[#ffd8df] text-[#761c31] dark:bg-[#6a2835] dark:text-[#ffdce3]",
    iconSurface: "bg-white/55 text-[#761c31] dark:bg-white/10 dark:text-[#ffdce3]",
    description: "所有 AI 请求都会继承的基础角色、语气与生成规则。",
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
      // Clipboard access is optional; editing remains available without it.
    }
  }

  const resetCurrent = () => {
    onChange(spec.key, DEFAULT_AI_SETTINGS[spec.key])
  }

  return (
    <section className="flex min-w-0 flex-col gap-4" aria-label="Prompt Lab">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="tablist" aria-label="提示词类型">
        {PROMPT_SPECS.map((item) => {
          const itemMeta = PROMPT_META[item.key]
          const Icon = itemMeta.icon
          const active = item.key === spec.key
          const modified = settings[item.key] !== DEFAULT_AI_SETTINGS[item.key]
          return (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setKey(item.key)}
              className={cn(
                "relative flex min-h-16 touch-manipulation items-center gap-2.5 rounded-[1.35rem] px-3 py-3 text-left transition-transform [-webkit-tap-highlight-color:transparent] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-black/15 active:scale-[0.985] dark:focus-visible:ring-white/20",
                active
                  ? "bg-black text-white shadow-[0_18px_38px_-28px_rgba(0,0,0,0.9)] dark:bg-white dark:text-black"
                  : itemMeta.surface
              )}
            >
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-full",
                  active ? "bg-white/15 text-white dark:bg-black/10 dark:text-black" : itemMeta.iconSurface
                )}
              >
                <Icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-black tracking-[-0.02em]">{item.label}</span>
                <span className={cn("mt-0.5 block text-[9px] font-bold uppercase tracking-[0.12em]", active ? "opacity-55" : "opacity-55")}>
                  {modified ? "custom" : "default"}
                </span>
              </span>
              {modified ? (
                <span
                  className={cn(
                    "absolute right-2.5 top-2.5 size-2 rounded-full",
                    active ? "bg-[#ffe39a] dark:bg-[#654600]" : "bg-current opacity-65"
                  )}
                  title="已自定义修改"
                />
              ) : null}
            </button>
          )
        })}
      </div>

      <div className={cn("overflow-hidden rounded-[1.85rem] p-4 sm:p-5", meta.surface)}>
        <div className="flex items-start gap-3">
          <span className={cn("flex size-12 shrink-0 items-center justify-center rounded-full", meta.iconSurface)}>
            <meta.icon className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] opacity-55">prompt workspace</p>
            <h3 className="mt-1 text-2xl font-black tracking-[-0.05em] sm:text-3xl">{spec.label}</h3>
            <p className="mt-2 max-w-2xl text-xs font-semibold leading-5 opacity-70 sm:text-sm">{meta.description}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge className="border-0 bg-white/55 px-2.5 py-1 font-mono text-[10px] font-bold text-current shadow-none dark:bg-white/10">
            {currentContent.length} 字
          </Badge>
          <Badge className="border-0 bg-white/55 px-2.5 py-1 text-[10px] font-black text-current shadow-none dark:bg-white/10">
            {isModified ? "已自定义" : "使用默认"}
          </Badge>
          <div className="ml-auto flex gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-9 rounded-full bg-white/55 px-3 font-black text-current hover:bg-white/75 hover:text-current dark:bg-white/10 dark:hover:bg-white/15"
              onClick={copyPrompt}
            >
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied ? "已复制" : "复制"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={!isModified}
              className="h-9 rounded-full bg-white/55 px-3 font-black text-current hover:bg-white/75 hover:text-current disabled:opacity-35 dark:bg-white/10 dark:hover:bg-white/15"
              onClick={resetCurrent}
            >
              <RotateCcw className="size-3.5" />
              恢复
            </Button>
          </div>
        </div>
      </div>

      {spec.vars.length > 0 ? (
        <div className="rounded-[1.7rem] bg-white/75 p-3.5 shadow-[0_18px_42px_-36px_rgba(0,0,0,0.72)] ring-1 ring-black/[0.035] dark:bg-white/[0.055] dark:ring-white/[0.08] sm:p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="flex items-center gap-1.5 text-xs font-black tracking-[-0.02em]">
                <Sparkles className="size-3.5" />
                插入变量
              </p>
              <p className="mt-0.5 text-[10px] font-semibold text-muted-foreground">点击后会插入到当前光标位置</p>
            </div>
            <button
              type="button"
              className="touch-manipulation rounded-full bg-[#cfe6ff] px-3 py-1.5 text-[10px] font-black text-[#194f83] transition-transform active:scale-95 dark:bg-[#244d74] dark:text-[#dceeff]"
              aria-expanded={showGuide}
              onClick={() => setShowGuide((prev) => !prev)}
            >
              <span className="flex items-center gap-1">
                <BookOpen className="size-3" />
                {showGuide ? "收起说明" : "变量说明"}
              </span>
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {spec.vars.map((item, index) => {
              const isIncluded = currentContent.includes(`{{${item.id}}}`)
              const variableSurfaces = [
                "bg-[#ffe39a] text-[#654600] dark:bg-[#68551f] dark:text-[#ffedb8]",
                "bg-[#d8f4aa] text-[#315f18] dark:bg-[#385528] dark:text-[#e4f8c5]",
                "bg-[#cfe6ff] text-[#194f83] dark:bg-[#244d74] dark:text-[#dceeff]",
                "bg-[#ffd8df] text-[#761c31] dark:bg-[#6a2835] dark:text-[#ffdce3]",
                "bg-[#ffc7b8] text-[#743421] dark:bg-[#673b2c] dark:text-[#ffdcd1]",
              ] as const
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => editorRef.current?.insert(`{{${item.id}}}`)}
                  title={VAR_EXPLANATIONS[item.id] || `点击插入 {{${item.id}}}：${item.label}`}
                  className={cn(
                    "flex min-h-10 touch-manipulation items-center gap-2 rounded-full px-3 py-2 text-xs font-bold transition-transform [-webkit-tap-highlight-color:transparent] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-black/15 active:scale-95",
                    isIncluded
                      ? "bg-black text-white dark:bg-white dark:text-black"
                      : variableSurfaces[index % variableSurfaces.length]
                  )}
                >
                  {isIncluded ? <Check className="size-3.5 shrink-0" /> : <span className="size-1.5 shrink-0 rounded-full bg-current opacity-55" />}
                  <span className="font-mono text-[11px] font-black">{`{{${item.id}}}`}</span>
                  <span className="opacity-65">{item.label}</span>
                </button>
              )
            })}
          </div>

          {showGuide ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {spec.vars.map((item, index) => {
                const guideSurfaces = ["bg-[#fff3c6]", "bg-[#eaf9d2]", "bg-[#e8f3ff]", "bg-[#ffe9ee]", "bg-[#ffe9df]"] as const
                return (
                  <div
                    key={item.id}
                    className={cn(
                      "rounded-[1.15rem] p-3 text-black dark:bg-white/[0.07] dark:text-white",
                      guideSurfaces[index % guideSurfaces.length]
                    )}
                  >
                    <span className="font-mono text-[11px] font-black">{`{{${item.id}}}`}</span>
                    <p className="mt-1 text-[11px] font-semibold leading-5 opacity-65">
                      {VAR_EXPLANATIONS[item.id] || item.label}
                    </p>
                  </div>
                )
              })}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="flex items-start gap-2.5 rounded-[1.45rem] bg-[#cfe6ff] px-4 py-3 text-[#194f83] dark:bg-[#244d74] dark:text-[#dceeff]">
          <Info className="mt-0.5 size-4 shrink-0" />
          <p className="text-xs font-semibold leading-5">
            全局系统提示词无需插值变量，会作为基础 System Prompt 应用于所有 AI 请求。
          </p>
        </div>
      )}

      <div className="min-w-0 overflow-hidden rounded-[1.8rem] bg-[#ffd8df] p-2.5 dark:bg-[#6a2835] sm:p-3">
        <div className="mb-2 flex items-center justify-between gap-3 px-1.5 pt-1">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#761c31]/55 dark:text-[#ffdce3]/55">prompt source</p>
            <p className="mt-0.5 text-xs font-black text-[#761c31] dark:text-[#ffdce3]">直接编辑提示词</p>
          </div>
          <span className="rounded-full bg-white/55 px-2.5 py-1 font-mono text-[9px] font-bold text-[#761c31] dark:bg-white/10 dark:text-[#ffdce3]">
            {isModified ? "CUSTOM" : "DEFAULT"}
          </span>
        </div>
        <CodeEditor
          key={spec.key}
          ref={editorRef}
          id={`prompt-${spec.key}`}
          label={spec.label}
          value={settings[spec.key]}
          language="prompt"
          placeholder="在这里编写提示词；也可以点击上方变量直接插入到光标处…"
          onChange={(value) => onChange(spec.key, value)}
        />
      </div>
    </section>
  )
}
