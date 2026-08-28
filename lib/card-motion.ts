// Pure decision logic for study-card transitions. Reveal/conceal deliberately
// avoid spatial motion so switching faces reads as an immediate content change.

export type CardMotionAction = "reveal" | "conceal" | "advance"

export type CardMotionPose = {
  initial: { x: number; opacity: number }
  animate: { x: number; opacity: number }
  exit: { x: number; opacity: number }
}

/** Keep card feedback short enough to feel responsive on touch devices. */
export const CARD_MOTION_DURATION_S = 0.12

const ADVANCE_PX = 12

export function cardMotionDirection(action: CardMotionAction): 1 | -1 {
  return action === "conceal" ? -1 : 1
}

export function cardMotionPose(action: CardMotionAction, reducedMotion: boolean): CardMotionPose {
  if (reducedMotion) {
    return {
      initial: { x: 0, opacity: 0 },
      animate: { x: 0, opacity: 1 },
      exit: { x: 0, opacity: 0 },
    }
  }

  if (action === "advance") {
    return {
      initial: { x: ADVANCE_PX, opacity: 0 },
      animate: { x: 0, opacity: 1 },
      exit: { x: -ADVANCE_PX, opacity: 0 },
    }
  }

  return {
    initial: { x: 0, opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: 0, opacity: 0 },
  }
}
