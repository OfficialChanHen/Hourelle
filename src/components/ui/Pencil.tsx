'use client'

import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { reducedMotion } from '@/lib/prefs'

/* ── pencil and ink: hand-drawn marks, planning on paper ──
   Small SVG marks in the theme's own inks: the accent pencil (`accent`), the coral
   pencil for asks (`moment`) and graphite (`graphite`). Every stroke goes through
   one shared grain filter (PencilDefs, mounted once per page in the root layout) so
   it looks drawn rather than vector-perfect; High contrast drops the grain and draws
   plain solid lines (globals.css). Each mark draws itself once when it appears, and
   simply sits there under reduced motion.

   Rules: marks are decoration, always aria-hidden and never the only way something
   is said; a handful per screen at most; never over the availability grid or any
   form field. Sizes come from the thing they mark (an underline spans its word, a
   circle its box, an arrow is measured from its note to its target), never from a
   fixed decorative shape. */

export type Ink = 'accent' | 'moment' | 'graphite'
const STROKE: Record<Ink, string> = { accent: 'stroke-accent', moment: 'stroke-moment', graphite: 'stroke-dim' }
export const PENCIL_FILTER = 'hourelle-pencil'

/** The grain every mark shares. Mount once, near the top of the page. */
export function PencilDefs() {
  return (
    <svg width="0" height="0" aria-hidden focusable="false" className="pointer-events-none absolute">
      <filter id={PENCIL_FILTER} x="-5%" y="-20%" width="110%" height="140%">
        <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="4" result="n" />
        <feDisplacementMap in="SourceGraphic" in2="n" scale="1.6" />
      </filter>
    </svg>
  )
}

// draws every [data-ink] stroke inside `scope` once, from nothing to whole; a mark
// that is measured again later (an arrow on resize) just updates, it is not redrawn
function useDraw(scope: React.RefObject<Element | null>, deps: unknown[] = []) {
  const drawn = useRef(false)
  useGSAP(() => {
    if (drawn.current || !scope.current) return
    const strokes = scope.current.querySelectorAll('[data-ink]')
    if (!strokes.length) return
    drawn.current = true
    if (reducedMotion()) return
    gsap.fromTo(strokes, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.6, ease: 'power2.out', stagger: 0.18, delay: 0.1 })
  }, { scope, dependencies: deps })
}

// one stroke: a path with pathLength 1, so drawing is a dash from 1 to 0
function Stroke({ d, ink, width = 2.2, opacity }: { d: string; ink: Ink; width?: number; opacity?: number }) {
  return (
    <path
      data-ink d={d} pathLength={1} strokeDasharray="1" fill="none" strokeWidth={width}
      strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"
      filter={`url(#${PENCIL_FILTER})`} opacity={opacity} className={`pencil ${STROKE[ink]}`}
    />
  )
}

/** A pencil underline under its word: two strokes, the width of the word. */
export function PencilUnderline({ children, ink = 'accent', className = '' }: { children: React.ReactNode; ink?: Ink; className?: string }) {
  const svg = useRef<SVGSVGElement>(null)
  useDraw(svg)
  return (
    <span className={`relative inline-block ${className}`}>
      {children}
      <svg ref={svg} aria-hidden focusable="false" viewBox="0 0 100 10" preserveAspectRatio="none" className="pointer-events-none absolute -bottom-[7px] -left-[3%] h-[8px] w-[106%] overflow-visible">
        <Stroke d="M1 6 C 25 3, 60 8, 99 4" ink={ink} width={2.4} />
        <Stroke d="M8 8 C 35 7, 65 9.5, 92 7.5" ink={ink} width={1.3} opacity={0.6} />
      </svg>
    </span>
  )
}

