'use client'

import { useRef, useState } from 'react'
import { Check } from 'lucide-react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { reducedMotion } from '@/lib/prefs'
import { DUR, EASE, arcTo, squashLand } from '@/lib/motion'
import { Tape } from '@/components/ui/Tape'

// how long after the lock-in the card still celebrates it: long enough for the host
// who pressed the button and anyone watching live, short enough that a later visit
// just sees the plan
const FRESH_MS = 90_000
// the little burst around the check: drawn dots, evenly spread, two sizes
const SPARKS = Array.from({ length: 8 }, (_, i) => ({ a: (i / 8) * Math.PI * 2 + 0.2, big: i % 2 === 0 }))

/* The one celebration in the app, in the confirmed colour (teal, the role for a
   locked-in plan; coral read too close to the red of an error): a plan just locked in. A
   check pops, a few dots burst off it, and the line says so. Shown only in the
   first minute and a half after the lock; with less motion on, it simply sits there. */
export function JustLocked({ confirmedAt }: { confirmedAt?: number }) {
  // read once on mount: the card should not vanish mid-look when the minute runs out
  const [fresh] = useState(() => !!confirmedAt && Date.now() - confirmedAt < FRESH_MS)
  const root = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    if (!fresh || reducedMotion()) return
    const q = gsap.utils.selector(root)
    const check = q('[data-check]')
    // one thing at a time, so the eye follows: the card swings forward off the page
    // (it has depth: hinged at its tape, tipped back), then the check gathers itself,
    // jumps and lands, the sparks fly off it on curves and fall a little, and only
    // then the words come in, the second line trailing the first
    const tl = gsap.timeline()
    tl.fromTo(root.current, { opacity: 0, y: 10, rotateX: -38, transformPerspective: 700, transformOrigin: '50% 0%' },
      { opacity: 1, y: 0, rotateX: 0, duration: 0.45, ease: EASE.settle })
      .set(q('[data-line]'), { opacity: 0 }, 0)
      .set(check, { scale: 0.6, rotate: -20 }, 0)
      // the wind-up: a squat before the jump
      .to(check, { y: 2, scaleX: 0.62, scaleY: 0.45, duration: DUR.windUp, ease: 'power1.out' }, '-=0.2')
      // the jump: stretched tall as it rises, round again at the top
      .to(check, { y: -12, scaleX: 0.92, scaleY: 1.25, rotate: 0, duration: 0.16, ease: 'power2.out' })
      .to(check, { y: 0, scaleX: 1, scaleY: 1, duration: 0.15, ease: 'power2.in' })
      .addLabel('land')
    squashLand(tl, check, 'land', 1.2)
    q('[data-spark]').forEach((el, i) => {
      const sp = SPARKS[i]
      // pushed past real: they fly further than a dot this size would
      const r = sp.big ? 32 : 26
      tl.set(el, { x: 0, y: 0, scale: 0.4, opacity: 1 }, 'land')
      arcTo(tl, el, { x: Math.cos(sp.a) * r, y: Math.sin(sp.a) * r + 8, lift: 10, duration: 0.65, at: 'land' })
      tl.to(el, { scale: 1, duration: 0.2, ease: 'power2.out' }, 'land')
        .to(el, { opacity: 0, duration: 0.3, ease: 'power1.in' }, 'land+=0.35')
    })
    tl.fromTo(q('[data-line]'), { opacity: 0, x: -10 }, { opacity: 1, x: 0, duration: 0.32, ease: EASE.settle, stagger: 0.08 }, 'land+=0.08')
  }, { scope: root, dependencies: [fresh] })

  if (!fresh) return null
  // a note taped to the top of the locked-in card, tilted a degree: the one moment
  // on this page that gets the scrapbook touch. It holds no buttons, so the tilt
  // never moves anything you tap, and the answers below it stay straight.
  return (
    <div ref={root} className="relative mb-5 mt-1 flex w-fit max-w-full -rotate-1 items-center gap-3 rounded-xl border border-teal-border bg-teal-bg py-3 pl-4 pr-6">
      <Tape className="-top-2.5 left-1/2 -ml-8" tilt={-4} width={64} />
      <span className="relative grid h-9 w-9 flex-none place-items-center">
        {SPARKS.map((s, i) => (
          <span key={i} data-spark aria-hidden className={`absolute left-1/2 top-1/2 -ml-[3px] -mt-[3px] rounded-full bg-teal opacity-0 ${s.big ? 'h-1.5 w-1.5' : 'h-1 w-1'}`} />
        ))}
        <span data-check className="relative grid h-9 w-9 place-items-center rounded-full bg-teal text-on-accent">
          <Check size={19} strokeWidth={2.6} aria-hidden />
        </span>
      </span>
      <div className="min-w-0">
        <p data-line className="font-serif text-[20px] leading-tight text-teal-text">It&apos;s on</p>
        <p data-line className="font-serif text-[14px] italic text-teal-text">Locked in just now.</p>
      </div>
    </div>
  )
}
