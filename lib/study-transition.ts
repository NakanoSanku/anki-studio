/**
 * Legacy shared-element name kept for compatibility with older callers/tests.
 * Study navigation no longer opts into a route-level View Transition because
 * the extra morph made Start studying feel delayed on mobile.
 */
export const STUDY_STAGE_NAME = "study-stage"

/**
 * Home ↔ Study is intentionally untyped now. Passing no transition type keeps
 * Next navigation immediate and avoids waiting on the shared-element morph.
 */
export function studyPairTransitionTypes(from: string, to: string): string[] | undefined {
  void from
  void to
  return undefined
}
