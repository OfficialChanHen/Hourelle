'use client'

import { TimeSelect } from '@/components/ui/TimeSelect'
import type { DayRow } from '@/lib/events'

/* ── a run of days, each with its own hours ──
   One row per day of the run the host is locking in: the day, when it starts and,
   unless the length is unknown, when it ends. A day can be skipped and added back;
   a skipped day keeps its times so adding it back loses nothing. The day and its
   Skip sit on one line and the times under it, since the window is narrow. */
export function DayHoursRows({ rows, onChange, openEnd, dayLabel, keptCount }: {
  rows: DayRow[]
  onChange: (dayKey: string, patch: Partial<Omit<DayRow, 'dayKey'>>) => void
  openEnd: boolean
  dayLabel: (key: string) => string
  // the last kept day can't be skipped: a lock-in needs at least one
  keptCount: number
}) {
  return (
    <ul className="flex flex-col gap-1.5">
      {rows.map((r) => {
        const label = dayLabel(r.dayKey)
        return (
          <li key={r.dayKey} className={`rounded-[9px] border px-3 py-2 ${r.skip ? 'border-dashed border-border bg-s2' : 'border-border bg-s1'}`}>
            <div className="flex items-center gap-2">
              <span className={`min-w-0 flex-1 truncate text-[13.5px] font-medium ${r.skip ? 'text-faint line-through' : ''}`}>{label}</span>
              <button
                type="button"
                onClick={() => onChange(r.dayKey, { skip: !r.skip })}
                disabled={!r.skip && keptCount <= 1}
                aria-label={r.skip ? `Add ${label} back` : `Skip ${label}`}
                className="-mr-1.5 h-11 flex-none rounded-full px-2.5 text-[12.5px] font-semibold text-dim hover:bg-s2 hover:text-text disabled:opacity-40 disabled:hover:bg-transparent sm:h-8"
              >
                {r.skip ? 'Add back' : 'Skip'}
              </button>
            </div>
            {!r.skip && (
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <TimeSelect value={r.startMin} onChange={(v) => onChange(r.dayKey, { startMin: v, ...(v >= r.endMin && !openEnd ? { endMin: Math.min(v + 60, 24 * 60 - 5) } : {}) })} step={15} title={`Start on ${label}`} />
                {openEnd
                  ? <span className="text-[13px] text-dim">open end</span>
                  : <>
                      <span className="text-[13px] text-dim">to</span>
                      <TimeSelect value={r.endMin} onChange={(v) => onChange(r.dayKey, { endMin: v })} min={r.startMin + 15} step={15} title={`End on ${label}`} />
                    </>}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
