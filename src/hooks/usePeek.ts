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

   `intro` is for screens with no hover: the first time the card scrolls into view
   the faces rise once, hold a moment and settle back. Once per card per page view. */

// one observer for every card on the page, so thirty cards cost one observer, and
// each card leaves it as soon as its intro has played
const introFor = new WeakMap<Element, () => void>()
let introObserver: IntersectionObserver | null = null
function observeIntro(el: Element, run: () => void) {
  if (typeof IntersectionObserver === 'undefined') return () => {}
  introObserver ??= new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (!en.isIntersecting) continue
      introObserver?.unobserve(en.target)
      introFor.get(en.target)?.()
      introFor.delete(en.target)
    }
  }, { threshold: 0.6 })
  introFor.set(el, run)
  introObserver.observe(el)
  return () => { introObserver?.unobserve(el); introFor.delete(el) }
}

// how long the raised faces hold before they settle, in seconds
const HOLD = 0.8

export function usePeek({ restY, upY, restTilt, upTilt, intro = false }: {
  restY: number; upY: number; restTilt: number; upTilt: number; intro?: boolean
}) {
  const scope = useRef<HTMLDivElement>(null)
  const up = useRef(false)
  const { contextSafe } = useGSAP({ scope })
  const riseTo = () => ({
    y: upY, rotate: (i: number) => (i % 2 ? upTilt : -upTilt),
    duration: 0.5, ease: 'back.out(2.2)', stagger: 0.045,
  })
  const settleTo = () => ({
    y: restY, rotate: (i: number) => (i % 2 ? restTilt : -restTilt),
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
  // the touch intro: rise, hold, settle, as one timeline the hook's context owns
  useGSAP((_, safe) => {
    const el = scope.current
    if (!intro || !el || !safe || reducedMotion()) return
    const play = safe(() => {
      const faces = gsap.utils.toArray<HTMLElement>('.peek-face', el)
      if (!faces.length) return
      gsap.timeline()
        .to(faces, { ...riseTo(), overwrite: true })
        .to(faces, settleTo(), `+=${HOLD}`)
    })
    return observeIntro(el, play)
  }, { scope, dependencies: [intro, restY] })
  return { scope, rise, settle }
}
