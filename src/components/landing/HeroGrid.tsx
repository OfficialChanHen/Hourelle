'use client'

/* ── the grid at the top of the landing page ──
   This used to be a photograph, two of them in fact, one per theme, and it went quietly
   out of date every time the real grid moved: the faces piled at the top of a cell long
   after they had moved down beside the count, times floating mid-row long after the rail
   became an axis. A picture cannot follow the tokens and nobody opens it to check.

   So it is built, like the three vignettes further down the page, rather than the real
   AvailabilityPanel, which is some three thousand lines of virtualization, drag handling
   and popovers and has no business being the first thing a stranger's phone renders. The
   colours, the type and both themes come from the same variables the app uses, so the
   only thing that can drift now is the shape, and that drifts in a diff where it shows. */

import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Info } from 'lucide-react'
import { AvatarRow } from '@/components/ui/AvatarRow'
import type { PersonColor } from '@/lib/colors'
import { pileFit } from '@/app/(main)/events/[id]/_components/availability/grid-lib'

const TOTAL = 24
const DAYS = [
  { dow: 'Mon', date: 'Sep 10' },
  { dow: 'Tue', date: 'Sep 11' },
  { dow: 'Wed', date: 'Sep 12' },
  { dow: 'Thu', date: 'Sep 13' },
  { dow: 'Fri', date: 'Sep 14', best: true },
  { dow: 'Sat', date: 'Sep 15' },
]
// how many of the twenty-four are free, row by row and day by day
const FREE = [
  [6, 6, 4, 4, 6, 3],
  [9, 11, 9, 9, 9, 6],
  [8, 10, 8, 8, 8, 5],
  [7, 11, 11, 13, 13, 10],
  [11, 11, 11, 11, 13, 15],
  [11, 10, 7, 11, 14, 13],
  [7, 10, 8, 6, 11, 12],
  [5, 5, 7, 6, 3, 10],
  [3, 6, 2, 4, 5, 2],
]
// the stretch the grid is pointing at: Friday afternoon, where the crowd peaks
const BEST = { col: 4, from: 3, to: 5 }
// the row a time belongs to is the one it opens, so the first row is the one time the
// rail never has to name
const AT = ['', '10:00', '11:00', '12:00', '1:00', '2:00', '3:00', '4:00', '5:00']
const AM = (r: number) => (r <= 2 ? 'AM' : 'PM')

const PEOPLE: { initials: string; name: string; color: PersonColor }[] = [
  { initials: 'EN', name: 'Elena', color: 'blue' },
  { initials: 'GM', name: 'Grace', color: 'teal' },
  { initials: 'JM', name: 'Jordan', color: 'purple' },
  { initials: 'MW', name: 'Mo', color: 'green' },
  { initials: 'PR', name: 'Priya', color: 'pink' },
  { initials: 'AT', name: 'Ana', color: 'coral' },
  { initials: 'BA', name: 'Ben', color: 'amber' },
  { initials: 'SL', name: 'Sam', color: 'gray' },
]
// a stable handful per cell, so the same cell always shows the same faces
const facesFor = (col: number, row: number, n: number) =>
  Array.from({ length: n }, (_, i) => PEOPLE[(col * 3 + row * 2 + i) % PEOPLE.length])

const heatOf = (n: number) =>
  n === 0 ? 'var(--s2)'
    : n / TOTAL <= 0.25 ? 'var(--heat-low)'
      : n / TOTAL <= 0.5 ? 'var(--heat-mid)'
        : n < TOTAL ? 'var(--heat-high)' : 'var(--heat-full)'

