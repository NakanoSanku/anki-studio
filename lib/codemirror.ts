import { css } from "@codemirror/lang-css"
import { html } from "@codemirror/lang-html"
import { indentUnit, syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language"
import { EditorState, RangeSetBuilder } from "@codemirror/state"
import { Decoration, EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view"

const fieldMark = Decoration.mark({ class: "cm-anki-field" })
const FIELD_RE = /\{\{[#^/]?[^}]+\}\}/g

const ankiFieldHighlighter = ViewPlugin.fromClass(
  class {
    decorations

    constructor(view: EditorView) {
      this.decorations = highlightFields(view)
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = highlightFields(update.view)
      }
    }
  },
  {
    decorations: (value) => value.decorations,
  }
)

function highlightFields(view: EditorView) {
  const builder = new RangeSetBuilder<Decoration>()
  for (const { from, to } of view.visibleRanges) {
    const text = view.state.sliceDoc(from, to)
    FIELD_RE.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = FIELD_RE.exec(text))) {
      builder.add(from + match.index, from + match.index + match[0].length, fieldMark)
    }
  }
  return builder.finish()
}

export const paperEditorTheme = EditorView.theme(
  {
    "&": {
      backgroundColor: "#fbfaf6",
      color: "#2a261f",
      fontSize: "12.5px",
      maxWidth: "100%",
    },
    ".cm-scroller": {
      overflow: "auto",
    },
    "&.cm-focused": {
      outline: "none",
    },
    ".cm-content": {
      fontFamily: "var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, monospace",
      caretColor: "#2a261f",
      padding: "12px 0",
      lineHeight: "20px",
    },
    ".cm-line": {
      padding: "0 12px",
    },
    ".cm-gutters": {
      backgroundColor: "#f3f0e8",
      color: "rgb(42 38 31 / 38%)",
      border: "none",
      borderRight: "1px solid rgb(0 0 0 / 6%)",
    },
    ".cm-lineNumbers .cm-gutterElement": {
      minWidth: "2.4rem",
      padding: "0 8px",
    },
    ".cm-activeLine": {
      backgroundColor: "rgb(0 0 0 / 3.5%)",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "transparent",
      color: "rgb(42 38 31 / 62%)",
    },
    ".cm-selectionBackground, &.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground": {
      backgroundColor: "rgb(251 191 36 / 35%)",
    },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: "#2a261f",
    },
    ".cm-anki-field": {
      color: "#1d4e89",
      backgroundColor: "rgb(29 78 137 / 8%)",
      borderRadius: "3px",
    },
  },
  { dark: false }
)

const sharedExtensions = [
  EditorView.lineWrapping,
  EditorState.tabSize.of(2),
  indentUnit.of("  "),
  syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
]

export const templateExtensions = [
  html({ matchClosingTags: true, autoCloseTags: true }),
  ankiFieldHighlighter,
  ...sharedExtensions,
]

export const cssExtensions = [css(), ...sharedExtensions]

export const promptExtensions = [ankiFieldHighlighter, ...sharedExtensions]
