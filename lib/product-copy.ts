const LEGACY_SYNC_MESSAGES: Record<string, string> = {
  "尚未同步": "Not synced yet",
  "已同步": "Synced",
  "有冲突未处理": "Conflict pending",
  "同步失败": "Sync failed",
  "已是最新": "Up to date",
}

const LEGACY_STATUS_MESSAGES: Record<string, string> = {
  "本机保存失败": "Couldn’t save on this device",
  "导入失败": "Import failed",
  "已导出 JSON": "JSON exported",
  "已导出 CSV": "CSV exported",
  "已导出 APKG": "APKG exported",
  "正在导出，请稍候或取消后重试": "An export is already running. Wait for it to finish or cancel it first.",
  "已取消导出": "Export cancelled",
  "导出失败": "Export failed",
  "已切换卡包": "Deck switched",
  "切换失败": "Couldn’t switch decks",
  "已新建卡包": "Deck created",
  "新建失败": "Couldn’t create the deck",
  "已复制卡包": "Deck duplicated",
  "复制失败": "Couldn’t duplicate the deck",
  "改名失败": "Couldn’t rename the deck",
  "已删除卡包": "Deck deleted",
  "删除失败": "Couldn’t delete the deck",
}

export function productSyncMessage(message: string | undefined): string {
  const value = message?.trim() ?? ""
  if (!value) return "Not synced yet"
  const exact = LEGACY_SYNC_MESSAGES[value]
  if (exact) return exact

  const summary = value.match(/^已同步，上传\s*(\d+)\s*[，,]\s*下载\s*(\d+)$/)
  if (summary) {
    return `Synced · ${summary[1]} uploaded · ${summary[2]} downloaded`
  }

  return value
}

export function productStatusMessage(message: string | undefined): string {
  const value = message?.trim() ?? ""
  if (!value) return ""

  const syncValue = productSyncMessage(value)
  if (syncValue !== value) return syncValue

  const exact = LEGACY_STATUS_MESSAGES[value]
  if (exact) return exact

  let match = value.match(/^已新建卡包「(.+)」，(\d+) 张卡片$/)
  if (match) return `Created deck “${match[1]}” · ${match[2]} cards`

  match = value.match(/^已新建卡包「(.+)」$/)
  if (match) return `Created deck “${match[1]}”`

  match = value.match(/^已替换当前卡包，(\d+) 张卡片$/)
  if (match) return `Replaced the current deck · ${match[1]} cards`

  match = value.match(/^已合并 (\d+) 张新卡片$/)
  if (match) return `Merged ${match[1]} new cards`

  match = value.match(/^将生成 (\d+) 条语音，大约 (\d+) 分钟，可继续编辑，不要关闭标签页$/)
  if (match) return `Generating ${match[1]} audio clips · about ${match[2]} min. You can keep editing; leave this tab open.`

  return value
}
