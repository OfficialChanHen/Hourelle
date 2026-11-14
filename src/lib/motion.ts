import { gsap } from 'gsap'

/* ── how things move, in one place ──
   Timing follows how often a thing happens: what people do all the time (a tap, a
   flip, a menu) moves little and lands well under 300ms; panels take a beat longer
   so the eye can follow where they came from; only the rare moments (a plan locking
   in, a note done) take their time and push past real so they land. Nothing moves at
   a constant speed: things start quick and settle (out), or gather and go (in).

   Helpers here are only ever called from inside a useGSAP or an effect, so GSAP's
   context cleans up after them. */

export const DUR = {
  /** a press, a toggle: felt more than seen */
  tap: 0.12,
  /** a menu, a flip, a small thing appearing */
  ui: 0.2,
  /** a sheet or drawer: still under 300ms, long enough to see where it came from */
  panel: 0.28,
  /** leaving is quicker than arriving: the person has already moved on */
  exit: 0.18,
  /** the wind-up before a big move: just enough to see it coming */
  windUp: 0.09,
  /** rare moments only (It's on, a note done) */
  moment: 0.5,
} as const

export const EASE = {
  /** arriving: quick start, soft landing */
  out: 'power3.out',
  /** leaving: gathers speed and goes */
  in: 'power2.in',
  /** from one place to another on the page */
  inOut: 'power2.inOut',
  /** a small overshoot that settles back: follow-through on a panel or a card */
  settle: 'back.out(1.3)',
  /** a bigger overshoot for things that pop (a check, a face) */
  pop: 'back.out(2.2)',
  /** a drift or a ripple */
  soft: 'sine.inOut',
} as const

/** The squash on impact and the stretch back up: a thing that lands flattens a little
 *  wider, springs a little taller and comes to rest, which is what gives it weight.
 *  Added to `tl` at `at`; `amount` 1 is a firm landing, under 1 a lighter one. */
export function squashLand(tl: gsap.core.Timeline, el: gsap.TweenTarget, at: gsap.Position = '>', amount = 1) {
  const s = 0.14 * amount
  return tl
    .to(el, { scaleX: 1 + s, scaleY: 1 - s, duration: 0.07, ease: 'power2.out' }, at)
    .to(el, { scaleX: 1 - s * 0.4, scaleY: 1 + s * 0.4, duration: 0.1, ease: 'power2.inOut' })
    .to(el, { scaleX: 1, scaleY: 1, duration: 0.22, ease: 'back.out(2)' })
}

/** The pull back before the big move, so people see it coming: a short dip the
 *  opposite way (`y` px, `scale` down a touch). Added to `tl` at `at`. */
export function windUp(tl: gsap.core.Timeline, el: gsap.TweenTarget, { y = 0, x = 0, scale = 0.9, at = '>' as gsap.Position } = {}) {
  return tl.to(el, { x, y, scale, duration: DUR.windUp, ease: 'power1.out' }, at)
}

/** Move along a curve, not a straight line: the sideways part and the vertical part
 *  ease differently, so the path bends. `lift` raises the middle of the path (a throw
 *  rises then falls); give `y` a little extra and the far end drops, like a thrown spark. */
export function arcTo(
  tl: gsap.core.Timeline,
  el: gsap.TweenTarget,
  { x, y, lift = 0, duration = DUR.ui as number, at = '<', vars = {} }:
    { x: number; y: number; lift?: number; duration?: number; at?: gsap.Position; vars?: gsap.TweenVars },
) {
  tl.to(el, { x, duration, ease: 'power2.out', ...vars }, at)
  if (!lift) return tl.to(el, { y, duration, ease: 'power1.in' }, '<')
  return tl.to(el, {
    keyframes: { y: [0, y - lift, y], easeEach: 'sine.inOut' },
    duration,
    ease: 'none',
  }, '<')
}

// what counts as a pressable pill: every button is one (CLAUDE.md), and so are chips
// and tabs that act like them
const PRESSABLE = ':where(button, a, summary, [role="button"], [role="tab"]).rounded-full'

/** The press, for every pill in the app at once (one listener, mounted in
 *  providers.tsx). Pressing squashes the button a little wider and shorter, the way
 *  something soft does under a thumb, and letting go springs it back a hair past rest
 *  before it settles. Pressing is the most frequent thing anyone does here, so it lands
 *  at once and the spring back stays under 300ms. It tweens two CSS variables that a
 *  base-layer rule in globals.css turns into the `scale` property, so the press never
 *  touches the button's own transforms (a flipped face, Tailwind's translate). Returns
 *  the cleanup. */
export function listenForPresses(skip: () => boolean): () => void {
  let held: HTMLElement | null = null
  const release = () => {
    if (!held) return
    gsap.to(held, { '--press-x': 1, '--press-y': 1, duration: 0.26, ease: 'back.out(3)', overwrite: 'auto', clearProps: '--press-x,--press-y' })
    held = null
  }
  const down = (e: PointerEvent) => {
    if (e.button !== 0 || skip()) return
    const el = (e.target as Element | null)?.closest?.<HTMLElement>(PRESSABLE)
    if (!el || el.matches(':disabled, [aria-disabled="true"]')) return
    held = el
    gsap.fromTo(el, { '--press-x': 1, '--press-y': 1 }, { '--press-x': 1.02, '--press-y': 0.93, duration: 0.05, ease: 'power2.out', overwrite: 'auto' })
  }
  window.addEventListener('pointerdown', down, { passive: true })
  window.addEventListener('pointerup', release, { passive: true })
  window.addEventListener('pointercancel', release, { passive: true })
  // a finger that slides off to scroll lets go of the button
  window.addEventListener('scroll', release, { passive: true, capture: true })
  return () => {
    window.removeEventListener('pointerdown', down)
    window.removeEventListener('pointerup', release)
    window.removeEventListener('pointercancel', release)
    window.removeEventListener('scroll', release, { capture: true })
  }
}
