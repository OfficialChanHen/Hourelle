'use client'

import { useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { selectedDayKeys } from '@/lib/events'

/* ── which days inside a date range are actually being polled ──
   A small month calendar: the month's name and arrows on top, weekdays as column
   headers, one row per week. Days inside the picked range are cells you can turn
   off; days of the month outside the range are greyed out. Three ways to turn days
   off, all optional: a weekday header knocks that weekday out across the whole
   range ("weekends only"), a week label knocks out that row, a cell knocks out one
   date. One month is on view at a time, so the control stays the same size however
   long the range is. The hard limit on how many days a poll may have lives with
   the form, not here. */

const DOW_L = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_L = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const parse = (key: string) => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d) }
const keyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const dowOf = (key: string) => parse(key).getDay()
const monthOf = (key: string) => key.slice(0, 7) // YYYY-MM
const monthLabel = (ym: string) => { const [y, m] = ym.split('-').map(Number); return `${MONTH_L[m - 1]} ${y}` }
const shiftMonth = (ym: string, by: number) => { const [y, m] = ym.split('-').map(Number); return keyOf(new Date(y, m - 1 + by, 1)).slice(0, 7) }

type Cell = { key: string; day: number; inRange: boolean } | null
type Week = { n: number; cells: Cell[] }

// one month as rows of seven, Sunday to Saturday, blanks outside the month
function monthGrid(ym: string, inRange: Set<string>): Week[] {
  const [y, m] = ym.split('-').map(Number)
  const cur = new Date(y, m - 1, 1)
  cur.setDate(1 - cur.getDay()) // back to the Sunday that starts the first row
  const weeks: Week[] = []
  do {
    const cells: Cell[] = []
    for (let i = 0; i < 7; i++) {
      const k = keyOf(cur)
      cells.push(cur.getMonth() === m - 1 ? { key: k, day: cur.getDate(), inRange: inRange.has(k) } : null)
      cur.setDate(cur.getDate() + 1)
    }
    weeks.push({ n: weeks.length + 1, cells })
  } while (cur.getMonth() === m - 1 && weeks.length < 6)
  return weeks
}

