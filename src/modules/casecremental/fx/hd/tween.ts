import { gsap } from "gsap";

// Shared motion presets for the HD layer and the UI (spec §6): pop, float-away, anticipate-then-act,
// overshoot and spring. Pixel sprites never use these — they move by drawn frames and whole pixels.

interface Scalable {
  scale: { x: number; y: number };
}
interface Movable {
  y: number;
  alpha: number;
}

/** Appear: from small to full size with a springy overshoot. */
export function pop(target: Scalable, from = 0.6, duration = 0.35): gsap.core.Tween {
  return gsap.fromTo(target.scale, { x: from, y: from }, { x: 1, y: 1, duration, ease: "back.out(2.5)" });
}

/** Rise by `dy` px and fade out over the last 40 %. */
export function floatAway(target: Movable, dy: number, duration = 0.9): gsap.core.Timeline {
  const y = target.y;
  return gsap
    .timeline()
    .to(target, { y: y - dy, duration, ease: "power2.out" }, 0)
    .to(target, { alpha: 0, duration: duration * 0.4, ease: "power1.in" }, duration * 0.6);
}

/** Wind up (shrink), act at the peak, then settle with an overshoot. */
export function anticipate(target: Scalable, act: () => void): gsap.core.Timeline {
  return gsap
    .timeline()
    .to(target.scale, { x: 0.9, y: 0.9, duration: 0.08, ease: "power2.in" })
    .to(target.scale, { x: 1.15, y: 1.15, duration: 0.1, ease: "power2.out" })
    .call(act)
    .to(target.scale, { x: 1, y: 1, duration: 0.25, ease: "back.out(3)" });
}

/** A quick shove that springs back (button presses, counters bumping). */
export function spring(target: Scalable, amount = 0.12): gsap.core.Timeline {
  return gsap
    .timeline()
    .to(target.scale, { x: 1 + amount, y: 1 + amount, duration: 0.07, ease: "power1.out" })
    .to(target.scale, { x: 1, y: 1, duration: 0.5, ease: "elastic.out(1, 0.35)" });
}

/** Hit-stop and slow-mo reach the HD tweens too. */
export function setTweenTimeScale(scale: number): void {
  gsap.globalTimeline.timeScale(Math.max(scale, 0.0001));
}

/** The same spring for a DOM element (buttons, the cash counter). */
export function springElement(el: Element, amount = 0.12): gsap.core.Tween {
  return gsap.fromTo(el, { scale: 1 + amount }, { scale: 1, duration: 0.5, ease: "elastic.out(1, 0.35)", overwrite: true });
}

/** A panel button's press (F1): it dips to 0.92 and eases back to its size, never past it. A button that grew stuck out
 *  of its scroll area and flashed a scrollbar for as long as the spring rang. */
export const PRESS = { from: 0.92, duration: 0.25, ease: "power3.out" } as const;

/** A panel button's press: it dips to PRESS.from and eases back to its size. */
export function pressElement(el: Element): gsap.core.Tween {
  return gsap.fromTo(el, { scale: PRESS.from }, { scale: 1, duration: PRESS.duration, ease: PRESS.ease, overwrite: true });
}

/** A DOM panel appears with a pop. */
export function popElement(el: Element): gsap.core.Tween {
  return gsap.fromTo(el, { scale: 0.85, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, ease: "back.out(2.5)" });
}
