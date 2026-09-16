'use client'

/* ── a day poll, live ──
   Two weeks of whole days for a weekend away. Everyone else's days are already in,
   faded; the ghost cursor taps the host's as the frame arrives, and once it has
   finished the calendar is the visitor's to tap. The readout finds the longest run
   of days everyone can make, from the real counts, every render. */

import { useRef, useState } from 'react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { CalendarRange } from 'lucide-react'
import { cursorTo, GhostCursor, prefersReducedMotion, useInView, VignetteFrame } from './Vignette'

// Sunday first, and laid out on real weeks, because that is what the app draws: day 0 is
// a Monday, so it sits in the second column and the row before it is empty.
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const COL = (n: number) => n + 1 // day n's place in a Sunday-first fortnight
// two weeks from Mon Aug 20: day n is Aug 20 + n
const DAYS = Array.from({ length: 14 }, (_, n) => ({ n, day: n < 12 ? 20 + n : n - 11, month: n < 12 ? 'Aug' : 'Sep' }))
// who can make which days: the host's script taps 4, 5, 6 and 12 (Fri–Sun, then Sat)
const OTHERS: number[][] = [
  [4, 5, 6, 11, 12],
  [3, 4, 5, 6, 12, 13],
  [4, 5, 6, 7],
  [0, 4, 5, 6, 12],
  [4, 5, 6, 10, 11, 12],
]
const SCRIPT = [4, 5, 6, 12]
const TOTAL = OTHERS.length + 1
const OTHER_COUNTS: number[] = Array(14).fill(0)
for (const days of OTHERS) for (const n of days) OTHER_COUNTS[n]++
const heatOf = (n: number) => (n === 0 ? 'var(--s2)' : n / TOTAL <= 0.25 ? 'var(--heat-low)' : n / TOTAL <= 0.5 ? 'var(--heat-mid)' : n < TOTAL ? 'var(--heat-high)' : 'var(--heat-full)')
const label = (n: number) => `${DOW[COL(n) % 7]} ${DAYS[n].month} ${DAYS[n].day}`

