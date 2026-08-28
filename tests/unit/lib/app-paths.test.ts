import { describe, expect, it } from "vitest"

import {
  DECK_TEMPLATES_LABEL,
  PATHS,
  PRIMARY_NAV,
  SETTINGS_ROWS,
  SETTINGS_STUDY_LABEL,
  homeTabRedirect,
  noteIdFromPath,
  notePath,
  primaryNavActive,
  resolveLegacyPathname,
  resolveLegacyTabPath,
  tabBarVisible,
} from "@/lib/app-paths"

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
  it("sends legacy template paths to the nested Templates page", () => {
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
  it("hides on a study session and note editor only", () => {
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
  it("keeps Study active during a session", () => {
    expect(primaryNavActive("/study", PATHS.home)).toBe(true)
    expect(primaryNavActive("/notes/abc", PATHS.notes)).toBe(true)
    expect(primaryNavActive("/settings/ai", PATHS.settings)).toBe(true)
    expect(primaryNavActive("/settings/deck/templates", PATHS.settings)).toBe(true)
    expect(primaryNavActive("/notes", PATHS.home)).toBe(false)
  })
})

describe("English navigation labels", () => {
  it("uses one language across primary and settings navigation", () => {
    expect(PRIMARY_NAV.map((row) => row.label)).toEqual(["Study", "Notes", "Settings"])
    expect(SETTINGS_ROWS.map((row) => row.label)).toEqual(["Deck", SETTINGS_STUDY_LABEL, "AI", "Sync"])
    expect(SETTINGS_STUDY_LABEL).toBe("Study")
    expect(DECK_TEMPLATES_LABEL).toBe("Templates")
  })
})