export function HeroGrid() {
  // yours, on top of everyone else's, the way Edit mine draws it
  const [mine, setMine] = useState<Set<string>>(new Set())
  // how wide a day is, measured, so the pile fits the cell it is in the way the real
  // grid's does: beside the headline a cell is half the width it has on its own line
  const dayRef = useRef<HTMLDivElement>(null)
  const [colW, setColW] = useState(0)
  useEffect(() => {
    const el = dayRef.current
    if (!el) return
    const measure = () => setColW(el.clientWidth)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const toggle = (k: string) => setMine((s) => {
    const n = new Set(s)
    if (n.has(k)) n.delete(k)
    else n.add(k)
    return n
  })

  return (
    <div className="@container select-none p-4 @xl:p-5">
      {/* the week on view, and whose clock the times are in */}
      <div className="flex flex-wrap items-center gap-x-[9px] gap-y-2">
        <span className="flex items-center gap-[3px]">
          {[ChevronLeft, ChevronRight].map((Icon, i) => (
            <span key={i} className="grid h-7 w-7 place-items-center rounded-[7px] border border-border bg-s1 text-dim" aria-hidden>
              <Icon size={17} />
            </span>
          ))}
        </span>
        <span className="text-[13.5px] font-semibold">Sep 10 – Sep 15 <span className="font-medium text-faint">(week 1 of 2)</span></span>
        <span className="flex h-7 items-center overflow-hidden rounded-lg border border-border bg-s1 text-[12px] font-medium" aria-hidden>
          <span className="flex h-full items-baseline gap-1 bg-accent px-2 pt-[6px] font-semibold text-on-accent">Event <span className="font-mono text-[10.5px]">PDT</span></span>
          <span className="flex h-full items-baseline gap-1 px-2 pt-[6px] text-dim">Yours <span className="font-mono text-[10.5px]">CDT</span></span>
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2.5 py-[11px]">
        <span className="text-[12.5px] text-dim">Participants</span>
        <AvatarRow people={PEOPLE} size={25} max={8} overlap={5} more={`+${TOTAL - PEOPLE.length}`} />
        <span className="ml-1.5 text-[12.5px] text-dim">18 of 24 responded</span>
        <span className="ml-auto text-faint" aria-hidden><Info size={14} /></span>
      </div>

      <div className="overflow-hidden rounded-[10px] border border-border">
        {/* the same widths the real grid uses: a narrower rail when the grid is narrow,
            because every pixel here is a pixel the days do not get. Narrow means the grid
            itself, not the window: beside the headline it is a column wide, not a page */}
        <div className="grid [--rail:62px] @xl:[--rail:82px]" style={{ gridTemplateColumns: 'var(--rail) repeat(6, minmax(0, 1fr))' }}>
          <div className="border-b border-r border-grid-edge bg-s0" />
          {DAYS.map((d, i) => (
            <div
              key={d.date}
              ref={i === 0 ? dayRef : undefined}
              className="border-b border-r border-grid-edge px-1.5 py-2 text-center last:border-r-0"
              style={{ background: d.best ? 'var(--best-head)' : 'var(--s0)' }}
            >
              <div className="text-[10px] text-dim @xl:text-[11px]">
                <span className="@xl:hidden">{d.dow[0]}</span><span className="hidden @xl:inline">{d.dow}</span>
              </div>
              <div className="text-[13px] font-semibold leading-tight @xl:text-[14px]" style={{ color: d.best ? 'var(--ochre-text)' : 'var(--text)' }}>
                <span className="@xl:hidden">{d.date.split(' ')[1]}</span><span className="hidden @xl:inline">{d.date}</span>
              </div>
              {d.best && (
                <span className="mt-[3px] inline-block whitespace-nowrap rounded-[5px] border border-ochre-border bg-ochre-bg py-px text-[9px] font-semibold text-ochre-text @xl:text-[9.5px] px-[3px] @xl:px-[5px]">
                  <span className="@xl:hidden">Best</span><span className="hidden @xl:inline">Best day</span>
                </span>
              )}
            </div>
          ))}

          {FREE.map((row, r) => (
            <div key={r} className="contents">
              {/* the rail: each time sits on the line that opens its row, a tick either
                  side of it and a gap so neither touches it */}
              <div className="relative flex items-center justify-end border-r border-grid-edge bg-s0 px-1.5 text-[10px] font-medium text-dim @xl:text-[12px]">
                {r > 0 && (
                  <span className="pointer-events-none absolute inset-x-0 flex -translate-y-1/2 items-center gap-1.5 leading-none" style={{ top: '-0.5px' }}>
                    <span className="h-px flex-1 bg-grid-edge" />
                    <span className="flex items-baseline gap-[3px] whitespace-nowrap">
                      {AT[r]}<span className="text-[8px] font-semibold tracking-[.04em] text-faint @xl:text-[9.5px]">{AM(r)}</span>
                    </span>
                    <span className="h-px flex-1 bg-grid-edge" />
                  </span>
                )}
              </div>

              {row.map((n, c) => {
                const key = `${c}|${r}`
                const isMine = mine.has(key)
                const count = n + (isMine ? 1 : 0)
                const inBest = c === BEST.col && r >= BEST.from && r <= BEST.to
                const last = c === DAYS.length - 1
                const pile = pileFit(n, 4, colW, TOTAL)
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggle(key)}
                    aria-pressed={isMine}
                    aria-label={`${DAYS[c].dow} ${DAYS[c].date}${AT[r] ? ` at ${AT[r]} ${AM(r)}` : ''}: ${count} of ${TOTAL} free`}
                    className={`relative h-[50px] border-b border-r border-grid-line text-left ${last ? 'border-r-0' : ''}`}
                    style={{ background: heatOf(n) }}
                  >
                    {isMine && (
                      <span
                        className="pointer-events-none absolute inset-0"
                        style={{ background: 'var(--you-some)', border: '1.5px solid #7A531F', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.35)' }}
                      />
                    )}
                    {inBest && (
                      <span
                        className="pointer-events-none absolute inset-0 z-[2]"
                        style={{
                          borderLeft: '2.5px solid var(--ochre)',
                          borderRight: '2.5px solid var(--ochre)',
                          borderTop: r === BEST.from ? '2.5px solid var(--ochre)' : undefined,
                          borderBottom: r === BEST.to ? '2.5px solid var(--ochre)' : undefined,
                        }}
                      />
                    )}
                    {pile.shown > 0 && (
                      <span className="pointer-events-none absolute bottom-[3px] left-[4px] z-[1]">
                        <AvatarRow people={facesFor(c, r, pile.shown)} size={20} overlap={4} font={9} max={pile.shown} more={pile.chip ? `+${pile.chip}` : ''} />
                      </span>
                    )}
                    <span
                      className="pointer-events-none absolute bottom-[3px] right-1 z-[2] text-[9.5px] font-bold"
                      style={{ color: isMine ? 'var(--you-text)' : 'var(--heat-count)' }}
                    >
                      {count}/{TOTAL}
                    </span>
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
