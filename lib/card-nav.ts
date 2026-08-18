export function insertItemsAfter<T extends { id: string }>(
  items: T[],
  afterId: string | null | undefined,
  incoming: T[]
): T[] {
  if (incoming.length === 0) return items
  const index = afterId ? items.findIndex((item) => item.id === afterId) : -1
  if (index < 0) return [...items, ...incoming]
  return [...items.slice(0, index + 1), ...incoming, ...items.slice(index + 1)]
}

export function moveItemAfter<T extends { id: string }>(
  items: T[],
  itemId: string,
  afterId: string | null | undefined
): T[] {
  const item = items.find((entry) => entry.id === itemId)
  if (!item || afterId === itemId) return items
  const rest = items.filter((entry) => entry.id !== itemId)
  return insertItemsAfter(rest, afterId, [item])
}

export function idAfterDelete<T extends { id: string }>(items: T[], deletedId: string): string {
  const index = items.findIndex((item) => item.id === deletedId)
  const remaining = items.filter((item) => item.id !== deletedId)
  if (remaining.length === 0) return ""
  if (index < 0) return remaining[0]!.id
  return remaining[index]?.id ?? remaining[index - 1]!.id
}

export function neighborId<T extends { id: string }>(
  items: T[],
  currentId: string | null | undefined,
  delta: number
): string {
  if (items.length === 0) return ""
  const index = currentId ? items.findIndex((item) => item.id === currentId) : -1
  const from = index < 0 ? (delta > 0 ? -1 : 0) : index
  const next = Math.min(items.length - 1, Math.max(0, from + delta))
  return items[next]!.id
}

export function idAtIndex<T extends { id: string }>(items: T[], index1: number): string {
  if (items.length === 0) return ""
  const index = Math.min(items.length, Math.max(1, Math.floor(index1))) - 1
  return items[index]?.id ?? ""
}
