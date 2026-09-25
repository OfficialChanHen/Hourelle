'use client'

import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { reducedMotion } from '@/lib/prefs'

export type WeekChip = { label: string; count: number; you: boolean }

/* ── the week strip ──
   One segment per week of a poll that runs over several, on a single track like the
   app's SegmentedControl: the week on screen is the raised pill, and the pill slides
   when the week changes. Under each range, a hairline shows how much of the list has
   answered that week, next to the plain count.

   It is a tab list over the grid (the grid is the tab panel), so the keyboard gets
   one stop and Left/Right/Home/End walk the weeks. Selection follows focus: the
   weeks are cheap to switch and there is nothing to confirm.

   On a phone it scrolls sideways inside itself, never the page, snapping chip by
   chip, and the chip on screen is scrolled into view whenever the week changes from
   anywhere (a tap, a key, or a jump to the best time). */
export function WeekStrip({ weeks, total, value, onChange, idBase, panelId }: {
  weeks: WeekChip[]
  total: number // everyone on the list, the bar's whole
  value: number // index of the week on screen
  onChange: (i: number) => void
  idBase: string // tab ids are `${idBase}-${i}`, so the panel can name its tab
  panelId: string // the grid the tabs control
}) {
  const scroller = useRef<HTMLDivElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const pill = useRef<HTMLSpanElement>(null)
  const tabs = useRef<(HTMLButtonElement | null)[]>([])
  const first = useRef(true)

  function position(animate: boolean) {
    const el = tabs.current[value], p = pill.current, t = track.current
    if (!el || !p || !t) return
    // measured against the track the pill lives in, so the strip's own scroll
    // offset never enters the sum
    const er = el.getBoundingClientRect(), tr = t.getBoundingClientRect()
    const to = { x: er.left - tr.left, y: er.top - tr.top, width: er.width, height: er.height }
    if (animate && !reducedMotion()) gsap.to(p, { ...to, duration: 0.34, ease: 'power3.out', overwrite: true })
    else gsap.set(p, { ...to, overwrite: true })
  }

  // keep the chip on screen in view. Scrolls the strip only: scrollIntoView would
  // also move the page to reach it
  function reveal(animate: boolean) {
    const s = scroller.current, el = tabs.current[value]
    if (!s || !el) return
    const sr = s.getBoundingClientRect(), er = el.getBoundingClientRect()
    const inset = 4 // the track's padding, so the chip lands with its frame showing
    let left = s.scrollLeft
    if (er.left < sr.left + inset) left += er.left - sr.left - inset
    else if (er.right > sr.right - inset) left += er.right - sr.right + inset
    else return
    s.scrollTo({ left, behavior: animate && !reducedMotion() ? 'smooth' : 'auto' })
  }

  // slide on a week change; snap into place on first paint
  useGSAP(() => {
    position(!first.current)
    reveal(!first.current)
    first.current = false
  }, { dependencies: [value, weeks.length] })

  // the chips stretch with the panel on a phone: keep the pill on its chip
  useEffect(() => {
    const t = track.current
    if (!t || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => position(false))
    ro.observe(t)
    return () => ro.disconnect()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const last = weeks.length - 1
    const next = e.key === 'ArrowRight' ? Math.min(last, value + 1)
      : e.key === 'ArrowLeft' ? Math.max(0, value - 1)
        : e.key === 'Home' ? 0
          : e.key === 'End' ? last
            : null
    if (next === null) return
    e.preventDefault()
    if (next === value) return
    onChange(next)
    // the strip scrolls the chip into view itself; the page stays where it is
    tabs.current[next]?.focus({ preventScroll: true })
  }

  const whole = Math.max(1, total)
  return (
    // the scroller is bare so its scrollbar sits under the track, not inside it
    <div ref={scroller} className="scroll-slim mb-2 snap-x overflow-x-auto scroll-pl-1">
      <div
        ref={track}
        role="tablist"
        aria-label="Weeks"
        onKeyDown={onKeyDown}
        // phones: the track fills the width and the chips share it, down to a floor
        // that fits "Sep 29 – Oct 5"; past that it scrolls. Wider screens: the track
        // hugs chips of one fixed width, so a two-week poll is not two long bars
        className="relative grid w-max min-w-full auto-cols-[minmax(8.5rem,1fr)] grid-flow-col gap-0.5 rounded-xl bg-s2 p-1 sm:min-w-0 sm:auto-cols-[9.5rem]"
      >
        <span ref={pill} aria-hidden className="pointer-events-none absolute left-0 top-0 rounded-lg bg-raised shadow-raised" style={{ width: 0, height: 0 }} />
        {weeks.map((w, i) => {
          const on = i === value
          const n = Math.min(w.count, whole)
          const all = n === whole && w.count > 0
          return (
            <button
              key={i}
              ref={(el) => { tabs.current[i] = el }}
              id={`${idBase}-${i}`}
              type="button"
              role="tab"
              aria-selected={on}
              aria-controls={panelId}
              tabIndex={on ? 0 : -1}
              onClick={() => onChange(i)}
              className={`relative z-[1] flex min-h-11 snap-start flex-col justify-center gap-[3px] rounded-lg px-3 py-1 text-left leading-tight transition-colors focus-visible:-outline-offset-2 sm:min-h-0 ${on ? 'text-text' : 'text-dim hover:text-text'}`}
            >
              <span className="whitespace-nowrap text-[13px] font-semibold tabular-nums sm:text-[12.5px]">{w.label}</span>
              <span className="flex items-center gap-2">
                {/* the share of the list that has answered this week. The count beside
                    it says the same thing in words, so the bar stays out of the name */}
                <span aria-hidden className={`relative h-[3px] min-w-4 flex-1 overflow-hidden rounded-full transition-colors ${on ? 'bg-s2' : 'bg-s3'}`}>
                  <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${(n / whole) * 100}%`, background: all ? 'var(--heat-full)' : 'var(--heat-high)' }} />
                </span>
                <span className="whitespace-nowrap text-[12px] tabular-nums sm:text-[11.5px]">
                  <span className="sr-only">, </span>{n} of {whole}<span className="sr-only"> answered</span>
                </span>
                {w.you && (
                  <>
                    <span aria-hidden className="h-[7px] w-[7px] flex-none rounded-full" style={{ background: 'var(--you-many)', boxShadow: 'inset 0 0 0 1px var(--you-text)' }} />
                    <span className="sr-only">, including you</span>
                  </>
                )}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
