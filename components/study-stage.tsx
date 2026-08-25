"use client"

import { createElement, type ReactNode } from "react"
import * as React from "react"

import { STUDY_STAGE_NAME } from "@/lib/study-transition"

type ViewTransitionProps = {
  name?: string
  share?: string
  default?: string
  children?: ReactNode
}

type ReactWithViewTransition = typeof React & {
  ViewTransition?: (props: ViewTransitionProps) => ReactNode
}

/**
 * Shared-element wrapper for `/` ↔ `/study`.
 * Renders children unchanged when ViewTransition is missing (unsupported
 * React build or browsers that skip the API).
 */
export function StudyStage({ children }: { children: ReactNode }) {
  const ViewTransition = (React as ReactWithViewTransition).ViewTransition
  if (!ViewTransition) return children
  return createElement(
    ViewTransition,
    {
      name: STUDY_STAGE_NAME,
      share: "morph",
      default: "none",
    },
    children
  )
}