/** A loose hand-drawn ring around what it wraps, sized to its box. */
export function PencilCircle({ children, ink = 'accent', className = '' }: { children: React.ReactNode; ink?: Ink; className?: string }) {
  const svg = useRef<SVGSVGElement>(null)
  useDraw(svg)
  return (
    <span className={`relative inline-block ${className}`}>
      {children}
      <svg ref={svg} aria-hidden focusable="false" viewBox="0 0 100 40" preserveAspectRatio="none" className="pointer-events-none absolute -inset-x-[12px] -inset-y-[7px] h-[calc(100%+14px)] w-[calc(100%+24px)] overflow-visible">
        <Stroke d="M54 3 C 86 2, 100 12, 97 22 C 93 35, 30 39, 9 30 C -3 22, 10 4, 48 3 L 64 6" ink={ink} width={2} />
      </svg>
    </span>
  )
}

/** A pencil star, for a note that asks something of you. */
export function PencilStar({ ink = 'moment', size = 18, className = '' }: { ink?: Ink; size?: number; className?: string }) {
  const svg = useRef<SVGSVGElement>(null)
  useDraw(svg)
  return (
    <svg ref={svg} aria-hidden focusable="false" width={size} height={size} viewBox="0 0 26 26" className={`inline-block flex-none overflow-visible ${className}`}>
      <Stroke d="M13 2 L16 10 L24 10.5 L17.5 15.5 L20 24 L13 19 L6 24 L8.5 15.5 L2 10.5 L10 10 Z" ink={ink} width={1.8} />
    </svg>
  )
}

/** A pencil tick, a strike through, and a bracket: the rest of the set. */
export function PencilTick({ ink = 'accent', size = 16 }: { ink?: Ink; size?: number }) {
  const svg = useRef<SVGSVGElement>(null)
  useDraw(svg)
  return <svg ref={svg} aria-hidden focusable="false" width={size} height={size} viewBox="0 0 24 24" className="inline-block overflow-visible"><Stroke d="M4 13 L10 19 L21 5" ink={ink} width={2.6} /></svg>
}
export function PencilStrike({ children, ink = 'moment' }: { children: React.ReactNode; ink?: Ink }) {
  const svg = useRef<SVGSVGElement>(null)
  useDraw(svg)
  return (
    <span className="relative inline-block">
      {children}
      <svg ref={svg} aria-hidden focusable="false" viewBox="0 0 100 10" preserveAspectRatio="none" className="pointer-events-none absolute left-[-4%] top-1/2 h-[8px] w-[108%] -translate-y-1/2 overflow-visible"><Stroke d="M2 6 C 30 3, 65 7, 98 3" ink={ink} width={2} /></svg>
    </span>
  )
}
export function PencilBracket({ ink = 'graphite', height = 40 }: { ink?: Ink; height?: number }) {
  const svg = useRef<SVGSVGElement>(null)
  useDraw(svg)
  return <svg ref={svg} aria-hidden focusable="false" width={12} height={height} viewBox="0 0 12 40" preserveAspectRatio="none" className="inline-block overflow-visible"><Stroke d="M2 2 C 8 3, 7 14, 7 18 C 7 20, 11 20, 11 20 C 7 21, 7 24, 7 26 C 7 32, 8 38, 2 38" ink={ink} width={1.8} /></svg>
}

/** A highlighter swipe behind a phrase, exactly the phrase: a background drawn on
    the inline text itself, cloned on every line it wraps to, so it follows the words
    wherever they break. The colour is --highlight (multiplied on light paper). */
