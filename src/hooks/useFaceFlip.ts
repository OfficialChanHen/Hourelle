'use client'

import { useRef, useState } from 'react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { reducedMotion } from '@/lib/prefs'

/* A face that turns over to show the initials on its back. Put `scope` on the button
   and the class `face-flip` on the element that holds both sides; `toggle` turns it
   with a small overshoot, or simply swaps sides when motion is reduced. */
export function useFaceFlip() {
  const scope = useRef<HTMLButtonElement>(null)
  const [flipped, setFlipped] = useState(false)
  const { contextSafe } = useGSAP({ scope })
  function toggle() {
    const next = !flipped
    setFlipped(next)
    const el = scope.current?.querySelector('.face-flip')
    if (!el) return
    contextSafe(() => {
      if (reducedMotion()) gsap.set(el, { rotateY: next ? 180 : 0 })
      else gsap.to(el, { rotateY: next ? 180 : 0, duration: 0.55, ease: 'back.out(1.7)', overwrite: true })
    })()
  }
  return { scope, flipped, toggle }
}
