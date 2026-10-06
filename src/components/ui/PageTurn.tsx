'use client'

import { useRef } from 'react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { reducedMotion } from '@/lib/prefs'

/* The turned-up bottom right corner of the top card in a Deck: the button that
   flips to the next card. The flap is the card's own underside, curled back over
   it; under the flap you see the next card's paper in its shadow. A mouse over it
   lifts it a little further, the way a thumb would.

   Placed by the card, absolutely, in its frame's bottom right corner, so it tilts
   with the card. The button is 44px square for a finger; the drawing fills its
   bottom right 30px. `paper` picks the colours: a photo frame or a post-it. */
export function PageTurn({ paper, onClick, label }: { paper: 'frame' | 'sticky'; onClick: () => void; label: string }) {
  const root = useRef<HTMLButtonElement>(null)
  const art = useRef<SVGSVGElement>(null)
  const { contextSafe } = useGSAP({ scope: root })
  const lift = contextSafe((up: boolean) => {
    if (!art.current || reducedMotion()) return
    gsap.to(art.current, { scale: up ? 1.3 : 1, duration: up ? 0.25 : 0.3, ease: up ? 'power2.out' : 'power2.inOut', transformOrigin: '100% 100%' })
  })
  const base = paper === 'sticky' ? 'var(--sticky)' : 'var(--frame)'
  const ink = paper === 'sticky' ? 'var(--sticky-text)' : 'var(--text)'
  return (
    <button
      ref={root} type="button" aria-label={label} title={label}
      onClick={(e) => { e.stopPropagation(); onClick() }}
      onPointerEnter={(e) => { if (e.pointerType === 'mouse') lift(true) }}
      onPointerLeave={(e) => { if (e.pointerType === 'mouse') lift(false) }}
      onFocus={() => lift(true)} onBlur={() => lift(false)}
      className="page-turn absolute bottom-0 right-0 z-[4] block h-11 w-11 cursor-pointer rounded-br-[inherit] outline-offset-2 [-webkit-tap-highlight-color:transparent]"
    >
      <svg ref={art} aria-hidden viewBox="0 0 30 30" className="absolute bottom-0 right-0 h-[30px] w-[30px] overflow-visible">
        {/* the next card, seen under the lifted corner, in the flap's shadow */}
        <path d="M30 0 V30 H0 Z" style={{ fill: `color-mix(in oklab, ${base} 84%, ${ink})` }} />
        {/* the flap: the card's underside, curled back over it */}
        <path
          d="M30 0 C19 3 9 5 3.5 3.5 C5 9 3 19 0 30 Z"
          style={{ fill: `color-mix(in oklab, ${base} 92%, ${ink})`, filter: 'drop-shadow(-1px -1px 1.4px rgba(30,20,10,.22))' }}
        />
        {/* the crease */}
        <path d="M30 0 L0 30" style={{ stroke: `color-mix(in oklab, ${base} 70%, ${ink})` }} strokeWidth=".6" fill="none" />
      </svg>
    </button>
  )
}
