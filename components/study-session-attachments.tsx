"use client"

import type { ComponentProps } from "react"

import { AttachmentRuntime } from "@/components/attachment-runtime"
import { StudySession as BaseStudySession } from "./study-session"

export function StudySession(props: ComponentProps<typeof BaseStudySession>) {
  return (
    <>
      <AttachmentRuntime />
      <BaseStudySession {...props} />
    </>
  )
}
