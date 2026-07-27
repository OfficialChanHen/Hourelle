'use client'

import { CalendarDays } from 'lucide-react'
import { selectedDayKeys } from '@/lib/events'

/* ── which days inside a date range are actually being polled ──
   Two layers, both optional: weekday chips knock out whole weekdays across the range
   ("weekends only"), per-day chips knock out single dates. Weekday chips appear once
   the range spans a week; per-day chips only while the range is small enough to list
   (≤ 21 days), so the DOM stays bounded however long the range gets. */

const DOW_L = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MON_L = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const dowOf = (key: string) => {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d).getDay()
}
const dayChipLabel = (key: string) => {
  const [, m, d] = key.split('-').map(Number)
  return `${MON_L[m - 1]} ${d}`
}

export function DaysPicker({ startDate, endDate, excludedDows, excludedDays, onChange }: {
  startDate: string
  endDate: string
  excludedDows: number[]
  excludedDays: string[]
  onChange: (patch: { excludedDows?: number[]; excludedDays?: string[] }) => void
}) {
  const all = selectedDayKeys(startDate, endDate, [], [])
  if (all.length < 2) return null

  const exDow = new Set(excludedDows)
  const exDay = new Set(excludedDays)
  const isOn = (k: string) => !exDow.has(dowOf(k)) && !exDay.has(k)
  const selected = all.filter(isOn).length
  const presentDows = new Set(all.map(dowOf))
  const weekdaysPresent = [...presentDows].filter((d) => d !== 0 && d !== 6)
  const weekendsOnly = weekdaysPresent.length > 0 && weekdaysPresent.every((d) => exDow.has(d)) && !exDow.has(0) && !exDow.has(6)

  const toggleDow = (d: number) =>
    onChange({ excludedDows: exDow.has(d) ? excludedDows.filter((x) => x !== d) : [...excludedDows, d] })
  const toggleDay = (k: string) =>
    onChange({ excludedDays: exDay.has(k) ? excludedDays.filter((x) => x !== k) : [...excludedDays, k] })

  const chipCls = (on: boolean, disabled = false) =>
    `rounded-[7px] border px-2 py-1 text-[12.5px] font-medium ${
      on ? 'border-accent-border bg-accent-bg text-accent-text' : 'border-border bg-s1 text-faint'
    } ${disabled ? 'opacity-40' : 'hover:border-border2'}`

  return (
    <div className="mt-3 border-t border-border pt-3">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
        <span className="flex items-center gap-1.5 text-[13px] text-dim"><CalendarDays size={15} /> Days to poll</span>
        {all.length >= 7 && presentDows.size > 1 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {DOW_L.map((l, d) => presentDows.has(d) && (
              <button key={l} type="button" onClick={() => toggleDow(d)} aria-pressed={!exDow.has(d)} className={chipCls(!exDow.has(d))}>
                {l}
              </button>
            ))}
            <button
              type="button"
              onClick={() => onChange(weekendsOnly ? { excludedDows: [] } : { excludedDows: weekdaysPresent })}
              className="ml-0.5 text-[12.5px] font-semibold text-accent-text hover:underline"
            >
              {weekendsOnly ? 'Every day' : 'Weekends only'}
            </button>
          </div>
        )}
        <span className="text-[12px] text-faint">{selected} of {all.length} days on</span>
      </div>
      {all.length <= 28 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {all.map((k) => {
            const dowOff = exDow.has(dowOf(k))
            return (
              <button
                key={k}
                type="button"
                disabled={dowOff}
                onClick={() => toggleDay(k)}
                aria-pressed={isOn(k)}
                title={dowOff ? `Turned off with every ${DOW_L[dowOf(k)]}` : undefined}
                className={chipCls(isOn(k), dowOff)}
              >
                {DOW_L[dowOf(k)]} {dayChipLabel(k)}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