export function DaysPicker({ startDate, endDate, excludedDows, excludedDays, onChange }: {
  startDate: string
  endDate: string
  excludedDows: number[]
  excludedDays: string[]
  onChange: (patch: { excludedDows?: number[]; excludedDays?: string[] }) => void
}) {
  // the month on view; null means "the month the range starts in". It is clamped to
  // the months the range touches, so a range edit never leaves it stranded.
  const [viewed, setViewed] = useState<string | null>(null)

  const all = selectedDayKeys(startDate, endDate, [], [])
  if (all.length < 2) return null

  const exDow = new Set(excludedDows)
  const exDay = new Set(excludedDays)
  const inRange = new Set(all)
  const dowOff = (k: string) => exDow.has(dowOf(k))
  const isOn = (k: string) => !dowOff(k) && !exDay.has(k)
  const selected = all.filter(isOn).length
  const presentDows = new Set(all.map(dowOf))
  const weekdaysPresent = [...presentDows].filter((d) => d !== 0 && d !== 6)
  const weekendsOnly = weekdaysPresent.length > 0 && weekdaysPresent.every((d) => exDow.has(d)) && !exDow.has(0) && !exDow.has(6)

  const firstMonth = monthOf(all[0]), lastMonth = monthOf(all[all.length - 1])
  const month = viewed && viewed >= firstMonth && viewed <= lastMonth ? viewed : firstMonth
  const weeks = monthGrid(month, inRange)

  const toggleDow = (d: number) =>
    onChange({ excludedDows: exDow.has(d) ? excludedDows.filter((x) => x !== d) : [...excludedDows, d] })
  const toggleDay = (k: string) =>
    onChange({ excludedDays: exDay.has(k) ? excludedDays.filter((x) => x !== k) : [...excludedDays, k] })
  // a week label: any day of the row still on → the row goes off; none on → the row
  // comes back (days off by weekday stay off, that is the header's call)
  const toggleWeek = (w: Week) => {
    const keys = w.cells.filter((c): c is NonNullable<Cell> => !!c && c.inRange).map((c) => c.key)
    const anyOn = keys.some(isOn)
    onChange({ excludedDays: anyOn ? [...new Set([...excludedDays, ...keys])] : excludedDays.filter((k) => !keys.includes(k)) })
  }

  const cellCls = (on: boolean, disabled = false) =>
    `flex h-11 w-full items-center justify-center rounded-[7px] border px-0.5 text-[12.5px] font-medium sm:h-9 ${
      on ? 'border-accent-border bg-accent-bg text-accent-text' : 'border-border bg-s1 text-faint line-through decoration-faint/60'
    } ${disabled ? 'opacity-40' : 'hover:border-border2'}`
  const arrowCls = 'grid h-8 w-8 place-items-center rounded-[7px] border border-border bg-s1 text-dim hover:border-border2 hover:text-text disabled:opacity-30 disabled:hover:border-border disabled:hover:text-dim'

  return (
    <div className="mt-3 border-t border-border pt-3">
      <div className="flex flex-wrap items-center justify-between gap-x-2.5 gap-y-1.5">
        <span className="flex items-center gap-1.5 text-[13px] text-dim"><CalendarDays size={15} /> Days to poll</span>
        <span className="flex items-center gap-2.5 text-[12px] text-faint">
          {all.length >= 7 && weekdaysPresent.length > 0 && (
            <button
              type="button"
              onClick={() => onChange(weekendsOnly ? { excludedDows: [] } : { excludedDows: weekdaysPresent })}
              className="-my-2 py-2 text-[12.5px] font-semibold text-accent-text hover:underline"
            >
              {weekendsOnly ? 'Every day' : 'Weekends only'}
            </button>
          )}
          {selected} of {all.length} days on
        </span>
      </div>

      {/* the month on view, with arrows that only work when the range crosses months */}
      <div className="mt-2.5 flex items-center justify-between">
        <button type="button" onClick={() => setViewed(shiftMonth(month, -1))} disabled={month <= firstMonth} aria-label="Previous month" className={arrowCls}><ChevronLeft size={16} /></button>
        <span className="text-[13.5px] font-semibold">{monthLabel(month)}</span>
        <button type="button" onClick={() => setViewed(shiftMonth(month, 1))} disabled={month >= lastMonth} aria-label="Next month" className={arrowCls}><ChevronRight size={16} /></button>
      </div>

      {/* weekday headers, then one row per week of the month with its label */}
      <div className="mt-2 grid grid-cols-[auto_repeat(7,minmax(0,1fr))] gap-1 sm:gap-1.5" role="group" aria-label="Days to poll">
        <span aria-hidden />
        {DOW_L.map((l, d) => {
          const present = presentDows.has(d)
          const on = present && !exDow.has(d)
          return present ? (
            <button
              key={l} type="button" onClick={() => toggleDow(d)} aria-pressed={on}
              title={on ? `Turn every ${l} off` : `Turn every ${l} back on`}
              className={`h-8 rounded-[7px] text-[11px] font-semibold uppercase sm:tracking-[.08em] ${on ? 'text-dim hover:bg-s2 hover:text-text' : 'text-faint line-through hover:bg-s2'}`}
            >
              {/* one letter on phones, where seven three-letter headers run together */}
              <span className="sm:hidden">{l[0]}</span><span className="hidden sm:inline">{l}</span>
            </button>
          ) : (
            <span key={l} className="flex h-8 items-center justify-center text-[11px] font-semibold uppercase text-faint/60 sm:tracking-[.08em]"><span className="sm:hidden">{l[0]}</span><span className="hidden sm:inline">{l}</span></span>
          )
        })}
        {weeks.map((w) => {
          const keys = w.cells.filter((c): c is NonNullable<Cell> => !!c && c.inRange).map((c) => c.key)
          const rowOn = keys.some(isOn)
          const rowPossible = keys.some((k) => !dowOff(k))
          return (
            <div key={w.n} className="contents">
              <button
                type="button" onClick={() => toggleWeek(w)} disabled={!rowPossible} aria-pressed={rowOn}
                title={keys.length === 0 ? 'No polled days this week' : rowOn ? `Turn week ${w.n} off` : `Turn week ${w.n} back on`}
                className={`flex h-11 items-center rounded-[7px] px-1.5 text-[11px] font-semibold uppercase tracking-[.08em] sm:h-9 sm:px-2 ${rowOn ? 'text-dim hover:bg-s2 hover:text-text' : 'text-faint line-through hover:bg-s2'} disabled:opacity-40 disabled:no-underline disabled:hover:bg-transparent`}
              >
                <span className="sm:hidden">{w.n}</span><span className="hidden sm:inline">Wk {w.n}</span>
              </button>
              {w.cells.map((c, i) => c ? (
                c.inRange ? (
                  <button
                    key={c.key} type="button" disabled={dowOff(c.key)} onClick={() => toggleDay(c.key)} aria-pressed={isOn(c.key)}
                    title={dowOff(c.key) ? `Off with every ${DOW_L[dowOf(c.key)]}` : `${DOW_L[dowOf(c.key)]} ${c.day}`}
                    className={cellCls(isOn(c.key), dowOff(c.key))}
                  >
                    {c.day}
                  </button>
                ) : (
                  // a day of the month the range does not cover
                  <span key={c.key} className="flex h-11 items-center justify-center rounded-[7px] text-[12.5px] text-faint/50 sm:h-9" aria-disabled title="Outside the days you picked">{c.day}</span>
                )
              ) : (
                <span key={`${w.n}-${i}`} className="h-11 sm:h-9" aria-hidden />
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
