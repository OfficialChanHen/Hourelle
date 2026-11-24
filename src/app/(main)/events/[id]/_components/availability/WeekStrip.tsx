'use client'

import { useEffect, useRef } from 'react'
import { CalendarX, Check } from 'lucide-react'
import { reducedMotion } from '@/lib/prefs'

// `you`: you have time (free or if need be) on one of this week's days
// `out`: you said you can't make this week
export type WeekChip = { label: string; count: number; you: boolean; out?: boolean }

/* ── the week tabs ──
   One tab per week of a poll that runs over several, fixed to the grid's top edge
   like folder tabs: the week on screen is the open tab, joined to the grid below it,
   the others sit behind on the darker paper. Friends missed a strip above the grid
   (the grid holds the eye, as it should), so the weeks now hang off the grid itself,
   and each says whether you have marked it: a week still waiting on you reads "Not
   marked" in the highlight's deep ink, and a week you said you can't make says so.

   It is a tab list over the grid (the grid is the tab panel), so the keyboard gets
   one stop and Left/Right/Home/End walk the weeks. Selection follows focus: the
   weeks are cheap to switch and there is nothing to confirm.

   On a phone it scrolls sideways inside itself, never the page, snapping tab by
   tab, and the tab on screen is scrolled into view whenever the week changes from
   anywhere (a tap, a key, a jump to the best time, or Next week after a save). */
export function WeekStrip({ weeks, total, value, onChange, idBase, panelId, ask }: {
  weeks: WeekChip[]
  total: number // everyone on the list, the count's whole
  value: number // index of the week on screen
  onChange: (i: number) => void
  idBase: string // tab ids are `${idBase}-${i}`, so the panel can name its tab
  panelId: string // the grid the tabs control
  ask: boolean // you can mark this grid, so each tab says whether you have
}) {
  const scroller = useRef<HTMLDivElement>(null)
  const tabs = useRef<(HTMLButtonElement | null)[]>([])
  const first = useRef(true)

  // keep the tab on screen in view. Scrolls the strip only: scrollIntoView would
  // also move the page to reach it
  useEffect(() => {
    const s = scroller.current, el = tabs.current[value]
    const animate = !first.current
    first.current = false
    if (!s || !el) return
    const sr = s.getBoundingClientRect(), er = el.getBoundingClientRect()
    const inset = 12 // the strip's left inset, so the tab lands clear of the grid's corner
    let left = s.scrollLeft
    if (er.left < sr.left + inset) left += er.left - sr.left - inset
    else if (er.right > sr.right) left += er.right - sr.right
    else return
    s.scrollTo({ left, behavior: animate && !reducedMotion() ? 'smooth' : 'auto' })
  }, [value, weeks.length])

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
    // the strip scrolls the tab into view itself; the page stays where it is
    tabs.current[next]?.focus({ preventScroll: true })
  }

  const whole = Math.max(1, total)
  return (
    // sits a hairline into the grid below, so the open tab covers the grid's top
    // border and the two read as one piece. Starts a little in, clear of the grid's
    // rounded corner
    <div ref={scroller} className="relative z-[1] -mb-px snap-x overflow-x-auto scroll-pl-3 px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div
        role="tablist"
        aria-label="Weeks"
        onKeyDown={onKeyDown}
        // phones: the tabs share the width, down to a floor that fits "Sep 29 – Oct 5";
        // past that they scroll. Wider screens: tabs of one fixed width
        className="grid w-max min-w-full auto-cols-[minmax(8.5rem,1fr)] grid-flow-col items-end gap-1 sm:min-w-0 sm:auto-cols-[9.5rem]"
      >
        {weeks.map((w, i) => {
          const on = i === value
          const n = Math.min(w.count, whole)
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
              // the open tab wears the grid header's paper, joined to it
              // below; the rest sit behind, their bottoms on the grid's border
              className={`flex min-h-11 snap-start flex-col justify-center gap-0.5 rounded-t-[10px] border border-b-0 px-3 pb-1.5 pt-2 text-left leading-tight focus-visible:-outline-offset-2 sm:min-h-0 ${on
                ? 'border-border bg-s0 text-text'
                : 'mb-px border-border bg-s2 text-dim hover:text-text'}`}
            >
              <span className="whitespace-nowrap text-[13px] font-semibold tabular-nums sm:text-[12.5px]">{w.label}</span>
              <span className="flex items-center gap-2 whitespace-nowrap text-[12px] sm:text-[11.5px]">
                <span className="sr-only">, </span>
                {ask && (w.you
                  ? <span className="flex items-center gap-1 font-medium text-teal-text"><Check size={12} aria-hidden />Marked</span>
                  : w.out
                    // answered too, so it no longer asks in the highlight
                    ? <span className="flex items-center gap-1 font-medium text-brick-text"><CalendarX size={12} aria-hidden />Can&rsquo;t make</span>
                    : <span className="font-semibold text-moment-text">Not marked</span>)}
                <span className={`tabular-nums ${ask ? 'ml-auto text-faint' : ''}`}>
                  {ask && <span className="sr-only">, </span>}{n} of {whole}<span className="sr-only"> answered</span>
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
