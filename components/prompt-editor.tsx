"use client"

import { useRef, useState } from "react"
import { BookOpen, Boxes, Check, Copy, Cpu, FileCode, Info, RotateCcw, Sparkles } from "lucide-react"

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

const PROMPT_META: Record<PromptKey, { icon: typeof Sparkles; description: string }> = {
  cardCompletePrompt: {
    icon: Sparkles,
    description: "Fill only the fields that are still empty in the current note.",
  },
  batchPrompt: {
    icon: Boxes,
    description: "Generate a consistent set of new notes from a topic, word list, or source text.",
  },
  templateEditPrompt: {
    icon: FileCode,
    description: "Use natural language to adjust template HTML, CSS, and field layout.",
  },
  systemPrompt: {
    icon: Cpu,
    description: "The shared role, tone, and generation rules inherited by every AI request.",
  },
}

const VAR_EXPLANATIONS: Record<string, string> = {
  key: "The primary key field for a card, such as the word or question.",
  fields: "All field names available in the current deck template.",
  notes: "Field notes that explain expected content and formatting.",
  context: "All existing field values in the current note.",
  references: "Selected reference notes used to guide style without copying content.",
  topic: "The topic, source text, or word list used for batch generation.",
  count: "The requested number of notes to generate.",
  existing: "Existing key values that generation must avoid duplicating.",
  instruction: "The user's natural-language template change request.",
  pane: "The currently active template pane.",
  tts: "The available text-to-speech field definitions.",
  sample: "A sample card used as context for the template.",
  front: "The current front template source.",
  back: "The current back template source.",
  css: "The current template stylesheet.",
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

  return (
    <section className="flex min-w-0 flex-col gap-4" aria-label="Prompt Lab">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="tablist" aria-label="Prompt type">
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
                "relative flex min-h-16 items-center gap-2.5 rounded-[16px] border px-3 py-3 text-left transition-[background-color,border-color,transform] active:scale-[0.99]",
                active
                  ? "border-foreground/12 bg-foreground text-background"
                  : "border-black/[0.065] bg-card hover:bg-muted/45 dark:border-white/[0.09]"
              )}
            >
              <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-[11px]", active ? "bg-background/10" : "bg-muted")}>
                <Icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold tracking-[-0.02em]">{item.label}</span>
                <span className="mt-0.5 block text-[9px] font-medium uppercase tracking-[0.12em] opacity-55">
                  {modified ? "custom" : "default"}
                </span>
              </span>
              {modified ? <span className="absolute right-2.5 top-2.5 size-2 rounded-full bg-energy" title="Customized" /> : null}
            </button>
          )
        })}
      </div>

      <div className="rounded-[20px] border border-black/[0.065] bg-card p-4 dark:border-white/[0.09] sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-[13px] bg-muted"><meta.icon className="size-5" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Prompt workspace</p>
            <h3 className="mt-1 text-2xl font-semibold tracking-[-0.04em]">{spec.label}</h3>
            <p className="mt-2 max-w-2xl text-xs leading-5 text-muted-foreground sm:text-sm">{meta.description}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge className="border border-black/[0.06] bg-muted px-2.5 py-1 font-mono text-[10px] font-medium text-foreground shadow-none dark:border-white/[0.08]">
            {currentContent.length} chars
          </Badge>
          <Badge className="border border-black/[0.06] bg-muted px-2.5 py-1 text-[10px] font-medium text-foreground shadow-none dark:border-white/[0.08]">
            {isModified ? "Customized" : "Default"}
          </Badge>
          <div className="ml-auto flex gap-1.5">
            <Button type="button" size="sm" variant="outline" className="h-9 px-3" onClick={copyPrompt}>
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied ? "Copied" : "Copy"}
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={!isModified} className="h-9 px-3" onClick={() => onChange(spec.key, DEFAULT_AI_SETTINGS[spec.key])}>
              <RotateCcw className="size-3.5" />
              Reset
            </Button>
          </div>
        </div>
      </div>

      {spec.vars.length > 0 ? (
        <div className="rounded-[18px] border border-black/[0.06] bg-card p-3.5 dark:border-white/[0.08] sm:p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="flex items-center gap-1.5 text-xs font-semibold tracking-[-0.02em]"><Sparkles className="size-3.5" />Insert variables</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">Click a variable to insert it at the current cursor.</p>
            </div>
            <Button type="button" size="sm" variant="ghost" className="h-8 px-2.5 text-[10px]" aria-expanded={showGuide} onClick={() => setShowGuide((prev) => !prev)}>
              <BookOpen className="size-3" />
              {showGuide ? "Hide guide" : "Variable guide"}
            </Button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {spec.vars.map((item) => {
              const isIncluded = currentContent.includes(`{{${item.id}}}`)
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => editorRef.current?.insert(`{{${item.id}}}`)}
                  title={VAR_EXPLANATIONS[item.id] || `Insert {{${item.id}}}: ${item.label}`}
                  className={cn(
                    "flex min-h-9 items-center gap-2 rounded-[11px] border px-2.5 py-1.5 text-xs font-medium transition-[background-color,border-color,transform] active:scale-[0.98]",
                    isIncluded
                      ? "border-energy/35 bg-energy/15"
                      : "border-black/[0.06] bg-background/55 hover:bg-muted dark:border-white/[0.08]"
                  )}
                >
                  {isIncluded ? <Check className="size-3.5 shrink-0" /> : <span className="size-1.5 shrink-0 rounded-full bg-current opacity-45" />}
                  <span className="font-mono text-[11px]">{`{{${item.id}}}`}</span>
                  <span className="text-muted-foreground">{item.label}</span>
                </button>
              )
            })}
          </div>

          {showGuide ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {spec.vars.map((item) => (
                <div key={item.id} className="rounded-[13px] border border-black/[0.055] bg-background/55 p-3 dark:border-white/[0.07]">
                  <span className="font-mono text-[11px] font-semibold">{`{{${item.id}}}`}</span>
                  <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{VAR_EXPLANATIONS[item.id] || item.label}</p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="flex items-start gap-2.5 rounded-[15px] border border-black/[0.06] bg-muted/45 px-4 py-3 dark:border-white/[0.08]">
          <Info className="mt-0.5 size-4 shrink-0" />
          <p className="text-xs leading-5 text-muted-foreground">The system prompt does not need interpolation variables. It is applied as the base System Prompt for every AI request.</p>
        </div>
      )}

      <div className="min-w-0 overflow-hidden rounded-[20px] border border-black/[0.065] bg-card p-2.5 dark:border-white/[0.09] sm:p-3">
        <div className="mb-2 flex items-center justify-between gap-3 px-1.5 pt-1">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Prompt source</p>
            <p className="mt-0.5 text-xs font-semibold">Edit prompt directly</p>
          </div>
          <span className="rounded-[8px] bg-muted px-2.5 py-1 font-mono text-[9px] font-medium text-muted-foreground">
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
          placeholder="Write the prompt here, or click a variable above to insert it at the cursor…"
          onChange={(value) => onChange(spec.key, value)}
        />
      </div>
    </section>
  )
}
