"use client"

import { useEffect, useState, type ReactNode } from "react"
import { BrainCircuit, FolderCog, Gauge, RefreshCw, Save, Server, Table2 } from "lucide-react"

import {
  DEFAULT_AI_SETTINGS,
  readAiSettings,
  validateAiSettings,
  validateProviderEndpoint,
  writeAiSettings,
  type AiSettings,
} from "@/lib/ai-settings"
import { listProviderModels, withBrowserCorsHint } from "@/lib/ai-upstream"
import { fsrsOf, type Deck } from "@/lib/deck"
import { updateFsrsSettings } from "@/lib/fsrs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PromptEditor } from "@/components/prompt-editor"
import { GoogleAccountPanel } from "@/components/google-account-panel"

export type SyncPanelState = {
  syncing: boolean
  message: string
  lastSyncAt?: number
  dirtyCount: number
  unavailable?: string
}

const SETTINGS_SECTIONS = [
  { value: "deck", shortLabel: "卡包", label: "卡包与 Anki", hint: "管理、导入与导出", icon: FolderCog },
  { value: "study", shortLabel: "学习", label: "学习计划", hint: "FSRS 与每日负担", icon: Gauge },
  { value: "ai", shortLabel: "AI", label: "AI 与提示词", hint: "接口、模型与生成规则", icon: BrainCircuit },
  { value: "sync", shortLabel: "同步", label: "Google Sheets", hint: "状态与手动同步", icon: Table2 },
] as const

function useDesktopSettingsLayout() {
  const [desktop, setDesktop] = useState(false)

  useEffect(() => {
    const query = window.matchMedia("(min-width: 64rem)")
    const update = () => setDesktop(query.matches)
    update()
    query.addEventListener("change", update)
    return () => query.removeEventListener("change", update)
  }, [])

  return desktop
}

