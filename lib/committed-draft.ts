export function takeCommittedDraft<T>(incoming: T, previous: T, current: T): { previous: T; value: T } {
  if (incoming !== previous) {
    return { previous: incoming, value: incoming }
  }
  return { previous, value: current }
}
