'use client'

import { useRef } from 'react'
import { createPortal } from 'react-dom'
import { Undo2 } from 'lucide-react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { reducedMotion } from '@/lib/prefs'
import { PageTurn } from './PageTurn'

/* A stack you page through like real paper: the current card on top, the next one
   or two peeking out behind it, and the top card's bottom right corner turned up.
   Tap that corner (or swipe left, or press Right) and the card lifts from that
   corner and flips over towards the top left, showing the one underneath. Back
   (or a swipe right, or Left) plays the same flip in reverse, bringing the last
   card back down onto the pile. The pile loops both ways, as if a turned card went
   to the bottom of it.

   Bounded however long the list is: only the card on top is drawn in full, the
   ones behind are blank paper from `behind(depth)`, so thirty plans cost the same
   as three. The caller owns the index, so whatever sits around the stack (a
   headline, say) can follow it.

   `children` is a function that is handed the turned-up corner, so the card can
   place it inside its own frame and the corner tilts with it. `paper` says what the
   card is made of, so the corner's underside matches. `navTo` moves Back and the
   count out of the stack to an element of the caller's (a caption beside it);
   without it they sit under the stack. One card: no corner, no Back, no paper.

   The card turning away is the very node that was on top: React detaches it when
   the index changes, and the stack lifts it into a layer of its own for the flip,
   then drops it. With reduced motion the cards simply swap. */
export function Deck({
  count,
  index,
  onIndex,
  label,
  itemLabel = 'plan',
  paper = 'frame',
  behind,
  children,
  className = '',
  footer,
  navTo,
}: {
  count: number
  index: number
  onIndex: (i: number) => void
  label: string
  itemLabel?: string
  paper?: 'frame' | 'sticky'
  behind?: (depth: number) => React.ReactNode
  children: (corner: React.ReactNode) => React.ReactNode
  className?: string
  // extra things on the Back row, after the count (a "See all" link, say)
  footer?: React.ReactNode
  navTo?: HTMLElement | null
}) {
  const root = useRef<HTMLDivElement>(null)
  const fly = useRef<HTMLDivElement>(null)
  const top = useRef<HTMLDivElement | null>(null)
  const prevTop = useRef<HTMLDivElement | null>(null)
  const last = useRef(index)
  // which way the last move went, set by whatever moved it
  const intent = useRef<1 | -1>(1)
  const swipe = useRef<{ x: number; y: number } | null>(null)
  const many = count > 1

  useGSAP(() => {
    const moved = index !== last.current
    last.current = index
    const card = top.current
    if (!moved || !card || reducedMotion()) return
    // lifted from the bottom right: the far corner leads, turning about the top left
    const away = { rotationY: -118, rotationX: 46, rotationZ: -4, x: -24, y: -36, opacity: 0 }
    const set = { transformOrigin: '0% 0%', transformPerspective: 1500, backfaceVisibility: 'hidden' as const }
    if (intent.current === 1) {
      const old = prevTop.current
      if (old && old !== card && fly.current) {
        old.setAttribute('inert', '')
        old.setAttribute('aria-hidden', 'true')
        fly.current.appendChild(old)
        gsap.set(old, { ...set, position: 'absolute', top: 0, left: 0, right: 0 })
        // the corner lifts first, then the whole card turns over; it stays solid paper
        // and only fades once it is past edge-on
        gsap.timeline({ onComplete: () => old.remove() })
          .to(old, { rotationY: -16, rotationX: 12, duration: 0.16, ease: 'power1.out' })
          .to(old, { rotationY: away.rotationY, rotationX: away.rotationX, rotationZ: away.rotationZ, x: away.x, y: away.y, duration: 0.5, ease: 'power2.in' })
          .to(old, { opacity: 0, duration: 0.16, ease: 'none' }, '-=0.18')
      }
      // the card underneath comes up off the pile
      gsap.fromTo(card, { y: 8, scale: 0.985 }, { y: 0, scale: 1, duration: 0.45, delay: 0.12, ease: 'power2.out', clearProps: 'transform' })
    } else {
      gsap.set(card, set)
      // the same turn played backwards: solid from the moment it comes past edge-on
      gsap.timeline()
        .fromTo(card, away, { rotationY: 0, rotationX: 0, rotationZ: 0, x: 0, y: 0, duration: 0.6, ease: 'power3.out', clearProps: 'transform,transformOrigin,backfaceVisibility' })
        .to(card, { opacity: 1, duration: 0.14, ease: 'none', clearProps: 'opacity' }, 0)
    }
    gsap.fromTo('[data-deck-behind]', { y: 5 }, { y: 0, duration: 0.35, ease: 'power2.out', stagger: 0.04 })
  }, { scope: root, dependencies: [index] })

  const go = (dir: 1 | -1) => {
    if (!many) return
    intent.current = dir
    onIndex((index + dir + count) % count)
  }

  const corner = many ? (
    <PageTurn paper={paper} onClick={() => go(1)} label={`Next ${itemLabel}, ${((index + 1) % count) + 1} of ${count}`} />
  ) : null

  const count_ = many && (
    <span aria-live="polite" className="text-[13px] font-medium tabular-nums text-faint">
      {index + 1} of {count}
    </span>
  )
  const nav = (many || footer) && (
    // under the stack: Back, the count, then any extra. In a caption: the count, then Back
    <div className={navTo ? 'flex flex-col items-start gap-1' : 'flex flex-wrap items-center gap-x-3 gap-y-1'}>
      {navTo && count_}
      {many && (
        <>
          <button
            type="button" onClick={() => go(-1)} aria-label={`Previous ${itemLabel}`}
            className="-ml-3 inline-flex h-11 items-center gap-1.5 rounded-full px-3 text-[13.5px] font-semibold text-dim hover:bg-s2 hover:text-text sm:h-9"
          >
            <Undo2 size={15} aria-hidden /> Back
          </button>
          {!navTo && count_}
        </>
      )}
      {footer}
    </div>
  )

  return (
    <div
      ref={root}
      role="group"
      aria-roledescription="carousel"
      aria-label={label}
      tabIndex={many ? 0 : undefined}
      onKeyDown={(e) => {
        if (!many || e.target !== e.currentTarget) return
        if (e.key === 'ArrowRight') { e.preventDefault(); go(1) }
        if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1) }
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
          if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1)
        }}
        onPointerCancel={() => { swipe.current = null }}
      >
        {many && behind && [2, 1].filter((d) => d < count).map((d) => (
          <div key={d} data-deck-behind aria-hidden className="pointer-events-none absolute inset-0 z-0">{behind(d)}</div>
        ))}
        <div
          key={index}
          ref={(el) => { if (el && el !== top.current) { prevTop.current = top.current; top.current = el } }}
          className="relative z-[1]"
        >
          {children(corner)}
        </div>
        {/* the card turning away flies here, above the pile, and takes no pointer */}
        <div ref={fly} aria-hidden className="pointer-events-none absolute inset-0 z-[5]" />
      </div>
      {nav && (navTo ? createPortal(nav, navTo) : <div className="relative z-10 mt-3">{nav}</div>)}
    </div>
  )
}
