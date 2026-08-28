export type AiSettings = {
  model: string
  apiKey: string
  baseURL: string
  systemPrompt: string
  cardCompletePrompt: string
  batchPrompt: string
  templateEditPrompt: string
}

export const AI_SETTINGS_KEY = "anki-studio.ai-settings.v2"
const LEGACY_SETTINGS_KEY = "anki-studio.ai-settings.v1"

const LEGACY_DEFAULT_SYSTEM_PROMPT =
  "你在帮用户制作 Anki 单词卡片。只输出要求的内容，不要解释，不要加引号或 markdown。"
const LEGACY_DEFAULT_CARD_COMPLETE_PROMPT = `只补全这张卡片里仍然为空的字段，不要修改已有字段。
字段备注：
{{notes}}
当前内容：
{{context}}
参考笔记（学写法，不要照抄词条）：
{{references}}`
const LEGACY_DEFAULT_BATCH_PROMPT = `请生成 {{count}} 张互不重复的单词卡片。
主题或词表：
{{topic}}
字段：{{fields}}
字段备注：
{{notes}}
不要使用这些已有单词：{{existing}}
每张卡片的「{{key}}」必须不同。
参考笔记（学写法，不要照抄词条）：
{{references}}`
const LEGACY_DEFAULT_TEMPLATE_EDIT_PROMPT = `按用户说明修改 Anki 卡片模板。
用户说明：
{{instruction}}

当前编辑的是：{{pane}}
可用字段（只能使用这些 {{字段名}}）：
{{fields}}
字段备注：
{{notes}}
TTS 字段（复习时播放音频，模板里只写 {{字段名}}，不要写 audio 标签）：
{{tts}}
示例卡片：
{{sample}}

当前正面模板：
{{front}}

当前背面模板：
{{back}}

当前 CSS：
{{css}}

要求：
- 使用 Anki 语法：{{字段}}、{{#字段}}…{{/字段}}、{{FrontSide}}
- 不要发明不存在的字段
- 未要求改动的部分尽量保持原样
- 输出完整的 front、back、css，不要 markdown`

export const DEFAULT_SYSTEM_PROMPT =
  "You help users create Anki vocabulary cards. Return only the requested content. Do not explain your answer, add quotation marks, or use Markdown."

export const DEFAULT_CARD_COMPLETE_PROMPT = `Fill only the fields that are still empty. Never modify fields that already contain content.
Field notes:
{{notes}}
Current card:
{{context}}
Reference notes (match their style, but do not copy their entries):
{{references}}`

export const DEFAULT_BATCH_PROMPT = `Generate {{count}} unique vocabulary cards.
Topic or word list:
{{topic}}
Fields: {{fields}}
Field notes:
{{notes}}
Do not use these existing key values: {{existing}}
Every card must have a unique value for "{{key}}".
Reference notes (match their style, but do not copy their entries):
{{references}}`

export const DEFAULT_TEMPLATE_EDIT_PROMPT = `Modify the Anki card template according to the user's instruction.
User instruction:
{{instruction}}

Current pane: {{pane}}
Available fields (use only these fields):
{{fields}}
Field notes:
{{notes}}
TTS fields (render them using normal Anki field syntax; do not add audio tags):
{{tts}}
Sample card:
{{sample}}

Current front template:
{{front}}

Current back template:
{{back}}

Current CSS:
{{css}}

Requirements:
- Use standard Anki double-brace field syntax, conditional blocks, and FrontSide where appropriate.
- Do not invent fields that are not listed above.
- Preserve parts the user did not ask to change whenever possible.
- Return complete front, back, and css values without Markdown.`

export const DEFAULT_AI_SETTINGS: AiSettings = {
  model: "gpt-4o-mini",
  apiKey: "",
  baseURL: "https://api.openai.com/v1",
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  cardCompletePrompt: DEFAULT_CARD_COMPLETE_PROMPT,
  batchPrompt: DEFAULT_BATCH_PROMPT,
  templateEditPrompt: DEFAULT_TEMPLATE_EDIT_PROMPT,
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function text(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback
}

function migrateDefault(value: unknown, legacy: string, current: string): string {
  const parsed = text(value, current)
  return parsed === legacy ? current : parsed
}

export function parseAiSettings(raw: unknown): AiSettings {
  if (!isRecord(raw)) return { ...DEFAULT_AI_SETTINGS }
  return {
    model: text(raw.model, DEFAULT_AI_SETTINGS.model),
    apiKey: text(raw.apiKey, ""),
    baseURL: text(raw.baseURL, DEFAULT_AI_SETTINGS.baseURL),
    systemPrompt: migrateDefault(raw.systemPrompt, LEGACY_DEFAULT_SYSTEM_PROMPT, DEFAULT_SYSTEM_PROMPT),
    cardCompletePrompt: migrateDefault(raw.cardCompletePrompt, LEGACY_DEFAULT_CARD_COMPLETE_PROMPT, DEFAULT_CARD_COMPLETE_PROMPT),
    batchPrompt: migrateDefault(raw.batchPrompt, LEGACY_DEFAULT_BATCH_PROMPT, DEFAULT_BATCH_PROMPT),
    templateEditPrompt: migrateDefault(raw.templateEditPrompt, LEGACY_DEFAULT_TEMPLATE_EDIT_PROMPT, DEFAULT_TEMPLATE_EDIT_PROMPT),
  }
}

export function readAiSettings(): AiSettings {
  if (typeof window === "undefined") return { ...DEFAULT_AI_SETTINGS }
  try {
    const raw = localStorage.getItem(AI_SETTINGS_KEY) ?? localStorage.getItem(LEGACY_SETTINGS_KEY)
    if (!raw) return { ...DEFAULT_AI_SETTINGS }
    return parseAiSettings(JSON.parse(raw))
  } catch {
    return { ...DEFAULT_AI_SETTINGS }
  }
}

export function writeAiSettings(settings: AiSettings) {
  localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify(settings))
}

