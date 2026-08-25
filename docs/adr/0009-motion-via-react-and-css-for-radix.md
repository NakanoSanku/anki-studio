# Hand-written motion uses motion/react; Radix animations stay CSS

All hand-written animation in the app (study-session card transitions, offline banner, status toast, sync icon swaps) is built with `motion/react`. The built-in `data-state` CSS animations of shadcn/Radix primitives (Dialog, Sheet, DropdownMenu, …) stay as they are, on `tw-animate-css`.

One animation system for code we own keeps durations and reduced-motion handling in one place (`useReducedMotion` + small pure helpers in `lib/`). Rewriting the Radix primitives on Motion was rejected: Radix unmounts on animation end and owns focus/scroll-lock during that window; bypassing it means re-testing every primitive for regressions that no animation goal justifies. The cost is that two systems coexist — when touching UI, use Motion for new hand-written effects and leave the primitives' CSS alone.
