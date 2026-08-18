"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { scrollToRow, visibleRange } from "@/lib/virtual-window"

export function useVirtualWindow(count: number, rowHeight: number, offset = 0, enabled = true) {
  const ref = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewport, setViewport] = useState(400)

  useEffect(() => {
    const el = ref.current
    if (!el || !enabled) return
    const update = () => {
      setScrollTop(el.scrollTop)
      setViewport(el.clientHeight)
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    el.addEventListener("scroll", update, { passive: true })
    return () => {
      observer.disconnect()
      el.removeEventListener("scroll", update)
    }
  }, [count, rowHeight, offset, enabled])

  const range = visibleRange(count, scrollTop, viewport, rowHeight, 8, offset)

  const scrollToIndex = useCallback(
    (index: number) => {
      const el = ref.current
      if (!el) return
      const next = scrollToRow(el.scrollTop, el.clientHeight, index, rowHeight, offset)
      if (next != null) el.scrollTop = next
    },
    [rowHeight, offset]
  )

  return { ref, ...range, scrollToIndex }
}
