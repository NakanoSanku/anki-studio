"use client"

import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from "react"
import CodeMirror, { type ReactCodeMirrorRef } from "@uiw/react-codemirror"
import type { ViewUpdate } from "@codemirror/view"

import { cssExtensions, paperEditorTheme, promptExtensions, templateExtensions } from "@/lib/codemirror"

export type CodeEditorHandle = {
  insert: (snippet: string) => void
  wrap: (before: string, after: string) => void
  focus: () => void
}

type CodeEditorProps = {
  id: string
  label: string
  value: string
  language: "template" | "css" | "prompt"
  placeholder?: string
  onChange: (value: string) => void
}

const basicSetup = {
  lineNumbers: true,
  foldGutter: false,
  highlightActiveLine: true,
  highlightActiveLineGutter: true,
  bracketMatching: true,
  closeBrackets: true,
  autocompletion: true,
  indentOnInput: true,
  tabSize: 2,
} as const

export const CodeEditor = forwardRef<CodeEditorHandle, CodeEditorProps>(
  function CodeEditor({ id, label, value, language, placeholder, onChange }, ref) {
    const editorRef = useRef<ReactCodeMirrorRef>(null)
    const [caret, setCaret] = useState({ line: 1, column: 1 })

    const getView = () => editorRef.current?.view

    useImperativeHandle(ref, () => ({
      insert(snippet: string) {
        const view = getView()
        if (!view) {
          onChange(`${value}${snippet}`)
          return
        }
        const { from, to } = view.state.selection.main
        view.dispatch({
          changes: { from, to, insert: snippet },
          selection: { anchor: from + snippet.length },
        })
        view.focus()
      },
      wrap(before: string, after: string) {
        const view = getView()
        if (!view) {
          onChange(`${before}${value}${after}`)
          return
        }
        const { from, to } = view.state.selection.main
        const selected = view.state.sliceDoc(from, to)
        const insert = `${before}${selected}${after}`
        view.dispatch({
          changes: { from, to, insert },
          selection: {
            anchor: from + before.length,
            head: from + before.length + selected.length,
          },
        })
        view.focus()
      },
      focus() {
        getView()?.focus()
      },
    }))

    const onUpdate = useCallback((update: ViewUpdate) => {
      if (!update.selectionSet && !update.docChanged) return
      const pos = update.state.selection.main.head
      const line = update.state.doc.lineAt(pos)
      const next = { line: line.number, column: pos - line.from + 1 }
      setCaret((prev) =>
        prev.line === next.line && prev.column === next.column ? prev : next
      )
    }, [])

    return (
      <div
        role="group"
        aria-label={label}
        className="min-w-0 overflow-hidden rounded-2xl bg-[#fbfaf6] ring-1 ring-black/8"
      >
        <div className="h-[280px] min-w-0 lg:h-[420px]">
          <CodeMirror
            ref={editorRef}
            id={id}
            value={value}
            width="100%"
            height="100%"
            theme={paperEditorTheme}
            indentWithTab
            placeholder={
              placeholder ?? (language === "css" ? ".card { }" : language === "prompt" ? "在这里写提示词" : "{{Word}}")
            }
            extensions={
              language === "css" ? cssExtensions : language === "prompt" ? promptExtensions : templateExtensions
            }
            basicSetup={basicSetup}
            onChange={onChange}
            onUpdate={onUpdate}
            className="h-full max-w-full [&_.cm-editor]:h-full [&_.cm-editor]:max-w-full"
          />
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-black/6 px-3 py-1.5 font-mono text-[11px] text-foreground/45">
          <span>
            Ln {caret.line}, Col {caret.column}
          </span>
          <span className="hidden sm:inline">Tab 缩进 · Shift+Tab 取消缩进</span>
        </div>
      </div>
    )
  }
)
