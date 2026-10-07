'use client'

import { Children, useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { reducedMotion } from '@/lib/prefs'
import { useStill } from './Still'

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
  // a still copy (a Deck's ghost) shows its marks already drawn and runs no tweens
  const still = useStill()
  useGSAP(() => {
    if (still || drawn.current || !scope.current) return
    const strokes = scope.current.querySelectorAll('[data-ink]')
    if (!strokes.length) return
    drawn.current = true
    if (reducedMotion()) return
    // an undrawn stroke is hidden, not just dashed away: a round cap still paints a
    // dot at offset 1. Each one shows the moment its own draw starts.
    gsap.set(strokes, { visibility: 'hidden' })
    strokes.forEach((s, i) => {
      gsap.fromTo(s, { strokeDashoffset: 1 }, {
        strokeDashoffset: 0, autoRound: false, duration: 0.6, ease: 'power2.out', delay: 0.1 + i * 0.18,
        onStart: () => { gsap.set(s, { visibility: 'visible' }) },
      })
    })
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

/* Every mark is drawn on a nominal box (100 wide) and fitted to the real one in
   pixels: a stretched viewBox would make the dash that draws the stroke cover only
   part of a long line (the stroke does not scale, the dash maths does), which is how
   a heading's underline came out short. So each mark measures the thing it marks
   (layout size, so a tilted card does not skew it) and scales its path to that. */
function fit(d: string, sx: number, sy: number) {
  let i = 0
  return d.replace(/-?\d*\.?\d+/g, (n) => String(Math.round(parseFloat(n) * (i++ % 2 ? sy : sx) * 100) / 100))
}
// the layout size of an element, kept current
function useBox(el: React.RefObject<HTMLElement | null>) {
  const [box, setBox] = useState<{ w: number; h: number } | null>(null)
  useEffect(() => {
    const n = el.current
    if (!n || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => {
      const w = n.offsetWidth, h = n.offsetHeight
      setBox((b) => (b && b.w === w && b.h === h ? b : { w, h }))
    })
    ro.observe(n)
    return () => ro.disconnect()
  }, [el])
  return box
}

/** A pencil underline under its word: two strokes, the full width of the word. */
export function PencilUnderline({ children, ink = 'accent', className = '' }: { children: React.ReactNode; ink?: Ink; className?: string }) {
  const svg = useRef<SVGSVGElement>(null)
  const word = useRef<HTMLSpanElement>(null)
  const box = useBox(word)
  // the line runs a little past each end of the word: 106% of it, 8px tall
  const w = box ? box.w * 1.06 : 0
  useDraw(svg, [w > 0])
  return (
    <span ref={word} className={`relative inline-block ${className}`}>
      {children}
      <svg ref={svg} aria-hidden focusable="false" viewBox={`0 0 ${w || 100} 8`} preserveAspectRatio="none" className="pointer-events-none absolute -bottom-[7px] -left-[3%] h-[8px] w-[106%] overflow-visible">
        {w > 0 && <>
          <Stroke d={fit('M1 6 C 25 3, 60 8, 99 4', w / 100, 0.8)} ink={ink} width={2.4} />
          <Stroke d={fit('M8 8 C 35 7, 65 9.5, 92 7.5', w / 100, 0.8)} ink={ink} width={1.3} opacity={0.6} />
        </>}
      </svg>
    </span>
  )
}

/** A loose hand-drawn ring around what it wraps, sized to its box. */
export function PencilCircle({ children, ink = 'accent', className = '' }: { children: React.ReactNode; ink?: Ink; className?: string }) {
  const svg = useRef<SVGSVGElement>(null)
  const inner = useRef<HTMLSpanElement>(null)
  const box = useBox(inner)
  // the ring's box: 12px past each side, 7px above and below
  const w = box ? box.w + 24 : 0, h = box ? box.h + 14 : 0
  useDraw(svg, [w > 0])
  return (
    <span ref={inner} className={`relative inline-block ${className}`}>
      {children}
      <svg ref={svg} aria-hidden focusable="false" viewBox={`0 0 ${w || 100} ${h || 40}`} preserveAspectRatio="none" className="pointer-events-none absolute -inset-x-[12px] -inset-y-[7px] h-[calc(100%+14px)] w-[calc(100%+24px)] overflow-visible">
        {w > 0 && <Stroke d={fit('M54 3 C 86 2, 100 12, 97 22 C 93 35, 30 39, 9 30 C -3 22, 10 4, 48 3 L 64 6', w / 100, h / 40)} ink={ink} width={2} />}
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
  const word = useRef<HTMLSpanElement>(null)
  const box = useBox(word)
  const w = box ? box.w * 1.08 : 0
  useDraw(svg, [w > 0])
  return (
    <span ref={word} className="relative inline-block">
      {children}
      <svg ref={svg} aria-hidden focusable="false" viewBox={`0 0 ${w || 100} 8`} preserveAspectRatio="none" className="pointer-events-none absolute left-[-4%] top-1/2 h-[8px] w-[108%] -translate-y-1/2 overflow-visible">
        {w > 0 && <Stroke d={fit('M2 6 C 30 3, 65 7, 98 3', w / 100, 0.8)} ink={ink} width={2} />}
      </svg>
    </span>
  )
}
export function PencilBracket({ ink = 'graphite', height = 40 }: { ink?: Ink; height?: number }) {
  const svg = useRef<SVGSVGElement>(null)
  useDraw(svg)
  return <svg ref={svg} aria-hidden focusable="false" width={12} height={height} viewBox="0 0 12 40" preserveAspectRatio="none" className="inline-block overflow-visible"><Stroke d="M2 2 C 8 3, 7 14, 7 18 C 7 20, 11 20, 11 20 C 7 21, 7 24, 7 26 C 7 32, 8 38, 2 38" ink={ink} width={1.8} /></svg>
}

/* ── the highlighter: a marker pass over a phrase ──
   One soft, slightly uneven shape per line the phrase sits on, from just above the
   capitals to just under the baseline and a little past each end, so the whole word
   reads as marked (not as selected text, which is a hard full-height box). The words
   are measured from the layout (offsets, so a tilted card does not skew them),
   grouped into lines, and measured again when anything around them changes size.
   The shape is drawn behind the words in --highlight (multiplied on light paper) and
   swipes in left to right once; under reduced motion it is simply there. */

// a phrase made of plain text is split into words, so each line it wraps to gets its
// own shape; anything richer is measured as one piece
function asWords(children: React.ReactNode): React.ReactNode {
  const parts = Children.toArray(children)
  if (!parts.every((p) => typeof p === 'string' || typeof p === 'number')) return <span data-hl-word className="relative">{children}</span>
  return parts.join('').split(/(\s+)/).map((t, i) => (!t || /^\s+$/.test(t) ? t : <span key={i} data-hl-word className="relative">{t}</span>))
}
// a steady wobble for line i, so the same phrase keeps the same shape
function wob(i: number, k: number) {
  const x = Math.sin((i * 7 + 3) * 12.9898 + k * 78.233) * 43758.5453
  return x - Math.floor(x) - 0.5
}
function markerShape(ln: { l: number; r: number; t: number; h: number }, i: number) {
  const ext = ln.h * 0.07
  const x0 = ln.l - ext, x1 = ln.r + ext
  const y0 = ln.t + ln.h * 0.15, y1 = ln.t + ln.h * 0.86
  const H = y1 - y0, W = x1 - x0, r = H * 0.45, a = H * 0.08
  const n = (v: number) => Math.round(v * 10) / 10
  const startY = y0 + a * 0.6 + a * wob(i, 1)
  return [
    `M${n(x0 + r * 0.5)} ${n(startY)}`,
    `C${n(x0 + W * 0.35)} ${n(y0 - a * 0.5 + a * wob(i, 2))} ${n(x0 + W * 0.65)} ${n(y0 + a * 0.4 + a * wob(i, 3))} ${n(x1 - r * 0.4)} ${n(y0 - a * 0.3)}`,
    `C${n(x1 + r * 0.35)} ${n(y0 + H * 0.05)} ${n(x1 + r * 0.3)} ${n(y1 - H * 0.12)} ${n(x1 - r * 0.5)} ${n(y1 + a * 0.2 + a * wob(i, 4))}`,
    `C${n(x0 + W * 0.6)} ${n(y1 + a * 0.6 + a * wob(i, 5))} ${n(x0 + W * 0.3)} ${n(y1 - a * 0.4)} ${n(x0 + r * 0.4)} ${n(y1 + a * 0.3)}`,
    `C${n(x0 - r * 0.35)} ${n(y1 - H * 0.1)} ${n(x0 - r * 0.25)} ${n(y0 + H * 0.15)} ${n(x0 + r * 0.5)} ${n(startY)}Z`,
  ].join(' ')
}

/** A highlighter swipe over a phrase: the whole of each word, line by line. */
export function Highlight({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const el = useRef<HTMLSpanElement>(null)
  const svg = useRef<SVGSVGElement>(null)
  const [paths, setPaths] = useState<string[] | null>(null)
  useEffect(() => {
    const root = el.current
    if (!root) return
    let raf = 0
    const measure = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        // offsets share one frame with the shape: both are placed in the nearest
        // positioned ancestor (the words are relative, but only to sit above it)
        const lines: { l: number; r: number; t: number; h: number }[] = []
        for (const w of root.querySelectorAll<HTMLElement>('[data-hl-word]')) {
          const l = w.offsetLeft, t = w.offsetTop, h = w.offsetHeight, r = l + w.offsetWidth
          const line = lines.find((x) => Math.abs(x.t - t) < h / 2)
          if (line) { line.l = Math.min(line.l, l); line.r = Math.max(line.r, r) } else lines.push({ l, r, t, h })
        }
        const next = lines.map(markerShape)
        setPaths((p) => (p && p.join() === next.join() ? p : next))
      })
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (root.parentElement) ro.observe(root.parentElement)
    if (root.offsetParent) ro.observe(root.offsetParent)
    window.addEventListener('resize', measure)
    document.fonts?.ready.then(measure).catch(() => {})
    return () => { cancelAnimationFrame(raf); ro.disconnect(); window.removeEventListener('resize', measure) }
  }, [children])
  // swipes in once, the first time it is measured (a still copy shows it already laid)
  const drawn = useRef(false)
  const still = useStill()
  useGSAP(() => {
    if (still || drawn.current || !paths || !svg.current) return
    drawn.current = true
    if (reducedMotion()) return
    gsap.fromTo(svg.current.querySelectorAll('path'), { scaleX: 0, transformOrigin: '0% 50%' }, { scaleX: 1, duration: 0.55, ease: 'power2.out', stagger: 0.2, delay: 0.15 })
  }, { scope: svg, dependencies: [paths !== null] })
  return (
    <span ref={el} className={`pencil-highlight ${className}`}>
      {/* before the words, so the words paint over it */}
      <svg ref={svg} aria-hidden focusable="false" width="1" height="1" className="pencil-highlight-ink pointer-events-none absolute left-0 top-0 overflow-visible">
        {paths?.map((d, i) => <path key={i} d={d} style={{ fill: 'var(--highlight)' }} />)}
      </svg>
      {asWords(children)}
    </span>
  )
}

/* ── an arrow from a note to what it is about ──
   Measured, not drawn by hand: `from` and `to` are refs to the note and its target,
   both inside `within` (a positioned box), and the arrow runs from the note's edge
   to the target's nearest edge, bending a little. Offsets are taken from the layout
   (offsetLeft/Top), so a tilted card does not skew them, and it is measured again
   whenever the box changes size. */
export function PencilArrow({ from, to, within, ink = 'moment', max }: {
  from: React.RefObject<HTMLElement | null>; to: React.RefObject<HTMLElement | null>; within: React.RefObject<HTMLElement | null>; ink?: Ink
  // the longest the arrow may run, in px: past it the arrow is left out rather than
  // stretched across the page (the layout is meant to keep the note close)
  max?: number
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
      // a target above the note: from the note's top up to the target's bottom edge
      if (B.y + B.h < A.y + 2) {
        const tx = ax, ty = A.y - 4
        const hx = Math.max(B.x + 12, Math.min(B.x + B.w - 12, tx)), hy = B.y + B.h + 5
        const qx = (tx + hx) / 2 + (hy - ty) * 0.25, qy = (ty + hy) / 2
        const ang0 = Math.atan2(hy - qy, hx - qx), L0 = 8
        const g1 = `${hx - L0 * Math.cos(ang0 - 0.5)} ${hy - L0 * Math.sin(ang0 - 0.5)}`
        const g2 = `${hx - L0 * Math.cos(ang0 + 0.5)} ${hy - L0 * Math.sin(ang0 + 0.5)}`
        if (max && Math.hypot(hx - tx, hy - ty) > max) { setGeo(null); return }
        setGeo({ w: box.offsetWidth, h: box.offsetHeight, d: `M${tx} ${ty} Q ${qx} ${qy} ${hx} ${hy} M${g1} L ${hx} ${hy} L ${g2}` })
        return
      }
      // a target off to one side of the note starts at that end of the note, so the
      // arrow never runs under its own words
      const side = bcx < A.x ? -1 : bcx > A.x + A.w ? 1 : 0
      const sx = side < 0 ? A.x - 6 : side > 0 ? A.x + A.w + 6 : ax
      const sy = side ? A.y + A.h * 0.65 : ay + 3
      // below and off to one side (the note up beside its button, as on a phone): aim in
      // toward the target's middle rather than straight down at its near end, so the
      // arrow reads as one rather than a short tick
      const aimX = side ? bcx + (sx - bcx) * 0.2 : sx
      const ex = below ? Math.max(B.x + 12, Math.min(B.x + B.w - 12, aimX)) : bcx > ax ? B.x - 6 : B.x + B.w + 6
      const ey = below ? B.y - 5 : bcy
      // a gentle bend, away from the straight line
      const mx = (sx + ex) / 2 + (ey - sy) * 0.25, my = (sy + ey) / 2 - Math.abs(ex - sx) * 0.12
      // the head: two short strokes back from the tip, along the curve's last direction
      const ang = Math.atan2(ey - my, ex - mx), L = 8
      const h1 = `${ex - L * Math.cos(ang - 0.5)} ${ey - L * Math.sin(ang - 0.5)}`
      const h2 = `${ex - L * Math.cos(ang + 0.5)} ${ey - L * Math.sin(ang + 0.5)}`
      if (max && Math.hypot(ex - sx, ey - sy) > max) { setGeo(null); return }
      setGeo({ w: box.offsetWidth, h: box.offsetHeight, d: `M${sx} ${sy} Q ${mx} ${my} ${ex} ${ey} M${h1} L ${ex} ${ey} L ${h2}` })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(box)
    if (from.current) ro.observe(from.current)
    if (to.current) ro.observe(to.current)
    window.addEventListener('resize', measure)
    return () => { ro.disconnect(); window.removeEventListener('resize', measure) }
  }, [from, to, within, max])
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

/* ── the hover underline: a lighter pencil line under a tab you are pointing at ──
   Thinner, graphite (--pencil-hover), and its own stroke, so it never reads as the
   selected tab's underline. It sketches in left to right when a mouse rests on the
   tab or the keyboard focuses it, and rubs out right to left when it leaves. Each
   move overwrites the last, so sweeping across the tabs never leaves half a line
   behind. Touch screens get nothing; reduced motion shows and hides it at once.
   It listens on the element it sits in (the tab), takes no pointer, and is placed
   absolutely, so the tab's size never changes. */
export function PencilHover({ children }: { children: React.ReactNode }) {
  const root = useRef<HTMLSpanElement>(null)
  const { contextSafe } = useGSAP({ scope: root })
  useEffect(() => {
    const tab = root.current?.parentElement
    const path = root.current?.querySelector('path')
    if (!tab || !path) return
    const canHover = window.matchMedia('(hover: hover) and (pointer: fine)')
    const show = contextSafe((on: boolean) => {
      const to = on ? 0 : 1
      // hidden whenever it is fully rubbed out: a round cap at offset 1 still paints a dot
      if (reducedMotion()) { gsap.set(path, { strokeDashoffset: to, visibility: on ? 'visible' : 'hidden', overwrite: true }); return }
      if (on) gsap.set(path, { visibility: 'visible' })
      gsap.to(path, {
        strokeDashoffset: to, autoRound: false, duration: on ? 0.25 : 0.15, ease: on ? 'power1.out' : 'power1.in', overwrite: true,
        onComplete: on ? undefined : () => { gsap.set(path, { visibility: 'hidden' }) },
      })
    })
    const enter = (e: PointerEvent) => { if (e.pointerType === 'mouse' && canHover.matches) show(true) }
    const leave = (e: PointerEvent) => { if (e.pointerType === 'mouse' && !tab.matches(':focus-visible')) show(false) }
    const focus = () => { if (tab.matches(':focus-visible')) show(true) }
    const blur = () => { if (!tab.matches(':hover')) show(false) }
    tab.addEventListener('pointerenter', enter)
    tab.addEventListener('pointerleave', leave)
    tab.addEventListener('focus', focus)
    tab.addEventListener('blur', blur)
    return () => {
      tab.removeEventListener('pointerenter', enter)
      tab.removeEventListener('pointerleave', leave)
      tab.removeEventListener('focus', focus)
      tab.removeEventListener('blur', blur)
    }
  }, [contextSafe])
  const box = useBox(root)
  const w = box ? box.w * 0.96 : 100
  return (
    <span ref={root} className="relative inline-block">
      {children}
      <svg aria-hidden focusable="false" viewBox={`0 0 ${w} 7`} preserveAspectRatio="none" className="pointer-events-none absolute -bottom-[6px] left-[2%] h-[7px] w-[96%] overflow-visible">
        <path
          data-hover-ink d={fit('M2 5 C 22 7, 48 3.5, 70 5.5 S 92 4, 98 5.5', w / 100, 0.7)} pathLength={1} strokeDasharray="1" strokeDashoffset="1" visibility="hidden" fill="none"
          strokeWidth={1.4} strokeLinecap="round" vectorEffect="non-scaling-stroke" filter={`url(#${PENCIL_FILTER})`}
          className="pencil stroke-pencil-hover" opacity={0.75}
        />
      </svg>
    </span>
  )
}
