export function expireStatus(current: string, message: string): string {
  return current === message ? "" : current
}

export function replaceTimer(
  previousId: number,
  schedule: (fn: () => void, ms: number) => number,
  cancel: (id: number) => void,
  delayMs: number,
  onExpire: () => void
): number {
  cancel(previousId)
  return schedule(onExpire, delayMs)
}
