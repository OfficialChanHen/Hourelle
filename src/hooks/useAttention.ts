'use client'

/* ── a nudge when something new arrives ──
   A badge changing from 2 to 3 is easy to miss; a small motion is not. Two of them:
   the chat bubble hops when a message lands while the drawer is closed, and the bell
   swings from its top when a notification is added. Only the icon swings, so the
   badge stays put and readable.

   Both fire on a count going up, never on the count a page loads with: hydration
   and the first pull from the cloud both raise a count from zero, and a bell that
   swings on every page load is noise. A count that rises within the first moment
   after mount is taken to be the page settling, not news. */

import { useRef, type RefObject } from 'react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'

const SETTLE_MS = 1500

type Memory = { prev: number; mountedAt: number }
// whether `count` went up since the last time this was asked, once the page is past
// loading. Asked from inside the effect, never during a render.
function rose(mem: RefObject<Memory | null>, count: number): boolean {
  if (!mem.current) { mem.current = { prev: count, mountedAt: Date.now() }; return false }
  const was = mem.current.prev
  mem.current.prev = count
  return count > was && Date.now() - mem.current.mountedAt > SETTLE_MS
}

/** The whole element hops once: up quickly, back down with a bounce. */
export function useBounceOnNew(ref: RefObject<HTMLElement | null>, count: number, active = true) {
  const mem = useRef<Memory | null>(null)
  useGSAP(() => {
    const el = ref.current
    if (!rose(mem, count) || !active || !el) return
    gsap.timeline()
      .to(el, { y: -14, duration: 0.18, ease: 'power2.out' })
      .to(el, { y: 0, duration: 0.55, ease: 'bounce.out' })
  }, { dependencies: [count, active] })
}

/** Swings from the top like a bell, settling in a few shrinking arcs. */
export function useSwingOnNew(ref: RefObject<SVGSVGElement | HTMLElement | null>, count: number) {
  const mem = useRef<Memory | null>(null)
  useGSAP(() => {
    const el = ref.current
    if (!rose(mem, count) || !el) return
    gsap.timeline()
      .set(el, { transformOrigin: '50% 8%' })
      .to(el, { rotation: 18, duration: 0.12, ease: 'power2.out' })
      .to(el, { rotation: -14, duration: 0.16, ease: 'sine.inOut' })
      .to(el, { rotation: 10, duration: 0.16, ease: 'sine.inOut' })
      .to(el, { rotation: -6, duration: 0.16, ease: 'sine.inOut' })
      .to(el, { rotation: 0, duration: 0.2, ease: 'power2.out' })
  }, { dependencies: [count] })
}
