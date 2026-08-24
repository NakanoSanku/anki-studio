import { describe, expect, it } from "vitest"

import {
  DECK_TEMPLATES_LABEL,
  PATHS,
  SETTINGS_ROWS,
  SETTINGS_STUDY_LABEL,
  homeTabRedirect,
  noteIdFromPath,
  notePath,
  primaryNavActive,
  resolveLegacyPathname,
  resolveLegacyTabPath,
  tabBarVisible,
} from "./app-paths"

describe("resolveLegacyTabPath", () => {
  it("maps locked ?tab= aliases to the shipped destinations", () => {
    expect(resolveLegacyTabPath("study")).toBe("/")
    expect(resolveLegacyTabPath("decks")).toBe("/")
    expect(resolveLegacyTabPath("notes")).toBe("/notes")
    expect(resolveLegacyTabPath("cards")).toBe("/notes")
    expect(resolveLegacyTabPath("edit")).toBe("/notes")
    expect(resolveLegacyTabPath("templates")).toBe("/settings/deck/templates")
    expect(resolveLegacyTabPath("template")).toBe("/settings/deck/templates")
    expect(resolveLegacyTabPath("settings")).toBe("/settings")
    expect(resolveLegacyTabPath(undefined)).toBeNull()
    expect(resolveLegacyTabPath("unknown")).toBeNull()
  })
})

describe("homeTabRedirect", () => {
  it("does not bounce study back onto /", () => {
    expect(homeTabRedirect("study")).toBeNull()
    expect(homeTabRedirect("decks")).toBeNull()
    expect(homeTabRedirect(undefined)).toBeNull()
  })

  it("sends the other aliases off /", () => {
    expect(homeTabRedirect("notes")).toBe("/notes")
    expect(homeTabRedirect("settings")).toBe("/settings")
    expect(homeTabRedirect("templates")).toBe("/settings/deck/templates")
  })
})

describe("resolveLegacyPathname", () => {
  it("sends /templates and /settings/templates to the nested 模板 page", () => {
    expect(resolveLegacyPathname("/templates")).toBe("/settings/deck/templates")
    expect(resolveLegacyPathname("/templates/")).toBe("/settings/deck/templates")
    expect(resolveLegacyPathname("/settings/templates")).toBe("/settings/deck/templates")
    expect(resolveLegacyPathname("/settings/templates/")).toBe("/settings/deck/templates")
    expect(resolveLegacyPathname("/notes")).toBeNull()
  })
})

describe("note paths", () => {
  it("round-trips a note id", () => {
    const path = notePath("card-1")
    expect(path).toBe("/notes/card-1")
    expect(noteIdFromPath(path)).toBe("card-1")
  })

  it("does not treat the list as an editor", () => {
    expect(noteIdFromPath("/notes")).toBeNull()
    expect(noteIdFromPath("/notes/")).toBeNull()
    expect(noteIdFromPath("/notes/new")).toBeNull()
  })
})

describe("tabBarVisible", () => {
  it("hides on 会话 and 笔记 editor only", () => {
    expect(tabBarVisible("/")).toBe(true)
    expect(tabBarVisible("/notes")).toBe(true)
    expect(tabBarVisible("/settings")).toBe(true)
    expect(tabBarVisible("/settings/deck/templates")).toBe(true)
    expect(tabBarVisible("/settings/study")).toBe(true)
    expect(tabBarVisible("/study")).toBe(false)
    expect(tabBarVisible("/notes/card-1")).toBe(false)
  })
})

describe("primaryNavActive", () => {
  it("keeps 学习 active during a 会话", () => {
    expect(primaryNavActive("/study", PATHS.home)).toBe(true)
    expect(primaryNavActive("/notes/abc", PATHS.notes)).toBe(true)
    expect(primaryNavActive("/settings/ai", PATHS.settings)).toBe(true)
    expect(primaryNavActive("/settings/deck/templates", PATHS.settings)).toBe(true)
    expect(primaryNavActive("/notes", PATHS.home)).toBe(false)
  })
})

describe("settings destinations", () => {
  it("lists 卡包 / 复习参数 / AI / 同步 and not 模板", () => {
    expect(SETTINGS_ROWS.map((row) => row.label)).toEqual(["卡包", SETTINGS_STUDY_LABEL, "AI", "同步"])
    expect(PATHS.settingsStudy).toBe("/settings/study")
    expect(PATHS.settingsTemplates).toBe("/settings/deck/templates")
    expect(PATHS.settingsTemplatesLegacy).toBe("/settings/templates")
    expect(DECK_TEMPLATES_LABEL).toBe("模板")
  })
})
