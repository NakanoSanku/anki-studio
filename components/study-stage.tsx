"use client"

import type { ReactNode } from "react"

/**
 * Study used to opt into a shared-element route morph here. The wrapper is now
 * intentionally inert so entering/exiting a study session is immediate.
 */
export function StudyStage({ children }: { children: ReactNode }) {
  return children
}