export function Highlight({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const el = useRef<HTMLSpanElement>(null)
  useGSAP(() => {
    if (reducedMotion() || !el.current) return
    gsap.fromTo(el.current, { backgroundSize: '0% 72%' }, { backgroundSize: '100% 72%', duration: 0.55, ease: 'power2.out', delay: 0.15 })
  }, { scope: el })
  return <span ref={el} className={`pencil-highlight ${className}`}>{children}</span>
}

/* ── an arrow from a note to what it is about ──
   Measured, not drawn by hand: `from` and `to` are refs to the note and its target,
   both inside `within` (a positioned box), and the arrow runs from the note's edge
   to the target's nearest edge, bending a little. Offsets are taken from the layout
   (offsetLeft/Top), so a tilted card does not skew them, and it is measured again
   whenever the box changes size. */
export function PencilArrow({ from, to, within, ink = 'moment' }: {
  from: React.RefObject<HTMLElement | null>; to: React.RefObject<HTMLElement | null>; within: React.RefObject<HTMLElement | null>; ink?: Ink
}) {
  const svg = useRef<SVGSVGElement>(null)
  const [geo, setGeo] = useState<{ w: number; h: number; d: string } | null>(null)
  // after paint, so every ref (the box is this arrow's parent) is attached
  useEffect(() => {
    const box = within.current
    if (!box) return
    // an element's box in `within`'s coordinates, walking offsetParents
    const rectIn = (el: HTMLElement) => {
      let x = 0, y = 0, n: HTMLElement | null = el
      while (n && n !== box) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent as HTMLElement | null }
      return { x, y, w: el.offsetWidth, h: el.offsetHeight }
    }
    const measure = () => {
      const a = from.current, b = to.current
      if (!a || !b) { setGeo(null); return }
      const A = rectIn(a), B = rectIn(b)
      // start at the note's side nearest the target, end just short of the target's edge
      const ax = A.x + A.w / 2, ay = A.y + A.h
      const bcx = B.x + B.w / 2, bcy = B.y + B.h / 2
      // a target below the note is reached at its top edge, nearest the note;
      // one level with it at the side facing the note
      const below = B.y > ay - 2
      // a target off to one side of the note starts at that end of the note, so the
      // arrow never runs under its own words
      const side = bcx < A.x ? -1 : bcx > A.x + A.w ? 1 : 0
      const sx = side < 0 ? A.x - 6 : side > 0 ? A.x + A.w + 6 : ax
      const sy = side ? A.y + A.h * 0.65 : ay + 3
      const ex = below ? Math.max(B.x + 12, Math.min(B.x + B.w - 12, sx)) : bcx > ax ? B.x - 6 : B.x + B.w + 6
      const ey = below ? B.y - 5 : bcy
      // a gentle bend, away from the straight line
      const mx = (sx + ex) / 2 + (ey - sy) * 0.25, my = (sy + ey) / 2 - Math.abs(ex - sx) * 0.12
      // the head: two short strokes back from the tip, along the curve's last direction
      const ang = Math.atan2(ey - my, ex - mx), L = 8
      const h1 = `${ex - L * Math.cos(ang - 0.5)} ${ey - L * Math.sin(ang - 0.5)}`
      const h2 = `${ex - L * Math.cos(ang + 0.5)} ${ey - L * Math.sin(ang + 0.5)}`
      setGeo({ w: box.offsetWidth, h: box.offsetHeight, d: `M${sx} ${sy} Q ${mx} ${my} ${ex} ${ey} M${h1} L ${ex} ${ey} L ${h2}` })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(box)
    if (from.current) ro.observe(from.current)
    if (to.current) ro.observe(to.current)
    window.addEventListener('resize', measure)
    return () => { ro.disconnect(); window.removeEventListener('resize', measure) }
  }, [from, to, within])
  useDraw(svg, [geo?.d])
  if (!geo) return null
  return (
    <svg ref={svg} aria-hidden focusable="false" width={geo.w} height={geo.h} viewBox={`0 0 ${geo.w} ${geo.h}`} className="pointer-events-none absolute left-0 top-0 z-[1] overflow-visible">
      <path
        data-ink d={geo.d} pathLength={1} strokeDasharray="1" fill="none" strokeWidth={2}
        strokeLinecap="round" strokeLinejoin="round" filter={`url(#${PENCIL_FILTER})`} className={`pencil ${STROKE[ink]}`}
      />
    </svg>
  )
}
