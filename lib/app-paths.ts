export const PATHS = {
  home: "/",
  studySession: "/study",
  notes: "/notes",
  settings: "/settings",
  settingsDeck: "/settings/deck",
  settingsTemplates: "/settings/deck/templates",
  settingsTemplatesLegacy: "/settings/templates",
  settingsStudy: "/settings/study",
  settingsAi: "/settings/ai",
  settingsSync: "/settings/sync",
  templatesLegacy: "/templates",
} as const

export const SETTINGS_STUDY_LABEL = "复习参数"
export const DECK_TEMPLATES_LABEL = "模板"

export const PRIMARY_NAV = [
  { href: PATHS.home, id: "study", label: "学习" },
  { href: PATHS.notes, id: "notes", label: "笔记" },
  { href: PATHS.settings, id: "settings", label: "设置" },
] as const

export const SETTINGS_ROWS = [
  { href: PATHS.settingsDeck, label: "卡包" },
  { href: PATHS.settingsStudy, label: SETTINGS_STUDY_LABEL },
  { href: PATHS.settingsAi, label: "AI" },
  { href: PATHS.settingsSync, label: "同步" },
] as const

const LEGACY_TAB_PATHS: Record<string, string> = {
  study: PATHS.home,
  decks: PATHS.home,
  notes: PATHS.notes,
  cards: PATHS.notes,
  edit: PATHS.notes,
  templates: PATHS.settingsTemplates,
  template: PATHS.settingsTemplates,
  settings: PATHS.settings,
}

export function notePath(id: string): string {
  return `${PATHS.notes}/${encodeURIComponent(id)}`
}

export function noteIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/notes\/([^/]+)\/?$/)
  if (!match?.[1] || match[1] === "new") return null
  try {
    return decodeURIComponent(match[1])
  } catch {
    return match[1]
  }
}

export function resolveLegacyTabPath(tab: string | null | undefined): string | null {
  if (!tab) return null
  return LEGACY_TAB_PATHS[tab] ?? null
}

export function homeTabRedirect(tab: string | null | undefined): string | null {
  const dest = resolveLegacyTabPath(tab)
  if (!dest || dest === PATHS.home) return null
  return dest
}

export function resolveLegacyPathname(pathname: string): string | null {
  const normalized = pathname.replace(/\/+$/, "") || "/"
  if (normalized === PATHS.templatesLegacy) return PATHS.settingsTemplates
  if (normalized === PATHS.settingsTemplatesLegacy) return PATHS.settingsTemplates
  return null
}

export function tabBarVisible(pathname: string): boolean {
  if (pathname === PATHS.studySession || pathname.startsWith(`${PATHS.studySession}/`)) return false
  if (noteIdFromPath(pathname)) return false
  return true
}

export function primaryNavActive(pathname: string, href: string): boolean {
  if (href === PATHS.home) return pathname === PATHS.home || pathname === PATHS.studySession
  if (href === PATHS.notes) return pathname === PATHS.notes || Boolean(noteIdFromPath(pathname))
  if (href === PATHS.settings) return pathname === PATHS.settings || pathname.startsWith(`${PATHS.settings}/`)
  return pathname === href
}

export function firstSearchParam(
  value: string | string[] | undefined
): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}
