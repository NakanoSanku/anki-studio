export type VirtualRange = {
  start: number
  end: number
  padTop: number
  padBottom: number
}

export function visibleRange(
  count: number,
  scrollTop: number,
  viewport: number,
  rowHeight: number,
  overscan = 8,
  offset = 0
): VirtualRange {
  if (count <= 0 || rowHeight <= 0) {
    return { start: 0, end: 0, padTop: 0, padBottom: 0 }
  }
  const start = Math.max(0, Math.floor((scrollTop - offset) / rowHeight) - overscan)
  const end = Math.min(
    count,
    Math.max(start, Math.ceil((scrollTop - offset + Math.max(viewport, rowHeight)) / rowHeight) + overscan)
  )
  return {
    start,
    end,
    padTop: start * rowHeight,
    padBottom: Math.max(0, (count - end) * rowHeight),
  }
}

export function scrollToRow(
  scrollTop: number,
  viewport: number,
  index: number,
  rowHeight: number,
  offset = 0
): number | null {
  if (index < 0 || rowHeight <= 0 || viewport <= 0) return null
  const top = offset + index * rowHeight
  const bottom = top + rowHeight
  if (top < scrollTop) return top
  if (bottom > scrollTop + viewport) return Math.max(0, bottom - viewport)
  return null
}
