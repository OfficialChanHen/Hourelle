'use client'

import { useRef } from 'react'
import { ChevronUp } from 'lucide-react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { reducedMotion } from '@/lib/prefs'

/* The bottom edge of the top post-it in a pad, lifted a little off the page: the
   handle that peels the note away. A post-it is glued along its top, so it is the
   whole bottom edge that comes up first, and that is what this shows: a thin band of
   the note's underside along the bottom, a soft shadow under it, and a small upward
   chevron. When the note arrives the edge lifts once and settles, so the way it
   peels is shown before anyone tries; a mouse over it (or focus) lifts it again.

   Tap to peel; `grab` lets it be dragged up to peel under the finger. The button is
   the full width of the note and 44px tall, reaching a little below the note so it
   never sits over the note's own buttons. Placed by the note (absolutely, so it
   tilts with it). */
type Grab = { onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => void }

export function PeelEdge({ onClick, label, grab }: { onClick: () => void; label: string; grab?: Grab }) {
  const root = useRef<HTMLButtonElement>(null)
  const lip = useRef<HTMLSpanElement>(null)
  const { contextSafe } = useGSAP(() => {
    if (reducedMotion() || !lip.current) return
    // the one hint: the edge comes up and lies back down
    gsap.timeline({ delay: 0.6 })
      .to(lip.current, { scaleY: 2.6, duration: 0.32, ease: 'power2.out' })
      .to(lip.current, { scaleY: 1, duration: 0.5, ease: 'power2.inOut' })
  }, { scope: root })
  const lift = contextSafe((up: boolean) => {
    if (!lip.current || reducedMotion()) return
    gsap.to(lip.current, { scaleY: up ? 2.2 : 1, duration: up ? 0.22 : 0.3, ease: 'power2.out', overwrite: true })
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
      <ChevronUp aria-hidden size={14} strokeWidth={2.4} className="absolute left-1/2 top-[3px] -translate-x-1/2 text-sticky-dim opacity-70" />
      {/* the shadow under the lifted edge, then the edge itself: the underside, curled up */}
      <span aria-hidden className="absolute inset-x-3 top-[22px] h-[5px] rounded-full bg-sticky-curl blur-[3px]" />
      <span
        ref={lip} aria-hidden
        className="absolute inset-x-0 top-[17px] h-[7px] origin-bottom rounded-t-[50%_100%] bg-[color-mix(in_oklab,var(--sticky)_86%,var(--sticky-text))]"
      />
    </button>
  )
}
