'use client'

import { useRef } from 'react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { reducedMotion } from '@/lib/prefs'

/* The peek: faces tucked behind a card's top edge that rise up from behind it, one
   after another with a little tilt and an overshoot, then sink back. Put `scope` on
   the element that holds them and the class `peek-face` on each face.

   `restY` / `upY` are the faces' vertical offsets from the card's top edge at rest
   and raised (negative is above the card); `restTilt` / `upTilt` alternate left and
   right. With reduced motion the faces stay where they rest.

   `band` is for screens with no hover: the faces rise while the card is near the
   middle of the screen and sink back to rest once it has been scrolled well away,
   above or below, and rise again whenever it comes back. A face flipped to its
   initials stays flipped through all of it (the flip turns the face, the peek moves
   its holder). */

// Two shared observers for every card on the page, so thirty cards cost two
// observers and no scroll handler. A card rises when any of it enters the middle 40%
// of the screen, and sinks only once it is clear of the middle 70%: the gap between
// the two is the hysteresis, so a card resting at the edge never flickers.
type Peek = { rise: () => void; settle: () => void }
const bandFor = new WeakMap<Element, Peek>()
let inner: IntersectionObserver | null = null
let outer: IntersectionObserver | null = null
function observeBand(el: Element, peek: Peek) {
  if (typeof IntersectionObserver === 'undefined') return () => {}
  inner ??= new IntersectionObserver((entries) => {
    for (const en of entries) if (en.isIntersecting) bandFor.get(en.target)?.rise()
  }, { rootMargin: '-30% 0px -30% 0px' })
  outer ??= new IntersectionObserver((entries) => {
    for (const en of entries) if (!en.isIntersecting) bandFor.get(en.target)?.settle()
  }, { rootMargin: '-15% 0px -15% 0px' })
  bandFor.set(el, peek)
  inner.observe(el)
  outer.observe(el)
  return () => { inner?.unobserve(el); outer?.unobserve(el); bandFor.delete(el) }
}

export function usePeek({ restY, upY, restTilt, upTilt, band = false }: {
  restY: number; upY: number; restTilt: number; upTilt: number; band?: boolean
}) {
  const scope = useRef<HTMLDivElement>(null)
  const up = useRef(false)
  const { contextSafe } = useGSAP({ scope })
  // xPercent/yPercent pinned to 0: GSAP can read the faces' inline rest pose
  // (translateY of half a face) as a percentage and then add y on top of it
  const riseTo = () => ({
    xPercent: 0, yPercent: 0, y: upY, rotate: (i: number) => (i % 2 ? upTilt : -upTilt),
    duration: 0.5, ease: 'back.out(2.2)', stagger: 0.045,
  })
  const settleTo = () => ({
    xPercent: 0, yPercent: 0, y: restY, rotate: (i: number) => (i % 2 ? restTilt : -restTilt),
    duration: 0.42, ease: 'back.out(1.6)', stagger: { each: 0.02, from: 'end' as const },
  })
  // plain handlers: the refs are read when the pointer moves, never during render,
  // and each tween is made inside the hook's context so it is cleaned up with it
  function rise() {
    if (up.current || reducedMotion()) return
    up.current = true
    contextSafe(() => { gsap.to('.peek-face', { ...riseTo(), overwrite: true }) })()
  }
  function settle() {
    if (!up.current) return
    up.current = false
    contextSafe(() => { gsap.to('.peek-face', { ...settleTo(), overwrite: true }) })()
  }
  // the touch band: rise near the middle of the screen, settle once well away. Under
  // reduced motion rise() does nothing, so the faces stay at their rest peek.
  useGSAP(() => {
    const el = scope.current
    if (!band || !el) return
    return observeBand(el, { rise, settle })
  }, { scope, dependencies: [band, restY] })
  return { scope, rise, settle }
}