export function validateProviderEndpoint(baseURL: string): string | null {
  if (!baseURL.trim()) return "Enter an API base URL"
  try {
    const url = new URL(baseURL.trim())
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return "The API base URL must use http or https"
    }
  } catch {
    return "The API base URL is invalid"
  }
  return null
}

export function validateAiSettings(settings: AiSettings): string | null {
  const endpointError = validateProviderEndpoint(settings.baseURL)
  if (endpointError) return endpointError
  if (!settings.model.trim()) return "Enter a model name"
  return null
}

export function extractModelIds(payload: unknown): string[] {
  const ids = new Set<string>()
  const take = (value: unknown) => {
    if (typeof value === "string" && value.trim()) ids.add(value.trim())
    if (isRecord(value) && typeof value.id === "string" && value.id.trim()) {
      ids.add(value.id.trim())
    }
  }

  if (Array.isArray(payload)) {
    payload.forEach(take)
  } else if (isRecord(payload)) {
    if (Array.isArray(payload.data)) payload.data.forEach(take)
    if (Array.isArray(payload.models)) payload.models.forEach(take)
  }

  return [...ids].sort((a, b) => a.localeCompare(b))
}

export function renderPrompt(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "")
}

const REFERENCES_PLACEHOLDER = /\{\{references\}\}/

export function applyPromptWithReferences(
  template: string,
  vars: Record<string, string>,
  references: string
): string {
  const filled = references.trim() ? references : "None"
  const rendered = renderPrompt(template, { ...vars, references: filled })
  if (REFERENCES_PLACEHOLDER.test(template) || filled === "None") return rendered
  return `${rendered}\n\nReference notes (match style, do not copy entries):\n${filled}`
}

export type PromptKey =
  | "systemPrompt"
  | "cardCompletePrompt"
  | "batchPrompt"
  | "templateEditPrompt"

export type PromptVariable = { id: string; label: string }
export type PromptSpec = { key: PromptKey; label: string; hint: string; vars: PromptVariable[] }

const CARD_VARS: PromptVariable[] = [
  { id: "key", label: "Key field" },
  { id: "fields", label: "Field list" },
  { id: "notes", label: "Field notes" },
  { id: "context", label: "Card content" },
  { id: "references", label: "Reference notes" },
]

export const PROMPT_SPECS: PromptSpec[] = [
  { key: "systemPrompt", label: "System", hint: "Shared by every AI request. No variables are inserted.", vars: [] },
  { key: "cardCompletePrompt", label: "Fill card", hint: "Used by AI Fill in the note editor. It should only fill empty fields.", vars: CARD_VARS },
  {
    key: "batchPrompt",
    label: "Batch generation",
    hint: "Used when generating multiple notes from the Notes screen.",
    vars: [
      { id: "topic", label: "Topic or word list" },
      { id: "count", label: "Count" },
      { id: "key", label: "Key field" },
      { id: "fields", label: "Field list" },
      { id: "notes", label: "Field notes" },
      { id: "existing", label: "Existing values" },
      { id: "references", label: "Reference notes" },
    ],
  },
  {
    key: "templateEditPrompt",
    label: "Template editor",
    hint: "Used by AI editing in Template Studio.",
    vars: [
      { id: "instruction", label: "Instruction" },
      { id: "pane", label: "Current pane" },
      { id: "fields", label: "Field list" },
      { id: "notes", label: "Field notes" },
      { id: "tts", label: "TTS fields" },
      { id: "sample", label: "Sample card" },
      { id: "front", label: "Front template" },
      { id: "back", label: "Back template" },
      { id: "css", label: "CSS" },
    ],
  },
]
