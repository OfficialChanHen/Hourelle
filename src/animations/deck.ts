import { gsap } from 'gsap'

/* ── taking the top thing off a stack, the way it comes off in your hand ──
   Both work on the node that was on top of a Deck, after React has let go of it
   and the Deck has moved it into its flying layer. Only ever called from inside
   the Deck's useGSAP, so GSAP's context cleans up after them. */

/** A photo card: whatever holds it down comes off first, one thing at a time (each
 *  pin pops out with a jolt of the card, tape peels back from one end, a clip slides
 *  off, photo corners let go), then the card is lifted and set aside to the left. */
export function liftOff(card: HTMLElement): gsap.core.Timeline {
  const tl = gsap.timeline()
  const q = (k: string) => Array.from(card.querySelectorAll<Element>(`[data-keep="${k}"]`))
  q('pin').forEach((pin, i) => {
    const side = i % 2 ? 1 : -1
    tl.to(pin, { y: -7, scale: 1.2, duration: 0.12, ease: 'power2.out' })
      .to(card, { rotation: side * 0.7, duration: 0.07, yoyo: true, repeat: 1, ease: 'sine.inOut' }, '<0.06')
      .to(pin, { y: 52, x: side * 28, rotation: side * 230, opacity: 0, duration: 0.4, ease: 'power2.in' }, '<0.04')
      .to({}, { duration: 0.08 })
  })
  q('tape').forEach((tape, i) => {
    // peeled from its free end: the strip lifts a little and shrinks back to where it
    // is still stuck, then lets go
    const from = i % 2 ? 'inset(0% 0% 0% 0%)' : 'inset(0% 0% 0% 0%)'
    const to = i % 2 ? 'inset(0% 100% 0% 0%)' : 'inset(0% 0% 0% 100%)'
    tl.fromTo(tape, { clipPath: from }, { clipPath: to, y: -4, scaleY: 1.12, duration: 0.42, ease: 'power2.inOut' })
      .to(tape, { opacity: 0, duration: 0.12 }, '-=0.1')
  })
  q('clip').forEach((clip) => {
    tl.to(clip, { y: -30, rotation: '+=14', opacity: 0, duration: 0.36, ease: 'back.in(1.6)' })
  })
  const mounts = q('mount')
  if (mounts.length) tl.to(mounts, { scale: 0.4, opacity: 0, duration: 0.18, stagger: 0.06, ease: 'power2.in' })
  tl.to(card, { y: -8, scale: 1.025, duration: 0.16, ease: 'power2.out' })
    .to(card, { x: () => -card.offsetWidth * 1.15, y: 34, rotation: -9, opacity: 0, duration: 0.5, ease: 'power2.in' })
  return tl
}

export type Peel = {
  /** how far the note is peeled, 0 (flat) to 1 (curled up to its glue) */
  set: (p: number) => void
  /** peel the rest of the way, let the glue go, and lift the note off */
  finish: (done?: () => void) => void
  /** lay it back down flat; the caller removes it once the note is back in place */
  cancel: (done?: () => void) => void
  remove: () => void
}

/** A post-it, peeled from the bottom up. The glue is along the top, so the bottom
 *  edge lifts first and the paper curls back towards you, the bend travelling up
 *  the note as it peels, until only the glued strip is left; then that lets go and
 *  the note comes away.
 *
 *  A curl cannot be drawn by bending one box, so the note is cut into horizontal
 *  slices (copies of it, each clipped to its own band) and each slice turns a few
 *  degrees more than the one above it, hinged where they meet. A slice tipped
 *  towards you is a shade darker, the way paper turned from the light is. `set`
 *  drives it straight from a finger; `finish` and `cancel` tween it. */
export function peelable(note: HTMLElement, layer: HTMLElement): Peel {
  const W = note.offsetWidth || note.getBoundingClientRect().width
  const H = note.offsetHeight || note.getBoundingClientRect().height
  const N = 10
  const h = H / N
  // the bottom slice ends up turned about 110 degrees: curled right back over
  const step = 110 / (N - 1)
  const box = document.createElement('div')
  box.setAttribute('aria-hidden', 'true')
  Object.assign(box.style, { position: 'absolute', left: '0', top: '0', width: `${W}px`, height: `${H}px`, perspective: `${Math.round(H * 3.2)}px`, perspectiveOrigin: '50% 0%' })
  const slices: HTMLElement[] = []
  for (let k = 0; k < N; k++) {
    const s = (k === 0 ? note : note.cloneNode(true)) as HTMLElement
    // a hair of overlap so no seam shows between slices
    const top = Math.max(0, k * h - 0.5), bottom = Math.max(0, H - (k + 1) * h - 0.5)
    Object.assign(s.style, { position: 'absolute', left: '0', top: '0', width: `${W}px`, margin: '0', clipPath: `inset(${top}px 0px ${bottom}px 0px)`, transformOrigin: `50% ${k * h}px`, willChange: 'transform' })
    s.setAttribute('inert', '')
    slices.push(s)
  }
  box.append(...slices)
  layer.appendChild(box)

  const state = { p: 0 }
  const set = (p: number) => {
    state.p = Math.max(0, Math.min(1, p))
    let y = 0, z = 0, phi = 0
    for (let k = 0; k < N; k++) {
      // the glued top slice never bends; below it, the lower the slice the sooner it lifts
      const lift = k === 0 ? 0 : Math.max(0, Math.min(1, state.p * (N - 1) - (N - 1 - k)))
      phi += step * lift
      const s = slices[k]
      s.style.transform = `translate3d(0, ${(y - k * h).toFixed(2)}px, ${z.toFixed(2)}px) rotateX(${phi.toFixed(2)}deg)`
      const r = (Math.min(phi, 180) * Math.PI) / 180
      s.style.filter = phi > 0.5 ? `brightness(${(1 - 0.2 * Math.sin(r) - (phi > 90 ? 0.08 : 0)).toFixed(3)})` : ''
      y += h * Math.cos(r)
      z += h * Math.sin(r)
    }
  }
  set(0)
  const tweenTo = (p: number, duration: number, ease: string, done?: () => void) =>
    gsap.to(state, { p, duration, ease, overwrite: true, onUpdate: () => set(state.p), onComplete: done })

  return {
    set,
    finish: (done) => {
      tweenTo(1, 0.55 * (1 - state.p) + 0.12, 'power1.in', () => {
        // the glue lets go: the curled note comes up off the pad and away
        gsap.to(box, {
          y: -H * 0.4, x: W * 0.08, rotation: 4, scale: 1.04, opacity: 0, duration: 0.38, ease: 'power2.in',
          onComplete: () => { box.remove(); done?.() },
        })
      })
    },
    cancel: (done) => {
      tweenTo(0, 0.3, 'back.out(1.4)', done)
    },
    remove: () => box.remove(),
  }
}
