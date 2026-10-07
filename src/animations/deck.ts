import { gsap } from 'gsap'

/* ── taking the top thing off a stack, the way it comes off in your hand ──
   Both work on the node that was on top of a Deck, after React has let go of it
   and the Deck has moved it into its flying layer. Only ever called from inside
   the Deck's useGSAP, so GSAP's context cleans up after them. */

/** A photo card: whatever holds it down comes off first, one thing at a time (each
 *  pin pops out with a jolt of the card, tape peels back from one end, a clip slides
 *  off, photo corners let go). Then it is shuffled to the back: lifted, slid out to
 *  the right past the pile, tucked under it (`under` moves it below the pile, the
 *  moment it is clear of the cards), and slid back in to rest as the bottom card,
 *  where it gives way to the blank paper drawn there. */
export function liftOff(card: HTMLElement, under: (el: HTMLElement) => void): gsap.core.Timeline {
  const tl = gsap.timeline()
  const q = (k: string) => Array.from(card.querySelectorAll<Element>(`[data-keep="${k}"]`))
  q('pin').forEach((pin, i) => {
    const side = i % 2 ? 1 : -1
    tl.to(pin, { y: -7, scale: 1.2, duration: 0.1, ease: 'power2.out' })
      .to(card, { rotation: side * 0.7, duration: 0.06, yoyo: true, repeat: 1, ease: 'sine.inOut' }, '<0.05')
      .to(pin, { y: 52, x: side * 28, rotation: side * 230, opacity: 0, duration: 0.32, ease: 'power2.in' }, '<0.03')
      .to({}, { duration: 0.04 })
  })
  q('tape').forEach((tape, i) => {
    // peeled from its free end: the strip lifts a little and shrinks back to where it
    // is still stuck, then lets go
    const from = i % 2 ? 'inset(0% 0% 0% 0%)' : 'inset(0% 0% 0% 0%)'
    const to = i % 2 ? 'inset(0% 100% 0% 0%)' : 'inset(0% 0% 0% 100%)'
    tl.fromTo(tape, { clipPath: from }, { clipPath: to, y: -4, scaleY: 1.12, duration: 0.34, ease: 'power2.inOut' })
      .to(tape, { opacity: 0, duration: 0.12 }, '-=0.1')
  })
  // a clip's front and back are separate drawings (one under the card): they slide off together
  const clips = q('clip')
  if (clips.length) tl.to(clips, { y: -30, rotation: '+=14', opacity: 0, duration: 0.3, ease: 'back.in(1.6)' })
  const mounts = q('mount')
  if (mounts.length) tl.to(mounts, { scale: 0.4, opacity: 0, duration: 0.18, stagger: 0.06, ease: 'power2.in' })
  tl.to(card, { y: -10, scale: 1.03, duration: 0.14, ease: 'power2.out' })
    .to(card, { x: () => card.offsetWidth * 1.06, y: -4, rotation: 7, duration: 0.36, ease: 'power2.inOut' })
    .call(() => under(card))
    .to(card, { x: -6, y: 12, rotation: -2.5, scale: 0.985, duration: 0.42, ease: 'power3.out' })
    .to(card, { opacity: 0, duration: 0.16, ease: 'none' })
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
  /** play whatever is left of it faster (another note is coming off behind it) */
  hurry: () => void
}

/** A post-it, peeled from the bottom up. The glue is along the top, so the bottom
 *  edge lifts first and the paper curls back towards you, the bend travelling up
 *  the note as it peels, until only the glued strip is left; then that lets go and
 *  the note comes away.
 *
 *  A curl cannot be drawn by bending one box, so the note is cut into horizontal
 *  slices (copies of it, each clipped to its own band) and each slice turns a few
 *  degrees more than the one above it, hinged where they meet. A slice tipped
 *  towards you is a shade darker, the way paper turned from the light is (a dark layer
 *  whose opacity changes, cheaper than filtering the slice every frame). `set`
 *  drives it straight from a finger; `finish` and `cancel` tween it. */
export function peelable(note: HTMLElement, layer: HTMLElement): Peel {
  const W = note.offsetWidth || note.getBoundingClientRect().width
  const H = note.offsetHeight || note.getBoundingClientRect().height
  // fewer slices on a touch screen: each is a full copy of the note, and a phone has
  // fewer frames to spare; the curl still reads as a curl
  const N = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches ? 7 : 10
  const h = H / N
  // the bottom slice ends up turned about 110 degrees: curled right back over
  const step = 110 / (N - 1)
  const box = document.createElement('div')
  box.setAttribute('aria-hidden', 'true')
  Object.assign(box.style, { position: 'absolute', left: '0', top: '0', width: `${W}px`, height: `${H}px`, perspective: `${Math.round(H * 3.2)}px`, perspectiveOrigin: '50% 0%' })
  const slices: HTMLElement[] = []
  const shades: HTMLElement[] = []
  for (let k = 0; k < N; k++) {
    const s = (k === 0 ? note : note.cloneNode(true)) as HTMLElement
    // a hair of overlap so no seam shows between slices
    const top = Math.max(0, k * h - 0.5), bottom = Math.max(0, H - (k + 1) * h - 0.5)
    Object.assign(s.style, { position: 'absolute', left: '0', top: '0', width: `${W}px`, margin: '0', clipPath: `inset(${top}px 0px ${bottom}px 0px)`, transformOrigin: `50% ${k * h}px`, willChange: 'transform' })
    s.setAttribute('inert', '')
    // a slice tipped from the light is shaded by a dark layer over it whose opacity
    // changes, which the browser can blend without repainting the slice, rather than
    // a brightness filter that redraws it every frame
    const shade = document.createElement('div')
    Object.assign(shade.style, { position: 'absolute', inset: '0', borderRadius: 'inherit', background: '#000', opacity: '0', pointerEvents: 'none', willChange: 'opacity', zIndex: '5' })
    // inside the paper itself (the note is turned a little), so no corner of the slice's
    // square box darkens past the note's edge
    ;(s.querySelector<HTMLElement>('.bg-sticky') ?? s).appendChild(shade)
    shades.push(shade)
    slices.push(s)
  }
  box.append(...slices)
  // in front of anything still coming off: what came off first stays on top
  layer.prepend(box)

  const state = { p: 0 }
  let speed = 1
  let running: gsap.core.Tween | null = null
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
      shades[k].style.opacity = phi > 0.5 ? (0.2 * Math.sin(r) + (phi > 90 ? 0.08 : 0)).toFixed(3) : '0'
      y += h * Math.cos(r)
      z += h * Math.sin(r)
    }
  }
  set(0)
  const tweenTo = (p: number, duration: number, ease: string, done?: () => void) =>
    (running = gsap.to(state, { p, duration, ease, overwrite: true, onUpdate: () => set(state.p), onComplete: done }).timeScale(speed))

  return {
    set,
    finish: (done) => {
      tweenTo(1, 0.45 * (1 - state.p) + 0.1, 'power1.in', () => {
        // the glue lets go: the curled note comes up off the pad and away
        running = gsap.to(box, {
          y: -H * 0.4, x: W * 0.08, rotation: 4, scale: 1.04, opacity: 0, duration: 0.3, ease: 'power2.in',
          onComplete: () => { box.remove(); done?.() },
        }).timeScale(speed)
      })
    },
    cancel: (done) => {
      tweenTo(0, 0.3, 'back.out(1.4)', done)
    },
    remove: () => box.remove(),
    hurry: () => { speed = 4; running?.timeScale(speed) },
  }
}
