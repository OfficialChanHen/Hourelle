import { gsap } from 'gsap'

/* ── a post-it peeled off its pad, the way it comes off in your hand ──
   Used on Home when a note's task is done (Home's notes board). Run on a copy of the
   note placed in a layer of its own, so React keeps its node. Only ever called from
   inside a useGSAP, so GSAP's context cleans up after it. */

export type Peel = {
  /** how far the note is peeled, 0 (flat) to 1 (curled up to its glue) */
  set: (p: number) => void
  /** peel the rest of the way, let the glue go, and let the note fall off the page
   *  (`fall`), or lift it away */
  finish: (done?: () => void, opts?: { fall?: boolean }) => void
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
    finish: (done, opts) => {
      tweenTo(1, 0.45 * (1 - state.p) + 0.1, 'power1.in', () => {
        // the glue lets go: the curled note either drops, turning a little as it falls
        // off the page, or comes up off the pad and away
        running = gsap.to(box, opts?.fall
          ? { y: H * 1.4, x: W * 0.12, rotation: 14, opacity: 0, duration: 0.55, ease: 'power2.in', onComplete: () => { box.remove(); done?.() } }
          : { y: -H * 0.4, x: W * 0.08, rotation: 4, scale: 1.04, opacity: 0, duration: 0.3, ease: 'power2.in', onComplete: () => { box.remove(); done?.() } },
        ).timeScale(speed)
      })
    },
    cancel: (done) => {
      tweenTo(0, 0.3, 'back.out(1.4)', done)
    },
    remove: () => box.remove(),
    hurry: () => { speed = 4; running?.timeScale(speed) },
  }
}
