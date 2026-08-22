"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { scrollToRow, visibleRange } from "@/lib/virtual-window"

export function useVirtualWindow(count: number, rowHeight: number, offset = 0, enabled = true) {
  const elementRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewport, setViewport] = useState(400)
  const containerRef = useCallback((node: HTMLDivElement | null) => {
    elementRef.current = node
  }, [])

  useEffect(() => {
    const element = elementRef.current
    if (!element || !enabled) return
    const update = () => {
      setScrollTop(element.scrollTop)
      setViewport(element.clientHeight)
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    element.addEventListener("scroll", update, { passive: true })
    return () => {
      observer.disconnect()
      element.removeEventListener("scroll", update)
    }
  }, [count, rowHeight, offset, enabled])

  const range = visibleRange(count, scrollTop, viewport, rowHeight, 8, offset)

  const scrollToIndex = useCallback(
    (index: number) => {
      const element = elementRef.current
      if (!element) return
      const next = scrollToRow(element.scrollTop, element.clientHeight, index, rowHeight, offset)
      if (next != null) element.scrollTop = next
    },
    [rowHeight, offset]
  )

  return { containerRef, ...range, scrollToIndex }
}
