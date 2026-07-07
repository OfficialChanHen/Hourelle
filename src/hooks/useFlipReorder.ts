'use client'

import { useRef } from 'react'
import { gsap } from 'gsap'
import { Flip } from 'gsap/Flip'
import { useGSAP } from '@gsap/react'

gsap.registerPlugin(Flip)

/**
 * Animate a list when its items reorder, enter, or leave — so it's clear which item moved
 * rather than the layout snapping. Call `capture()` right before the state change that
 * reorders/adds/removes; the animation runs after React commits the new order.
 *
 * Put the returned `scope` ref on the list container and `data-flip-id={stableId}` on each item.
 * `signature` must change when the order/membership changes (e.g. `ids.join('|')`).
 */
export function useFlipReorder(signature: string) {
  const scope = useRef<HTMLDivElement>(null)
  const stateRef = useRef<Flip.FlipState | null>(null)

  const capture = () => {
    if (scope.current) stateRef.current = Flip.getState(scope.current.querySelectorAll('[data-flip-id]'))
  }

  useGSAP(() => {
    if (!stateRef.current) return
    // transforms only (no `absolute`) so the container never collapses and neighbours stay put;
    // removed items just disappear (React already unmounted them) while the rest slide into place
    Flip.from(stateRef.current, {
      duration: 0.4,
      ease: 'power2.inOut',
      onEnter: (els) => gsap.fromTo(els, { opacity: 0, scale: 0.96 }, { opacity: 1, scale: 1, duration: 0.3, ease: 'power2.out' }),
    })
    stateRef.current = null
  }, { scope, dependencies: [signature] })

  return { scope, capture }
}
