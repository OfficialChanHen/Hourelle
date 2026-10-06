'use client'

import { useRef } from 'react'
import { ChevronUp } from 'lucide-react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { reducedMotion } from '@/lib/prefs'

/* The handle along the bottom of the top post-it in a pad: a small upward chevron,
   because a post-it is glued along its top and peels from the bottom up. When the
   note arrives the chevron nudges upwards twice, so the way it peels is shown
   before anyone tries; a mouse over it (or focus) lifts it a little.

   Tap to peel; `grab` lets it be dragged up to peel under the finger. The button is
   the full width of the note and 44px tall, reaching a little below the note so it
   never sits over the note's own buttons. Placed by the note (absolutely, so it
   tilts with it). */
type Grab = { onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => void }

export function PeelEdge({ onClick, label, grab }: { onClick: () => void; label: string; grab?: Grab }) {
  const root = useRef<HTMLButtonElement>(null)
  const arrow = useRef<SVGSVGElement>(null)
  const { contextSafe } = useGSAP(() => {
    if (reducedMotion() || !arrow.current) return
    // the one hint: two small nudges up
    gsap.timeline({ delay: 0.6 })
      .to(arrow.current, { y: -5, duration: 0.2, ease: 'power2.out' })
      .to(arrow.current, { y: 0, duration: 0.25, ease: 'power2.in' })
      .to(arrow.current, { y: -5, duration: 0.2, ease: 'power2.out' })
      .to(arrow.current, { y: 0, duration: 0.35, ease: 'bounce.out' })
  }, { scope: root })
  const lift = contextSafe((up: boolean) => {
    if (!arrow.current || reducedMotion()) return
    gsap.to(arrow.current, { y: up ? -4 : 0, duration: 0.22, ease: 'power2.out', overwrite: true })
  })
  return (
    <button
      ref={root} type="button" aria-label={label} title={label}
      onClick={(e) => { e.stopPropagation(); onClick() }}
      onPointerEnter={(e) => { if (e.pointerType === 'mouse') lift(true) }}
      onPointerLeave={(e) => { if (e.pointerType === 'mouse') lift(false) }}
      onFocus={() => lift(true)} onBlur={() => lift(false)}
      // a handle that can be pulled keeps the page from scrolling under the finger
      style={grab ? { touchAction: 'none' } : undefined}
      onPointerDown={grab?.onPointerDown}
      className="peel-edge absolute inset-x-0 -bottom-5 z-[4] block h-11 cursor-pointer outline-offset-2 [-webkit-tap-highlight-color:transparent]"
    >
      <ChevronUp ref={arrow} aria-hidden size={16} strokeWidth={2.4} className="absolute left-1/2 top-[4px] -ml-2 text-sticky-dim" />
    </button>
  )
}
