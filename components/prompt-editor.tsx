"use client"

import { useRef, useState } from "react"

import {
  DEFAULT_AI_SETTINGS,
  PROMPT_SPECS,
  type AiSettings,
  type PromptKey,
} from "@/lib/ai-settings"
import { Button } from "@/components/ui/button"
import { CodeEditor, type CodeEditorHandle } from "@/components/code-editor"

export function PromptEditor({
  settings,
  onChange,
}: {
  settings: AiSettings
  onChange: (key: PromptKey, value: string) => void
}) {
  const [key, setKey] = useState<PromptKey>("cardCompletePrompt")
  const editorRef = useRef<CodeEditorHandle>(null)
  const spec = PROMPT_SPECS.find((item) => item.key === key) ?? PROMPT_SPECS[0]
  const changed = settings[spec.key] !== DEFAULT_AI_SETTINGS[spec.key]

  return (
    <section className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">提示词</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{spec.hint}</p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={!changed}
          onClick={() => onChange(spec.key, DEFAULT_AI_SETTINGS[spec.key])}
        >
          恢复此条
        </Button>
      </div>

      <div className="flex flex-wrap gap-1">
        {PROMPT_SPECS.map((item) => (
          <Button
            key={item.key}
            type="button"
            size="sm"
            variant={item.key === spec.key ? "default" : "outline"}
            onClick={() => setKey(item.key)}
          >
            {item.label}
          </Button>
        ))}
      </div>

      {spec.vars.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1">
          {spec.vars.map((item) => (
            <Button
              key={item.id}
              type="button"
              size="xs"
              variant="ghost"
              className="font-mono"
              title={item.label}
              onClick={() => editorRef.current?.insert(`{{${item.id}}}`)}
            >
              {`{{${item.id}}}`}
            </Button>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">系统提示词不使用变量。</p>
      )}

      <CodeEditor
        key={spec.key}
        ref={editorRef}
        id={`prompt-${spec.key}`}
        label={spec.label}
        value={settings[spec.key]}
        language="prompt"
        placeholder="在这里写提示词，点上方变量插入到光标处"
        onChange={(value) => onChange(spec.key, value)}
      />
    </section>
  )
}
