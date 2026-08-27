const LEGACY_SYNC_MESSAGES: Record<string, string> = {
  "尚未同步": "Not synced yet",
  "已同步": "Synced",
  "有冲突未处理": "Conflict pending",
  "同步失败": "Sync failed",
  "已是最新": "Up to date",
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
