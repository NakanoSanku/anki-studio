import { describe, expect, it } from "vitest"

import {
  CARD_MOTION_DURATION_S,
  cardMotionDirection,
  cardMotionPose,
} from "@/lib/card-motion"

describe("cardMotionDirection", () => {
  it("moves forward for reveal and advance, backward for conceal", () => {
    expect(cardMotionDirection("reveal")).toBe(1)
    expect(cardMotionDirection("advance")).toBe(1)
    expect(cardMotionDirection("conceal")).toBe(-1)
  })
})

describe("cardMotionPose", () => {
  it("slides forward when advancing: next card enters from the right", () => {
    const pose = cardMotionPose("advance", false)
    expect(pose.initial.x).toBeGreaterThan(0)
    expect(pose.exit.x).toBeLessThan(0)
    expect(pose.animate).toEqual({ x: 0, opacity: 1 })
  })

  it("slides backward when concealing: front face returns from the left", () => {
    const pose = cardMotionPose("conceal", false)
    expect(pose.initial.x).toBeLessThan(0)
    expect(pose.exit.x).toBeGreaterThan(0)
  })

  it("reveals in the forward direction", () => {
    const pose = cardMotionPose("reveal", false)
    expect(pose.initial.x).toBeGreaterThan(0)
    expect(pose.exit.x).toBeLessThan(0)
  })

  it("keeps horizontal travel but not opacity under reduced motion", () => {
    for (const action of ["reveal", "conceal", "advance"] as const) {
      const pose = cardMotionPose(action, true)
      expect(pose.initial.x).toBe(0)
      expect(pose.animate.x).toBe(0)
      expect(pose.exit.x).toBe(0)
      expect(pose.initial.opacity).toBe(0)
      expect(pose.animate.opacity).toBe(1)
    }
  })

  it("stays within the 300ms motion budget", () => {
    expect(CARD_MOTION_DURATION_S * 1000).toBeLessThanOrEqual(300)
    expect(CARD_MOTION_DURATION_S * 1000).toBeGreaterThan(0)
  })
})
