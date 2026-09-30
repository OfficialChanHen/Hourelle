'use client'

import { useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { reducedMotion } from '@/lib/prefs'

/* A stack you page through: the current card on top, the next one or two peeking
   out behind it like paper, and previous / next arrows with "2 of 5" between them.
   Swipe on a touch screen, or Left and Right with the stack focused, do the same.

   Bounded however long the list is: only the card on top is drawn in full, the
   ones behind are blank paper from `behind(depth)`, so thirty plans cost the same
   as three. The caller owns the index, so whatever sits around the stack (a
   headline, say) can follow it. One card: no arrows, no paper behind.

   Moving slides the new card in from the side it came from, with a little turn,
   and nudges the paper behind; with reduced motion it simply swaps. */
export function Deck({
  count,
  index,
  onIndex,
  label,
  itemLabel = 'plan',
  behind,
  children,
  className = '',
  footer,
  center = false,
}: {
  count: number
  index: number
  onIndex: (i: number) => void
  label: string
  itemLabel?: string
  behind?: (depth: number) => React.ReactNode
  children: React.ReactNode
  className?: string
  // extra things on the arrows row, after the arrows (a "See all" link, say)
  footer?: React.ReactNode
  // centre the arrows under the stack below lg (a stack that sits centred on a phone)
  center?: boolean
}) {
  const root = useRef<HTMLDivElement>(null)
  const top = useRef<HTMLDivElement>(null)
  const last = useRef(index)
  const swipe = useRef<{ x: number; y: number } | null>(null)
  const many = count > 1

  useGSAP(() => {
    const dir = index > last.current ? 1 : -1
    const moved = index !== last.current
    last.current = index
    if (!moved || reducedMotion() || !top.current) return
    gsap.fromTo(top.current, { x: dir * 56, rotate: dir * 4, opacity: 0 }, { x: 0, rotate: 0, opacity: 1, duration: 0.4, ease: 'power3.out' })
    gsap.fromTo('[data-deck-behind]', { y: 6 }, { y: 0, duration: 0.35, ease: 'power2.out', stagger: 0.04 })
  }, { scope: root, dependencies: [index] })

  const go = (i: number) => { if (i >= 0 && i < count && i !== index) onIndex(i) }

  return (
    <div
      ref={root}
      role="group"
      aria-roledescription="carousel"
      aria-label={label}
      tabIndex={many ? 0 : undefined}
      onKeyDown={(e) => {
        if (!many) return
        if (e.key === 'ArrowRight') { e.preventDefault(); go(index + 1) }
        if (e.key === 'ArrowLeft') { e.preventDefault(); go(index - 1) }
      }}
      className={`relative rounded-2xl outline-offset-4 focus-visible:outline-2 focus-visible:outline-accent ${className}`}
    >
      <div
        className="relative"
        // a sideways swipe pages; up and down still scroll the page
        style={many ? { touchAction: 'pan-y' } : undefined}
        onPointerDown={(e) => { if (many && e.pointerType !== 'mouse') swipe.current = { x: e.clientX, y: e.clientY } }}
        onPointerUp={(e) => {
          const s = swipe.current
          swipe.current = null
          if (!s) return
          const dx = e.clientX - s.x, dy = e.clientY - s.y
          if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) go(index + (dx < 0 ? 1 : -1))
        }}
        onPointerCancel={() => { swipe.current = null }}
      >
        {many && behind && [2, 1].filter((d) => index + d < count).map((d) => (
          <div key={d} data-deck-behind aria-hidden className="pointer-events-none absolute inset-0">{behind(d)}</div>
        ))}
        <div ref={top} key={index} className="relative">{children}</div>
      </div>
      {(many || footer) && (
        <div className={`mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 ${center ? 'justify-center lg:justify-start' : ''}`}>
          {many && (
            <>
              <button
                type="button" onClick={() => go(index - 1)} disabled={index === 0} aria-label={`Previous ${itemLabel}`}
                className="grid h-11 w-11 place-items-center rounded-full border border-border2 bg-s1 text-text hover:bg-s2 disabled:opacity-40 disabled:hover:bg-s1 sm:h-9 sm:w-9"
              >
                <ChevronLeft size={17} />
              </button>
              <span aria-live="polite" className="min-w-[52px] text-center text-[13px] font-medium tabular-nums text-dim">
                {index + 1} of {count}
              </span>
              <button
                type="button" onClick={() => go(index + 1)} disabled={index === count - 1} aria-label={`Next ${itemLabel}`}
                className="grid h-11 w-11 place-items-center rounded-full border border-border2 bg-s1 text-text hover:bg-s2 disabled:opacity-40 disabled:hover:bg-s1 sm:h-9 sm:w-9"
              >
                <ChevronRight size={17} />
              </button>
            </>
          )}
          {footer}
        </div>
      )}
    </div>
  )
}
