"use client"

import type { ComponentProps } from "react"

import { AttachmentRuntime } from "@/components/attachment-runtime"
import { CardPreview as BaseCardPreview } from "./card-preview"

export function CardPreview(props: ComponentProps<typeof BaseCardPreview>) {
  return (
    <>
      <AttachmentRuntime />
      <BaseCardPreview {...props} />
    </>
  )
}
