import { PATHS } from "@/lib/app-paths"

/** Shared-element name for the 学习 overview card ↔ 会话 stage morph. */
export const STUDY_STAGE_NAME = "study-stage"

/**
 * Transition types for the `/` ↔ `/study` pair only.
 * Other route pairs return undefined so they stay untyped (no directional VT).
 */
export function studyPairTransitionTypes(from: string, to: string): string[] | undefined {
  if (from === PATHS.home && to === PATHS.studySession) return ["nav-forward"]
  if (from === PATHS.studySession && to === PATHS.home) return ["nav-back"]
  return undefined
}
