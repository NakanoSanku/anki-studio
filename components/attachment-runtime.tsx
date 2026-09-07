"use client"

import { useEffect } from "react"

import {
  ATTACHMENT_DATA_ATTRIBUTE,
  parseAttachmentValue,
  resolveAttachmentBlob,
} from "@/lib/attachments"

type Runtime = {
  stop: () => void
  users: number
}

let runtime: Runtime | null = null

function startRuntime(): () => void {
  const listeners = new Map<HTMLIFrameElement, () => void>()
  const urls = new Map<HTMLIFrameElement, Set<string>>()

  const revokeFrameUrls = (frame: HTMLIFrameElement) => {
    const current = urls.get(frame)
    if (!current) return
    for (const url of current) URL.revokeObjectURL(url)
    current.clear()
  }

  const hydrateFrame = (frame: HTMLIFrameElement) => {
    revokeFrameUrls(frame)
    let doc: Document | null = null
    try {
      doc = frame.contentDocument
    } catch {
      return
    }
    if (!doc) return

    const frameUrls = urls.get(frame) ?? new Set<string>()
    urls.set(frame, frameUrls)
    const selector = `[${ATTACHMENT_DATA_ATTRIBUTE}]`
    for (const element of doc.querySelectorAll<HTMLImageElement | HTMLVideoElement>(selector)) {
      if (element.dataset.ankiStudioAttachmentState === "loading") continue
      const encoded = element.getAttribute(ATTACHMENT_DATA_ATTRIBUTE)
      if (!encoded) continue
      let value = ""
      try {
        value = decodeURIComponent(encoded)
      } catch {
        element.dataset.ankiStudioAttachmentState = "error"
        element.title = "Attachment reference is invalid"
        continue
      }
      const ref = parseAttachmentValue(value)
      if (!ref) {
        element.dataset.ankiStudioAttachmentState = "error"
        element.title = "Attachment reference is invalid"
        continue
      }

      element.dataset.ankiStudioAttachmentState = "loading"
      element.title = `Loading ${ref.name}`
      void resolveAttachmentBlob(ref)
        .then((blob) => {
          const currentDoc = frame.contentDocument
          if (!element.isConnected || currentDoc !== doc || !currentDoc?.contains(element)) return
          const objectUrl = URL.createObjectURL(blob)
          frameUrls.add(objectUrl)
          element.src = objectUrl
          if (element instanceof HTMLVideoElement) element.load()
          element.dataset.ankiStudioAttachmentState = "ready"
          element.title = ref.name
        })
        .catch((error: unknown) => {
          if (!element.isConnected) return
          element.dataset.ankiStudioAttachmentState = "error"
          element.title = error instanceof Error ? error.message : `Couldn’t load ${ref.name}`
        })
    }
  }

  const registerFrame = (frame: HTMLIFrameElement) => {
    if (listeners.has(frame)) return
    const onLoad = () => hydrateFrame(frame)
    listeners.set(frame, onLoad)
    frame.addEventListener("load", onLoad)
    if (frame.contentDocument?.readyState === "complete") queueMicrotask(() => hydrateFrame(frame))
  }

  const unregisterFrame = (frame: HTMLIFrameElement) => {
    const listener = listeners.get(frame)
    if (listener) frame.removeEventListener("load", listener)
    listeners.delete(frame)
    revokeFrameUrls(frame)
    urls.delete(frame)
  }

  const registerTree = (node: Node) => {
    if (node instanceof HTMLIFrameElement) registerFrame(node)
    if (node instanceof Element) {
      for (const frame of node.querySelectorAll<HTMLIFrameElement>("iframe")) registerFrame(frame)
    }
  }

  const unregisterTree = (node: Node) => {
    if (node instanceof HTMLIFrameElement) unregisterFrame(node)
    if (node instanceof Element) {
      for (const frame of node.querySelectorAll<HTMLIFrameElement>("iframe")) unregisterFrame(frame)
    }
  }

  for (const frame of document.querySelectorAll<HTMLIFrameElement>("iframe")) registerFrame(frame)
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) registerTree(node)
      for (const node of record.removedNodes) unregisterTree(node)
    }
  })
  observer.observe(document.documentElement, { childList: true, subtree: true })

  return () => {
    observer.disconnect()
    for (const frame of [...listeners.keys()]) unregisterFrame(frame)
  }
}

export function AttachmentRuntime() {
  useEffect(() => {
    if (!runtime) runtime = { users: 0, stop: startRuntime() }
    runtime.users += 1
    return () => {
      if (!runtime) return
      runtime.users -= 1
      if (runtime.users > 0) return
      runtime.stop()
      runtime = null
    }
  }, [])
  return null
}
