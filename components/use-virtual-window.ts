"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { scrollToRow, visibleRange } from "@/lib/virtual-window"

export function useVirtualWindow(count: number, rowHeight: number, offset = 0, enabled = true) {
  const [element, setElement] = useState<HTMLDivElement | null>(null)
  const elementRef = useRef<HTMLDivElement | null>(null)
  const frameRef = useRef(0)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewport, setViewport] = useState(400)
  const containerRef = useCallback((node: HTMLDivElement | null) => {
    elementRef.current = node
    setElement(node)
  }, [])

  useEffect(() => {
    if (!element || !enabled) return

    const commit = () => {
      frameRef.current = 0
      const nextScrollTop = element.scrollTop
      const nextViewport = element.clientHeight
      setScrollTop((current) => current === nextScrollTop ? current : nextScrollTop)
      setViewport((current) => current === nextViewport ? current : nextViewport)
    }

    const schedule = () => {
      if (frameRef.current) return
      frameRef.current = window.requestAnimationFrame(commit)
    }

    commit()
    const observer = new ResizeObserver(schedule)
    observer.observe(element)
    element.addEventListener("scroll", schedule, { passive: true })
    return () => {
      observer.disconnect()
      element.removeEventListener("scroll", schedule)
      if (frameRef.current) window.cancelAnimationFrame(frameRef.current)
      frameRef.current = 0
    }
  }, [element, enabled])

  const range = useMemo(
    () => visibleRange(count, scrollTop, viewport, rowHeight, 8, offset),
    [count, offset, rowHeight, scrollTop, viewport]
  )

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
