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
   right. With reduced motion the faces stay where they rest. */
export function usePeek({ restY, upY, restTilt, upTilt }: { restY: number; upY: number; restTilt: number; upTilt: number }) {
  const scope = useRef<HTMLDivElement>(null)
  const up = useRef(false)
  const { contextSafe } = useGSAP({ scope })
  // plain handlers: the refs are read when the pointer moves, never during render,
  // and each tween is made inside the hook's context so it is cleaned up with it
  function rise() {
    if (up.current || reducedMotion()) return
    up.current = true
    contextSafe(() => {
      gsap.to('.peek-face', {
        y: upY, rotate: (i: number) => (i % 2 ? upTilt : -upTilt),
        duration: 0.5, ease: 'back.out(2.2)', stagger: 0.045, overwrite: true,
      })
    })()
  }
  function settle() {
    if (!up.current) return
    up.current = false
    contextSafe(() => {
      gsap.to('.peek-face', {
        y: restY, rotate: (i: number) => (i % 2 ? restTilt : -restTilt),
        duration: 0.42, ease: 'back.out(1.6)', stagger: { each: 0.02, from: 'end' }, overwrite: true,
      })
    })()
  }
  return { scope, rise, settle }
}
