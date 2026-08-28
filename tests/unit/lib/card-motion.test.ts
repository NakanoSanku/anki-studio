import { describe, expect, it } from "vitest"

import {
  CARD_MOTION_DURATION_S,
  cardMotionDirection,
  cardMotionPose,
} from "@/lib/card-motion"

describe("cardMotionDirection", () => {
  it("keeps the legacy direction helper stable", () => {
    expect(cardMotionDirection("reveal")).toBe(1)
    expect(cardMotionDirection("advance")).toBe(1)
    expect(cardMotionDirection("conceal")).toBe(-1)
  })
})

describe("cardMotionPose", () => {
  it("cross-fades reveal and conceal without horizontal travel", () => {
    for (const action of ["reveal", "conceal"] as const) {
      const pose = cardMotionPose(action, false)
      expect(pose.initial.x).toBe(0)
      expect(pose.exit.x).toBe(0)
      expect(pose.initial.opacity).toBe(0)
      expect(pose.animate).toEqual({ x: 0, opacity: 1 })
    }
  })

  it("keeps only a small directional cue when advancing to the next card", () => {
    const pose = cardMotionPose("advance", false)
    expect(pose.initial.x).toBeGreaterThan(0)
    expect(pose.initial.x).toBeLessThanOrEqual(16)
    expect(pose.exit.x).toBeLessThan(0)
    expect(Math.abs(pose.exit.x)).toBeLessThanOrEqual(16)
  })

  it("removes all spatial motion under reduced motion", () => {
    for (const action of ["reveal", "conceal", "advance"] as const) {
      const pose = cardMotionPose(action, true)
      expect(pose.initial.x).toBe(0)
      expect(pose.animate.x).toBe(0)
      expect(pose.exit.x).toBe(0)
      expect(pose.initial.opacity).toBe(0)
      expect(pose.animate.opacity).toBe(1)
    }
  })

  it("keeps card feedback within a 150ms interaction budget", () => {
    expect(CARD_MOTION_DURATION_S * 1000).toBeLessThanOrEqual(150)
    expect(CARD_MOTION_DURATION_S * 1000).toBeGreaterThan(0)
  })
})
