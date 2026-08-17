import { describe, expect, it } from "vitest"

import { RateGate } from "./rate-gate"

function createClock() {
  let now = 1_000
  const sleeps: number[] = []
  return {
    now: () => now,
    sleep: async (ms: number) => {
      sleeps.push(ms)
      now += ms
    },
    advance: (ms: number) => {
      now += ms
    },
    sleeps,
  }
}

describe("RateGate", () => {
  it("runs queued work one after another with the configured gap", async () => {
    const clock = createClock()
    const gate = new RateGate(400, clock.sleep, clock.now)
    const started: number[] = []

    const results = await Promise.all([
      gate.enqueue(async () => {
        started.push(clock.now())
        return 1
      }),
      gate.enqueue(async () => {
        started.push(clock.now())
        return 2
      }),
      gate.enqueue(async () => {
        started.push(clock.now())
        return 3
      }),
    ])

    expect(results).toEqual([1, 2, 3])
    expect(started).toEqual([1_000, 1_400, 1_800])
    expect(clock.sleeps).toEqual([400, 400])
  })

  it("keeps the queue moving after a failed job", async () => {
    const clock = createClock()
    const gate = new RateGate(400, clock.sleep, clock.now)

    await expect(
      gate.enqueue(async () => {
        throw new Error("boom")
      })
    ).rejects.toThrow("boom")

    const value = await gate.enqueue(async () => "ok")
    expect(value).toBe("ok")
    expect(clock.sleeps).toEqual([400])
  })

  it("does not let concurrent callers skip the gap", async () => {
    const clock = createClock()
    const gate = new RateGate(400, clock.sleep, clock.now)
    let inflight = 0
    let maxInflight = 0

    const work = () =>
      gate.enqueue(async () => {
        inflight += 1
        maxInflight = Math.max(maxInflight, inflight)
        inflight -= 1
      })

    await Promise.all([work(), work(), work(), work()])
    expect(maxInflight).toBe(1)
  })
})
