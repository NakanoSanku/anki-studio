// Pure decision logic for the study-card slide transitions. Components stay
// thin: they pick an action and a reduced-motion flag, and render the pose.

export type CardMotionAction = "reveal" | "conceal" | "advance"

export type CardMotionPose = {
  initial: { x: number; opacity: number }
  animate: { x: number; opacity: number }
  exit: { x: number; opacity: number }
}

/** Single shared duration so reveal, conceal, and advance feel like one system. */
export const CARD_MOTION_DURATION_S = 0.22

const SLIDE_PX = 32

/**
 * Forward actions (揭示答案, 评分推进) read as page turns: content enters
 * from the right and leaves to the left. 重看正面 reverses it.
 */
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
  const dir = cardMotionDirection(action)
  return {
    initial: { x: SLIDE_PX * dir, opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: -SLIDE_PX * dir, opacity: 0 },
  }
}
