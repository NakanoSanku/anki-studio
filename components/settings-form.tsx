"use client"

import { useState } from "react"

import {
  DEFAULT_AI_SETTINGS,
  readAiSettings,
  validateAiSettings,
  validateProviderEndpoint,
  writeAiSettings,
  type AiSettings,
} from "@/lib/ai-settings"
import { listProviderModels, withBrowserFallback } from "@/lib/ai-upstream"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PromptEditor } from "@/components/prompt-editor"

export function SettingsForm() {
  const [settings, setSettings] = useState<AiSettings>(readAiSettings)
  const [models, setModels] = useState<string[]>([])
  const [status, setStatus] = useState("")
  const [busy, setBusy] = useState(false)

  const patch = (partial: Partial<AiSettings>) => {
    setSettings((current) => ({ ...current, ...partial }))
  }

  const trimmed = (): AiSettings => ({
    ...settings,
    model: settings.model.trim(),
    apiKey: settings.apiKey.trim(),
    baseURL: settings.baseURL.trim(),
    systemPrompt: settings.systemPrompt.trim(),
    fieldCompletePrompt: settings.fieldCompletePrompt.trim(),
    fieldRewritePrompt: settings.fieldRewritePrompt.trim(),
    cardCompletePrompt: settings.cardCompletePrompt.trim(),
    cardRewritePrompt: settings.cardRewritePrompt.trim(),
    batchPrompt: settings.batchPrompt.trim(),
    templateEditPrompt: settings.templateEditPrompt.trim(),
  })

  const save = () => {
    const next = trimmed()
    const error = validateAiSettings(next)
    if (error) {
      setStatus(error)
      return
    }
    writeAiSettings(next)
    setSettings(next)
    setStatus("已保存")
  }

  const fetchModels = async () => {
    const next = trimmed()
    const error = validateProviderEndpoint(next.baseURL)
    if (error) {
      setStatus(error)
      return
    }
    setBusy(true)
    setStatus("正在拉取模型…")
    try {
      let usedBrowser = false
      const models = await withBrowserFallback(
        async () => {
          const response = await fetch("/api/ai/models", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ settings: next }),
          })
          const data = (await response.json()) as { models?: string[]; error?: string }
          if (!response.ok || !data.models?.length) {
            throw new Error(data.error || "拉取模型失败")
          }
          return data.models
        },
        async () => {
          usedBrowser = true
          return listProviderModels(next)
        }
      )
      setModels(models)
      if (!next.model || !models.includes(next.model)) {
        patch({ model: models[0] ?? next.model })
      }
      setStatus(
        usedBrowser
          ? `已拉取 ${models.length} 个模型（浏览器直连，Vercel 被 Cloudflare 拦截）`
          : `已拉取 ${models.length} 个模型`
      )
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "拉取模型失败")
    } finally {
      setBusy(false)
    }
  }

  const test = async () => {
    const next = trimmed()
    const error = validateAiSettings(next)
    if (error) {
      setStatus(error)
      return
    }
    setBusy(true)
    setStatus("正在测试…")
    try {
      let usedBrowser = false
      await withBrowserFallback(
        async () => {
          const response = await fetch("/api/ai/test", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ settings: next }),
          })
          const data = (await response.json()) as { ok?: boolean; error?: string }
          if (!response.ok || !data.ok) {
            throw new Error(data.error || "测试失败")
          }
        },
        async () => {
          usedBrowser = true
          await (await import("@/lib/ai-run")).runTestAi(next)
        }
      )
      setStatus(usedBrowser ? "连接成功（浏览器直连）" : "连接成功")
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "测试失败")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-w-0 gap-8 lg:grid-cols-[minmax(240px,300px)_minmax(0,1fr)]">
      <div className="space-y-5">
        <p className="text-xs leading-5 text-foreground/50">
          填写 OpenAI 兼容接口，例如 OpenAI、DeepSeek、Groq、Ollama、LM Studio。
        </p>

        <section className="space-y-2">
          <Label htmlFor="baseURL">接口地址</Label>
          <Input
            id="baseURL"
            value={settings.baseURL}
            placeholder="https://api.openai.com/v1"
            onChange={(event) => patch({ baseURL: event.target.value })}
          />
        </section>

        <section className="space-y-2">
          <Label htmlFor="model">模型</Label>
          <div className="flex gap-2">
            {models.length > 0 ? (
              <select
                id="model"
                value={settings.model}
                aria-label="模型"
                className="h-8 min-w-0 flex-1 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                onChange={(event) => patch({ model: event.target.value })}
              >
                {!models.includes(settings.model) && settings.model ? (
                  <option value={settings.model}>{settings.model}</option>
                ) : null}
                {models.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                id="model"
                className="flex-1"
                value={settings.model}
                placeholder="gpt-4o-mini"
                onChange={(event) => patch({ model: event.target.value })}
              />
            )}
            <Button type="button" variant="outline" disabled={busy} onClick={() => void fetchModels()}>
              拉取
            </Button>
          </div>
        </section>

        <section className="space-y-2">
          <Label htmlFor="apiKey">API Key</Label>
          <Input
            id="apiKey"
            type="password"
            value={settings.apiKey}
            placeholder="本地模型可留空"
            onChange={(event) => patch({ apiKey: event.target.value })}
          />
        </section>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={save} disabled={busy}>
            保存
          </Button>
          <Button type="button" variant="outline" onClick={() => void test()} disabled={busy}>
            测试连接
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={() => {
              setSettings({ ...DEFAULT_AI_SETTINGS })
              setStatus("已恢复全部默认，记得保存")
            }}
          >
            全部恢复
          </Button>
        </div>
        {status ? <p className="text-sm text-foreground/60">{status}</p> : null}
      </div>

      <PromptEditor settings={settings} onChange={(key, value) => patch({ [key]: value })} />
    </div>
  )
}
