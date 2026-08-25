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

export const DEFAULT_SYSTEM_PROMPT =
  "你在帮用户制作 Anki 单词卡片。只输出要求的内容，不要解释，不要加引号或 markdown。"

export const DEFAULT_CARD_COMPLETE_PROMPT = `只补全这张卡片里仍然为空的字段，不要修改已有字段。
字段备注：
{{notes}}
当前内容：
{{context}}
参考笔记（学写法，不要照抄词条）：
{{references}}`

export const DEFAULT_BATCH_PROMPT = `请生成 {{count}} 张互不重复的单词卡片。
主题或词表：
{{topic}}
字段：{{fields}}
字段备注：
{{notes}}
不要使用这些已有单词：{{existing}}
每张卡片的「{{key}}」必须不同。
参考笔记（学写法，不要照抄词条）：
{{references}}`

export const DEFAULT_TEMPLATE_EDIT_PROMPT = `按用户说明修改 Anki 卡片模板。
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

export function parseAiSettings(raw: unknown): AiSettings {
  if (!isRecord(raw)) return { ...DEFAULT_AI_SETTINGS }
  return {
    model: text(raw.model, DEFAULT_AI_SETTINGS.model),
    apiKey: text(raw.apiKey, ""),
    baseURL: text(raw.baseURL, DEFAULT_AI_SETTINGS.baseURL),
    systemPrompt: text(raw.systemPrompt, DEFAULT_SYSTEM_PROMPT),
    cardCompletePrompt: text(raw.cardCompletePrompt, DEFAULT_CARD_COMPLETE_PROMPT),
    batchPrompt: text(raw.batchPrompt, DEFAULT_BATCH_PROMPT),
    templateEditPrompt: text(raw.templateEditPrompt, DEFAULT_TEMPLATE_EDIT_PROMPT),
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
  if (!baseURL.trim()) return "请填写接口地址"
  try {
    const url = new URL(baseURL.trim())
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return "接口地址必须是 http 或 https"
    }
  } catch {
    return "接口地址格式无效"
  }
  return null
}

export function validateAiSettings(settings: AiSettings): string | null {
  const endpointError = validateProviderEndpoint(settings.baseURL)
  if (endpointError) return endpointError
  if (!settings.model.trim()) return "请填写模型名称"
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
  const filled = references.trim() ? references : "（无）"
  const rendered = renderPrompt(template, { ...vars, references: filled })
  if (REFERENCES_PLACEHOLDER.test(template) || filled === "（无）") return rendered
  return `${rendered}\n\n参考笔记（学写法，不要照抄词条）：\n${filled}`
}

export type PromptKey =
  | "systemPrompt"
  | "cardCompletePrompt"
  | "batchPrompt"
  | "templateEditPrompt"

export type PromptVariable = {
  id: string
  label: string
}

export type PromptSpec = {
  key: PromptKey
  label: string
  hint: string
  vars: PromptVariable[]
}

const CARD_VARS: PromptVariable[] = [
  { id: "key", label: "关键字段" },
  { id: "fields", label: "字段列表" },
  { id: "notes", label: "全部备注" },
  { id: "context", label: "整卡内容" },
  { id: "references", label: "参考笔记" },
]

export const PROMPT_SPECS: PromptSpec[] = [
  {
    key: "systemPrompt",
    label: "系统",
    hint: "所有 AI 请求共用，不插入变量。",
    vars: [],
  },
  {
    key: "cardCompletePrompt",
    label: "整卡补全",
    hint: "卡片编辑页唯一的 AI 编辑操作，只填写空字段。",
    vars: CARD_VARS,
  },
  {
    key: "batchPrompt",
    label: "批量生成",
    hint: "卡片页一次生成多张。",
    vars: [
      { id: "topic", label: "主题或词表" },
      { id: "count", label: "生成数量" },
      { id: "key", label: "关键字段" },
      { id: "fields", label: "字段列表" },
      { id: "notes", label: "全部备注" },
      { id: "existing", label: "已有单词" },
      { id: "references", label: "参考笔记" },
    ],
  },
  {
    key: "templateEditPrompt",
    label: "模板编辑",
    hint: "模板页的 AI 编辑。",
    vars: [
      { id: "instruction", label: "修改说明" },
      { id: "pane", label: "当前面板" },
      { id: "fields", label: "字段列表" },
      { id: "notes", label: "全部备注" },
      { id: "tts", label: "TTS 字段" },
      { id: "sample", label: "示例卡片" },
      { id: "front", label: "正面模板" },
      { id: "back", label: "背面模板" },
      { id: "css", label: "样式 CSS" },
    ],
  },
]
