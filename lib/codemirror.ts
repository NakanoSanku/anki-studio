import { css } from "@codemirror/lang-css"
import { html } from "@codemirror/lang-html"
import { indentUnit, syntaxHighlighting } from "@codemirror/language"
import { EditorState, RangeSetBuilder } from "@codemirror/state"
import { oneDarkHighlightStyle } from "@codemirror/theme-one-dark"
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
      backgroundColor: "#17181d",
      color: "#e8e8ef",
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
      caretColor: "#c7d2fe",
      padding: "12px 0",
      lineHeight: "20px",
    },
    ".cm-line": {
      padding: "0 12px",
    },
    ".cm-gutters": {
      backgroundColor: "#111217",
      color: "rgb(199 210 254 / 38%)",
      border: "none",
      borderRight: "1px solid rgb(255 255 255 / 7%)",
    },
    ".cm-lineNumbers .cm-gutterElement": {
      minWidth: "2.4rem",
      padding: "0 8px",
    },
    ".cm-activeLine": {
      backgroundColor: "rgb(255 255 255 / 4%)",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "transparent",
      color: "rgb(224 231 255 / 72%)",
    },
    ".cm-selectionBackground, &.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground": {
      backgroundColor: "rgb(79 70 229 / 42%)",
    },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: "#c7d2fe",
    },
    ".cm-anki-field": {
      color: "#c7d2fe",
      backgroundColor: "rgb(99 102 241 / 18%)",
      borderRadius: "3px",
    },
    ".cm-tooltip": {
      backgroundColor: "#202127",
      color: "#e8e8ef",
      border: "1px solid rgb(255 255 255 / 10%)",
    },
    ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
      backgroundColor: "rgb(79 70 229 / 45%)",
      color: "#ffffff",
    },
    ".cm-placeholder": {
      color: "rgb(232 232 239 / 35%)",
    },
  },
  { dark: true }
)

const sharedExtensions = [
  EditorView.lineWrapping,
  EditorState.tabSize.of(2),
  indentUnit.of("  "),
  syntaxHighlighting(oneDarkHighlightStyle, { fallback: true }),
]

export const templateExtensions = [
  html({ matchClosingTags: true, autoCloseTags: true }),
  ankiFieldHighlighter,
  ...sharedExtensions,
]

export const cssExtensions = [css(), ...sharedExtensions]

export const promptExtensions = [ankiFieldHighlighter, ...sharedExtensions]
