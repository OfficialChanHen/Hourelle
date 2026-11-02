'use client'

/* My usual week, compact to start like Your account: a small strip of the seven days
   with the hours painted on each, which days those are and the whole days, and Edit.
   Edit opens the editor; Save or Cancel folds it back. A plan's Import menu links
   here with #usual-week or #usual-days, which opens it. */

import { useEffect, useRef, useState } from 'react'
import { Check, Pencil } from 'lucide-react'
import { UsualWeekEditor } from '@/components/UsualWeekEditor'
import { useHashOpen } from '@/hooks/useHashOpen'
import { hasHours, hasWholeDays } from '@/lib/usual-week'
import type { Account } from '@/lib/session'

const COLS = [1, 2, 3, 4, 5, 6, 0] // Monday first; the numbers are Date.getDay()
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// weekdays as runs, Monday first: "Mon to Fri, Sun"
function daysLine(on: (wd: number) => boolean): string {
  const runs: number[][] = []
  for (const wd of COLS) {
    if (!on(wd)) continue
    const last = runs[runs.length - 1]
    if (last && COLS.indexOf(last[last.length - 1]) === COLS.indexOf(wd) - 1) last.push(wd)
    else runs.push([wd])
  }
  return runs.map((r) => (r.length > 2 ? `${DOW[r[0]]} to ${DOW[r[r.length - 1]]}` : r.map((d) => DOW[d]).join(', '))).join(', ')
}

export function UsualWeekCard({ account }: { account: Account }) {
  const [editing, setEditing] = useState(false)
  const [saved, setSaved] = useState(false)
  useHashOpen(['usual-week', 'usual-days'], () => setEditing(true))
  const editBtn = useRef<HTMLButtonElement>(null)
  const wasEditing = useRef(false)
  useEffect(() => {
    if (wasEditing.current && !editing) editBtn.current?.focus()
    wasEditing.current = editing
  }, [editing])
  useEffect(() => {
    if (!saved) return
    const t = setTimeout(() => setSaved(false), 1800)
    return () => clearTimeout(t)
  }, [saved])

  if (editing) {
    return (
      // keyed by account, so a new log-in starts from its own week
      <UsualWeekEditor key={account.id} account={account} onDone={(s) => { setEditing(false); setSaved(s) }} />
    )
  }

  const week = account.usualWeek
  const hours = hasHours(week), whole = hasWholeDays(week)
  return (
    <div className="flex items-center gap-3.5 rounded-2xl border border-border bg-s1 p-5">
      {/* a glance at the week, midnight at the top of each day; a whole day fills
          its bar in the lighter clay, hours sit on it in the darker */}
      <div aria-hidden className="flex flex-none gap-0.5">
        {COLS.map((wd) => (
          <div key={wd} className="flex w-3.5 flex-col items-center gap-1.5">
            <div className="relative h-9 w-[7px] overflow-hidden rounded-full bg-s3" style={week?.wholeDays[wd] ? { background: 'var(--you-many)' } : undefined}>
              {(week?.days[wd] ?? []).map((iv, i) => (
                <span key={i} className="absolute inset-x-0" style={{ top: `${(iv.s / 1440) * 100}%`, height: `${((iv.e - iv.s) / 1440) * 100}%`, background: 'var(--you-text)' }} />
              ))}
            </div>
            <span className="text-[11px] leading-none text-faint">{DOW[wd][0]}</span>
          </div>
        ))}
      </div>
      <div className="min-w-0 flex-1 text-[13px] leading-[1.45] text-dim">
        {saved ? (
          <span role="status" className="flex items-center gap-1 font-medium text-teal-text"><Check size={13} /> Saved</span>
        ) : !hours && !whole ? (
          'Not set yet. Plans can fill your times from it when you ask.'
        ) : (
          <>
            {hours && <span className="block">Hours on {daysLine((wd) => !!week?.days[wd].length)}</span>}
            {whole && <span className="block">Whole days on {daysLine((wd) => !!week?.wholeDays[wd])}</span>}
          </>
        )}
      </div>
      <button ref={editBtn} type="button" onClick={() => { setSaved(false); setEditing(true) }} className="flex h-11 flex-none items-center gap-1.5 rounded-full border border-border2 bg-s1 px-3 text-[13px] font-semibold text-dim hover:bg-s2 hover:text-text sm:h-9">
        <Pencil size={14} /> Edit
      </button>
    </div>
  )
}