export function SettingsForm({
  deckTools,
  deck,
  onDeckChange,
  sync,
  onSyncNow,
}: {
  deckTools?: ReactNode
  deck?: Deck
  onDeckChange?: (deck: Deck) => void
  sync?: SyncPanelState
  onSyncNow?: () => void
}) {
  const [settings, setSettings] = useState<AiSettings>(readAiSettings)
  const [models, setModels] = useState<string[]>([])
  const [status, setStatus] = useState("")
  const [busy, setBusy] = useState(false)
  const [googleAuthenticated, setGoogleAuthenticated] = useState<boolean | undefined>()
  const desktopLayout = useDesktopSettingsLayout()
  const fsrsSettings = deck ? fsrsOf(deck) : null

  const patch = (partial: Partial<AiSettings>) => {
    setSettings((current) => ({ ...current, ...partial }))
  }

  const trimmed = (): AiSettings => ({
    ...settings,
    model: settings.model.trim(),
    apiKey: settings.apiKey.trim(),
    baseURL: settings.baseURL.trim(),
    systemPrompt: settings.systemPrompt.trim(),
    cardCompletePrompt: settings.cardCompletePrompt.trim(),
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
      const models = await withBrowserCorsHint(() => listProviderModels(next))
      setModels(models)
      if (!next.model || !models.includes(next.model)) {
        patch({ model: models[0] ?? next.model })
      }
      setStatus(`已拉取 ${models.length} 个模型`)
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
      await withBrowserCorsHint(async () => {
        await (await import("@/lib/ai-run")).runTestAi(next)
      })
      setStatus("连接成功")
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "测试失败")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Tabs
      defaultValue={deckTools ? "deck" : fsrsSettings ? "study" : "ai"}
      orientation={desktopLayout ? "vertical" : "horizontal"}
      className="min-w-0 gap-4 lg:grid lg:grid-cols-[14rem_minmax(0,1fr)] lg:items-start lg:gap-6"
    >
      <div className="sticky top-14 z-20 -mx-4 border-b border-border/70 bg-background/95 px-4 py-2 backdrop-blur-xl sm:top-16 sm:-mx-6 sm:px-6 lg:top-24 lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
        <TabsList className="grid h-11 w-full grid-cols-4 p-1 shadow-sm group-data-horizontal/tabs:h-11 lg:h-auto lg:grid-cols-1 lg:gap-1 lg:rounded-xl lg:bg-card lg:p-2 lg:ring-1 lg:ring-foreground/10 lg:shadow-none">
          {SETTINGS_SECTIONS.map((section) => {
            const Icon = section.icon
            return (
              <TabsTrigger
                key={section.value}
                value={section.value}
                className="h-9 min-w-0 px-1 text-xs text-foreground/75 dark:text-foreground/75 lg:h-auto lg:justify-start lg:gap-3 lg:px-3 lg:py-3 lg:text-sm"
              >
                <Icon className="size-4" />
                <span className="min-w-0 text-left">
                  <span className="lg:hidden">{section.shortLabel}</span>
                  <span className="hidden truncate lg:block">{section.label}</span>
                  <span className="mt-0.5 hidden truncate text-[11px] font-normal text-muted-foreground lg:block">
                    {section.hint}
                  </span>
                </span>
              </TabsTrigger>
            )
          })}
        </TabsList>
      </div>

      <div className="min-w-0">
        <TabsContent value="deck" className="mt-0 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200">
          {deckTools ?? (
            <Card className="shadow-none">
              <CardContent className="py-8 text-center text-sm text-muted-foreground">当前没有可管理的卡包。</CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="study" className="mt-0 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200">
          {fsrsSettings && deck && onDeckChange ? (
            <Card className="max-w-3xl border-border/70 bg-card shadow-none">
              <CardHeader className="pb-4">
                <div className="flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Gauge className="size-4" />
                  </span>
                  <div>
                    <CardTitle>FSRS 学习计划</CardTitle>
                    <CardDescription className="mt-1 leading-5">
                      调整记忆保留率和每日负担。更改会自动保存到当前卡包。
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="fsrs-retention">目标保留率</Label>
                    <Badge variant="secondary" className="font-mono">{Math.round(fsrsSettings.requestRetention * 100)}%</Badge>
                  </div>
                  <Input
                    id="fsrs-retention"
                    type="number"
                    min="0.7"
                    max="0.99"
                    step="0.01"
                    value={fsrsSettings.requestRetention}
                    onChange={(event) => onDeckChange(updateFsrsSettings(deck, { requestRetention: Math.min(0.99, Math.max(0.7, Number(event.target.value) || 0.9)) }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="daily-new">每日新卡</Label>
                  <Input
                    id="daily-new"
                    type="number"
                    min="0"
                    max="999"
                    value={fsrsSettings.dailyNewLimit}
                    onChange={(event) => onDeckChange(updateFsrsSettings(deck, { dailyNewLimit: Math.max(0, Number(event.target.value) || 0) }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="daily-review">每日复习</Label>
                  <Input
                    id="daily-review"
                    type="number"
                    min="0"
                    max="9999"
                    value={fsrsSettings.dailyReviewLimit}
                    onChange={(event) => onDeckChange(updateFsrsSettings(deck, { dailyReviewLimit: Math.max(0, Number(event.target.value) || 0) }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maximum-interval">最长间隔（天）</Label>
                  <Input
                    id="maximum-interval"
                    type="number"
                    min="1"
                    max="36500"
                    value={fsrsSettings.maximumInterval}
                    onChange={(event) => onDeckChange(updateFsrsSettings(deck, { maximumInterval: Math.max(1, Number(event.target.value) || 1) }))}
                  />
                </div>
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>

        <TabsContent value="ai" className="mt-0 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200">
          <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(19rem,0.72fr)_minmax(0,1.28fr)]">
            <Card className="border-border/70 bg-card shadow-none">
              <CardHeader className="pb-4">
                <div className="flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Server className="size-4" />
                  </span>
                  <div>
                    <CardTitle>OpenAI 兼容接口</CardTitle>
                    <CardDescription className="mt-1 leading-5">
                      API Key 只保存在当前设备；浏览器直连需要接口允许 CORS。
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="baseURL">接口地址</Label>
                  <Input id="baseURL" value={settings.baseURL} placeholder="https://api.openai.com/v1" onChange={(event) => patch({ baseURL: event.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="model">模型</Label>
                  <div className="flex gap-2">
                    {models.length > 0 ? (
                      <Select value={settings.model} onValueChange={(value) => patch({ model: value })}>
                        <SelectTrigger id="model" className="h-9 min-w-0 flex-1">
                          <SelectValue placeholder="选择模型" />
                        </SelectTrigger>
                        <SelectContent position="popper" align="start">
                          {!models.includes(settings.model) && settings.model ? <SelectItem value={settings.model}>{settings.model}</SelectItem> : null}
                          {models.map((id) => <SelectItem key={id} value={id}>{id}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input id="model" className="flex-1" value={settings.model} placeholder="gpt-4o-mini" onChange={(event) => patch({ model: event.target.value })} />
                    )}
                    <Button type="button" variant="outline" disabled={busy} onClick={() => void fetchModels()}>拉取模型</Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="apiKey">API Key</Label>
                  <Input id="apiKey" type="password" value={settings.apiKey} placeholder="本地模型可留空" onChange={(event) => patch({ apiKey: event.target.value })} />
                </div>
                <Separator />
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" onClick={save} disabled={busy}><Save className="size-4" />保存</Button>
                  <Button type="button" variant="outline" onClick={() => void test()} disabled={busy}>测试连接</Button>
                  <Button type="button" variant="ghost" disabled={busy} onClick={() => { setSettings({ ...DEFAULT_AI_SETTINGS }); setStatus("已恢复全部默认，记得保存") }}>恢复默认</Button>
                </div>
                {status ? <p className="text-sm text-muted-foreground" role="status">{status}</p> : null}
              </CardContent>
            </Card>

            <Card className="min-w-0 border-border/70 bg-card shadow-none">
              <CardHeader className="pb-4">
                <div className="flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <BrainCircuit className="size-4" />
                  </span>
                  <div>
                    <CardTitle>提示词工作台</CardTitle>
                    <CardDescription className="mt-1 leading-5">切换生成场景、插入变量，并使用 CodeMirror 编辑。</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <PromptEditor settings={settings} onChange={(key, value) => patch({ [key]: value })} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="sync" className="mt-0 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200">
          {sync ? (
            <Card className="max-w-3xl border-border/70 bg-card shadow-none">
              <CardHeader className="pb-4">
                <div className="flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Table2 className="size-4" />
                  </span>
                  <div>
                    <CardTitle>Google Sheets 同步</CardTitle>
                    <CardDescription className="mt-1 leading-5">
                      卡包、模板和学习记录保存到你的 Google Sheet；语音缓存与 API Key 留在本机。
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <GoogleAccountPanel onAuthenticatedChange={setGoogleAuthenticated} />
                <div className="rounded-xl border border-border/70 bg-muted/35 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{sync.message}</span>
                    {sync.dirtyCount > 0 ? <Badge variant="secondary">{sync.dirtyCount} 待上传</Badge> : <Badge variant="outline">最新</Badge>}
                  </div>
                  {sync.lastSyncAt ? (
                    <p className="mt-2 text-xs text-muted-foreground">上次同步 {new Date(sync.lastSyncAt).toLocaleString()}</p>
                  ) : null}
                  {sync.unavailable ? (
                    <p className="mt-2 text-xs leading-5 text-amber-700 dark:text-amber-300">{sync.unavailable}。离线改动会保留，恢复连接后自动同步。</p>
                  ) : null}
                </div>
                <Button
                  type="button"
                  className="sm:w-fit"
                  variant="outline"
                  disabled={sync.syncing || googleAuthenticated === false}
                  onClick={onSyncNow}
                >
                  <RefreshCw className={sync.syncing ? "size-4 animate-spin" : "size-4"} />
                  {sync.syncing ? "同步中…" : googleAuthenticated === false ? "连接帐号后同步" : "立即同步"}
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>
      </div>
    </Tabs>
  )
}
