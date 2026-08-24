import { describe, expect, it } from "vitest"

import {
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
    expect(resolveLegacyTabPath("templates")).toBe("/settings/templates")
    expect(resolveLegacyTabPath("template")).toBe("/settings/templates")
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
    expect(homeTabRedirect("templates")).toBe("/settings/templates")
  })
})

describe("resolveLegacyPathname", () => {
  it("sends /templates to the 模板 settings page", () => {
    expect(resolveLegacyPathname("/templates")).toBe("/settings/templates")
    expect(resolveLegacyPathname("/templates/")).toBe("/settings/templates")
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
    expect(tabBarVisible("/settings/templates")).toBe(true)
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
    expect(primaryNavActive("/notes", PATHS.home)).toBe(false)
  })
})

describe("settings destinations", () => {
  it("labels the FSRS page 复习参数 and not 学习", () => {
    const studyRow = SETTINGS_ROWS.find((row) => row.href === PATHS.settingsStudy)
    expect(studyRow?.label).toBe(SETTINGS_STUDY_LABEL)
    expect(studyRow?.label).not.toBe("学习")
    expect(SETTINGS_ROWS.some((row) => row.label === "模板")).toBe(true)
    expect(PATHS.settingsStudy).toBe("/settings/study")
  })
})
