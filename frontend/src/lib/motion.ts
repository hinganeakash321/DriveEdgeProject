/**
 * Shared Framer Motion variants and timing tokens.
 *
 * Centralising these keeps entrance / hover / exit motion identical across the
 * whole app. Durations are intentionally short and the easing is a single
 * "premium" cubic-bezier so the product feels cohesive rather than busy.
 */
import type { Variants, Transition } from "framer-motion";

export const EASE = [0.22, 1, 0.36, 1] as const;

export const DURATION = {
  fast: 0.2,
  base: 0.4,
  slow: 0.6,
} as const;

export const spring: Transition = { type: "spring", stiffness: 380, damping: 32 };

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: DURATION.base, ease: EASE } },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: DURATION.base, ease: EASE } },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  show: { opacity: 1, scale: 1, transition: { duration: DURATION.base, ease: EASE } },
};

export const slideInLeft: Variants = {
  hidden: { opacity: 0, x: -24 },
  show: { opacity: 1, x: 0, transition: { duration: DURATION.base, ease: EASE } },
};

export const slideInRight: Variants = {
  hidden: { opacity: 0, x: 24 },
  show: { opacity: 1, x: 0, transition: { duration: DURATION.base, ease: EASE } },
};

/** Container that staggers its direct `fadeUp`/`scaleIn` children. */
export const staggerContainer = (stagger = 0.07, delayChildren = 0): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: stagger, delayChildren } },
});

/** Backdrop + panel variants for modals. */
export const modalBackdrop: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: DURATION.fast } },
  exit: { opacity: 0, transition: { duration: DURATION.fast } },
};

export const modalPanel: Variants = {
  hidden: { opacity: 0, scale: 0.96, y: 12 },
  show: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.28, ease: EASE } },
  exit: { opacity: 0, scale: 0.97, y: 8, transition: { duration: 0.18, ease: EASE } },
};

/** Drawer panel sliding from a side. */
export const drawerPanel = (side: "left" | "right" | "bottom" = "right"): Variants => {
  const hiddenOffset =
    side === "left" ? { x: "-100%" } : side === "right" ? { x: "100%" } : { y: "100%" };
  return {
    hidden: hiddenOffset,
    show: { x: 0, y: 0, transition: { type: "spring", stiffness: 420, damping: 40 } },
    exit: { ...hiddenOffset, transition: { duration: 0.22, ease: EASE } },
  };
};

/** Page/route transition. */
export const routeTransition: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE } },
};
