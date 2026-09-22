'use client'

/* ── the shared shell of a landing vignette ──
   A small product frame that knows when it is on screen. Each vignette plays a
   short script as it arrives, hands over to the visitor at their first touch, and
   resets itself once it has scrolled away so the next arrival plays again. The
   ghost cursor is shared too: it walks a GSAP timeline to real elements inside
   the frame, so the script and the visitor act on the same things. */

import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { MousePointer2, RotateCcw } from 'lucide-react'
import { reducedMotion } from '@/lib/prefs'

export function prefersReducedMotion(): boolean {
  return reducedMotion()
}

/** Is the element on screen (and has it ever been)? `near` mounts early; `inView`
 *  starts and stops the script. */
export function useInView<T extends HTMLElement>(margin = '160px') {
  const ref = useRef<T>(null)
  const [near, setNear] = useState(false)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const a = new IntersectionObserver(([e]) => { if (e.isIntersecting) setNear(true) }, { rootMargin: margin })
    const b = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.45 })
    a.observe(el); b.observe(el)
    return () => { a.disconnect(); b.disconnect() }
  }, [margin])
  return { ref, near, inView }
}

/** Move the ghost cursor to the centre of an element, measured against the box the
 *  cursor is positioned in. Adds the tween to the timeline. */
export function cursorTo(t: gsap.core.Timeline, cursor: HTMLElement, target: HTMLElement | null, duration = 0.5, position?: gsap.Position) {
  const box = cursor.offsetParent as HTMLElement | null
  if (!target || !box) return
  const c = target.getBoundingClientRect(), b = box.getBoundingClientRect()
  t.to(cursor, { duration, ease: 'power2.inOut', x: c.left - b.left + c.width / 2, y: c.top - b.top + c.height / 2 }, position)
}

export function GhostCursor({ cursorRef, pressing }: { cursorRef: React.RefObject<HTMLDivElement | null>; pressing: boolean }) {
  return (
    <div ref={cursorRef} className="pointer-events-none absolute left-0 top-0 z-[6] -translate-x-1 -translate-y-1 opacity-0 text-text drop-shadow-sm">
      <span className={`absolute -left-2.5 -top-2.5 h-9 w-9 rounded-full bg-accent/25 transition-opacity duration-150 ${pressing ? 'opacity-100' : 'opacity-0'}`} aria-hidden />
      <MousePointer2 size={18} fill="var(--s1)" className="relative" />
    </div>
  )
}

/** The frame: browser chrome on top, a footer with the "try it" note and a reset. */
export function VignetteFrame({ url, hint, taken, onReset, children, frameRef, className = '' }: {
  url: string
  hint: string
  taken: boolean // the visitor has taken over from the script
  onReset: () => void
  children: React.ReactNode
  frameRef?: React.Ref<HTMLDivElement>
  className?: string
}) {
  return (
    <div ref={frameRef} className={`relative overflow-hidden rounded-2xl border border-border bg-s1 shadow-soft ${className}`}>
      <div className="flex items-center gap-2 border-b border-border bg-s0 px-3 py-2">
        <span className="flex gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-s3" /><i className="h-2.5 w-2.5 rounded-full bg-s3" /><i className="h-2.5 w-2.5 rounded-full bg-s3" /></span>
        <span className="ml-1 flex h-6 flex-1 items-center rounded-md bg-s2 px-2.5 font-mono text-[11px] text-faint">{url}</span>
      </div>
      {children}
      <div className="flex items-center justify-between gap-3 border-t border-border bg-s0 px-3 py-2">
        <span className="min-w-0 truncate text-[12px] text-dim">{taken ? 'This one is yours to play with.' : hint}</span>
        <button type="button" onClick={onReset} className="flex h-7 flex-none items-center gap-1 rounded-[7px] border border-border bg-s1 px-2 text-[12px] font-medium text-dim hover:border-border2 hover:text-text">
          <RotateCcw size={12} /> Reset
        </button>
      </div>
    </div>
  )
}
