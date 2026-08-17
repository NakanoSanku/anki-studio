function defaultSleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })
}

export class RateGate {
  private nextAt = 0
  private tail: Promise<void> = Promise.resolve()

  constructor(
    private readonly gapMs: number,
    private readonly sleep: (ms: number) => Promise<void> = defaultSleep,
    private readonly now: () => number = Date.now
  ) {}

  enqueue<T>(work: () => Promise<T>): Promise<T> {
    const run = this.tail.then(async () => {
      const wait = this.nextAt - this.now()
      if (wait > 0) await this.sleep(wait)
      try {
        return await work()
      } finally {
        this.nextAt = this.now() + this.gapMs
      }
    })
    this.tail = run.then(
      () => undefined,
      () => undefined
    )
    return run
  }
}