export function DayPollDemo() {
  const { ref, near, inView } = useInView<HTMLDivElement>()
  const cursor = useRef<HTMLDivElement>(null)
  const grid = useRef<HTMLDivElement>(null)
  const [mine, setMine] = useState<Set<number>>(new Set())
  const [done, setDone] = useState(false)
  const [taken, setTaken] = useState(false)
  const [pressing, setPressing] = useState(false)
  const [run, setRun] = useState(0)

  // the script plays each time the frame arrives (and on Reset); the calendar is
  // locked until it has finished
  useGSAP(() => {
    if (!inView || !cursor.current) return
    if (prefersReducedMotion()) { setMine(new Set(SCRIPT)); setDone(true); return }
    const cur = cursor.current
    const cellAt = (n: number) => grid.current?.querySelector<HTMLElement>(`[data-day="${n}"]`) ?? null
    const t = gsap.timeline({ delay: 0.4 })
    t.call(() => { setMine(new Set()); setDone(false) }, [], 0.01)
    t.set(cur, { opacity: 1, x: 40, y: 20 })
    SCRIPT.forEach((n, i) => {
      cursorTo(t, cur, cellAt(n), i === 0 ? 0.6 : 0.45)
      t.to(cur, { scale: 0.85, duration: 0.1 }).call(() => { setPressing(true); setMine((s) => new Set(s).add(n)) })
        .call(() => setPressing(false), [], '+=0.12').to(cur, { scale: 1, duration: 0.1 })
    })
    t.to(cur, { opacity: 0, duration: 0.3, delay: 0.3 }).call(() => setDone(true))
    return () => { t.kill(); gsap.set(cur, { opacity: 0 }); setPressing(false) }
  }, { dependencies: [inView, run], revertOnUpdate: true })

  // out of sight: back to the start, so the next arrival plays again
  useGSAP(() => {
    if (inView) return
    const t = setTimeout(() => { setTaken(false); setDone(false); setMine(new Set()) }, 600)
    return () => clearTimeout(t)
  }, { dependencies: [inView] })

  const tap = (n: number) => {
    if (!done) return
    setTaken(true)
    setMine((s) => { const next = new Set(s); if (next.has(n)) next.delete(n); else next.add(n); return next })
  }
  const reset = () => { setTaken(false); setDone(false); setMine(new Set()); setRun((r) => r + 1) }

  const count = (n: number) => OTHER_COUNTS[n] + (mine.has(n) ? 1 : 0)
  // the longest run of consecutive days everyone can make; failing that, the best day
  let best: { s: number; e: number; n: number } | null = null
  for (let s = 0; s < 14; s++) {
    let e = s
    while (e + 1 < 14 && count(e + 1) === TOTAL && count(s) === TOTAL) e++
    if (count(s) === TOTAL && (!best || e - s > best.e - best.s)) best = { s, e, n: TOTAL }
  }
  if (!best) { const top = DAYS.reduce((b, d) => (count(d.n) > count(b) ? d.n : b), 0); if (count(top) > 0) best = { s: top, e: top, n: count(top) } }

  return (
    <div ref={ref}>
      <VignetteFrame url="hourelle.app/e/cabin-weekend" hint={!done ? 'Watch first. It is yours in a moment.' : 'Tap the days you could make.'} taken={taken} onReset={reset}>
        <div className="relative select-none p-4 sm:p-5">
          {near && (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[.13em] text-faint">Which days could you make?</p>
                  {/* the month lives here, not in the cells */}
                  <p className="mt-0.5 text-[12.5px] text-dim">Mon, Aug 20 to Sun, Sep 2</p>
                </div>
                <span className="flex-none text-[12px] text-dim">{mine.size > 0 ? TOTAL : TOTAL - 1} of {TOTAL} answered</span>
              </div>
              {/* the calendar the app actually draws: weekday columns, ruled cells sharing
                  their hairlines, weeks running on so a stretch of days is never cut in half,
                  and the month named only where it turns */}
              <div ref={grid} className="mt-3 grid overflow-hidden rounded-[8px] border border-border" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
                {DOW.map((d) => (
                  <span key={d} className="border-b border-r border-grid-edge bg-s0 py-1.5 text-center text-[10.5px] font-semibold uppercase tracking-[.06em] text-dim last:border-r-0">
                    <span className="sm:hidden">{d[0]}</span><span className="hidden sm:inline">{d}</span>
                  </span>
                ))}
                {Array.from({ length: 21 }, (_, p) => {
                  const n = p - 1 // the leading Sunday is empty; day 0 is the Monday beside it
                  const d = n >= 0 && n < DAYS.length ? DAYS[n] : null
                  const last = p % 7 === 6
                  if (!d) return <span key={p} className={`h-12 border-b border-r border-border bg-s0 ${last ? 'border-r-0' : ''}`} aria-hidden />
                  const isMine = mine.has(n), others = OTHER_COUNTS[n], total = count(n)
                  const inBest = !!best && n >= best.s && n <= best.e
                  const joins = (k: number) => !!best && k >= best.s && k <= best.e && Math.floor(COL(k) / 7) === Math.floor(COL(n) / 7)
                  const turn = n === 0 || DAYS[n - 1].month !== d.month
                  return (
                    <button
                      key={p} type="button" data-day={n} onClick={() => tap(n)} aria-pressed={isMine} disabled={!done} aria-label={label(n)}
                      className={`relative h-12 border-b border-r border-grid-line text-left ${last ? 'border-r-0' : ''} ${done ? 'cursor-pointer' : 'cursor-default'}`}
                      style={{ background: heatOf(others) }}
                    >
                      {/* your own day is clay over the crowd's green, the way the grid marks it */}
                      {isMine && (
                        <span
                          className="pointer-events-none absolute inset-0"
                          style={{ background: 'var(--you-some)', border: '1.5px solid #7A531F', boxShadow: pressing ? 'inset 0 0 0 2px rgba(255,255,255,.45)' : 'inset 0 0 0 1px rgba(255,255,255,.35)' }}
                        />
                      )}
                      {inBest && (
                        <span
                          className="pointer-events-none absolute inset-0 z-[2]"
                          style={{
                            borderTop: '2.5px solid var(--ochre)', borderBottom: '2.5px solid var(--ochre)',
                            borderLeft: joins(n - 1) ? undefined : '2.5px solid var(--ochre)',
                            borderRight: joins(n + 1) ? undefined : '2.5px solid var(--ochre)',
                          }}
                        />
                      )}
                      <span className="pointer-events-none absolute left-1.5 top-1 z-[1] flex flex-col leading-none">
                        <span className="h-[9px] text-[8.5px] font-semibold uppercase leading-[9px] tracking-[.08em] text-faint">{turn ? d.month : ''}</span>
                        <span className="text-[12.5px] font-semibold tabular-nums" style={{ color: isMine ? 'var(--you-text)' : 'var(--text)' }}>{d.day}</span>
                      </span>
                      {total > 0 && (
                        <span className="pointer-events-none absolute bottom-1 right-1.5 z-[2] text-[9px] font-bold" style={{ color: isMine ? 'var(--you-text)' : 'var(--heat-count)' }}>
                          {total}/{TOTAL}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
              <p className="mt-3 flex flex-wrap items-center gap-x-1.5 text-[12.5px]">
                <CalendarRange size={13} className="text-ochre" />
                {best
                  ? best.n === TOTAL
                    ? <><span className="font-semibold text-ochre">{best.e > best.s ? `${label(best.s)} to ${label(best.e)}` : label(best.s)}</span><span className="text-dim">everyone can make it</span></>
                    : <><span className="font-semibold text-ochre">{label(best.s)}</span><span className="text-dim">{best.n} of {TOTAL} can make it</span></>
                  : <span className="text-dim">Tap a few days to see what works.</span>}
              </p>
              <GhostCursor cursorRef={cursor} pressing={pressing} />
            </>
          )}
        </div>
      </VignetteFrame>
    </div>
  )
}
