'use client'

import { useRef, useState } from 'react'
import { Check } from 'lucide-react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { reducedMotion } from '@/lib/prefs'

// how long after the lock-in the card still celebrates it: long enough for the host
// who pressed the button and anyone watching live, short enough that a later visit
// just sees the plan
const FRESH_MS = 90_000
// the little burst around the check: drawn dots, evenly spread, two sizes
const SPARKS = Array.from({ length: 8 }, (_, i) => ({ a: (i / 8) * Math.PI * 2 + 0.2, big: i % 2 === 0 }))

/* The one celebration in the app, in the moment colour: a plan just locked in. A
   check pops, a few dots burst off it, and the line says so. Shown only in the
   first minute and a half after the lock; with less motion on, it simply sits there. */
export function JustLocked({ confirmedAt }: { confirmedAt?: number }) {
  // read once on mount: the card should not vanish mid-look when the minute runs out
  const [fresh] = useState(() => !!confirmedAt && Date.now() - confirmedAt < FRESH_MS)
  const root = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    if (!fresh || reducedMotion()) return
    const q = gsap.utils.selector(root)
    const tl = gsap.timeline()
    tl.fromTo(root.current, { y: 6, opacity: 0 }, { y: 0, opacity: 1, duration: 0.3, ease: 'power2.out' })
      .fromTo(q('[data-check]'), { scale: 0.4, rotate: -20 }, { scale: 1, rotate: 0, duration: 0.55, ease: 'back.out(2.4)' }, '-=0.1')
    q('[data-spark]').forEach((el, i) => {
      const s = SPARKS[i]
      const r = s.big ? 24 : 20
      tl.fromTo(el, { x: 0, y: 0, scale: 0.4, opacity: 1 },
        { x: Math.cos(s.a) * r, y: Math.sin(s.a) * r, scale: 1, opacity: 0, duration: 0.7, ease: 'power2.out' }, '<0.01')
    })
  }, { scope: root, dependencies: [fresh] })

  if (!fresh) return null
  return (
    <div ref={root} className="mb-4 flex items-center gap-3 rounded-xl border border-moment-border bg-moment-bg px-4 py-3">
      <span className="relative grid h-9 w-9 flex-none place-items-center">
        {SPARKS.map((s, i) => (
          <span key={i} data-spark aria-hidden className={`absolute left-1/2 top-1/2 -ml-[3px] -mt-[3px] rounded-full bg-moment opacity-0 ${s.big ? 'h-1.5 w-1.5' : 'h-1 w-1'}`} />
        ))}
        <span data-check className="relative grid h-9 w-9 place-items-center rounded-full bg-moment text-on-accent">
          <Check size={19} strokeWidth={2.6} aria-hidden />
        </span>
      </span>
      <div className="min-w-0">
        <p className="font-serif text-[20px] leading-tight text-moment-text">It&apos;s on</p>
        <p className="text-[13px] text-moment-text">Locked in just now.</p>
      </div>
    </div>
  )
}
