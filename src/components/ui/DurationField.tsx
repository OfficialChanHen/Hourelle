'use client'

import { useEffect, useRef, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { fmtDur, stepDuration } from '@/app/(main)/events/[id]/_components/availability/grid-lib'

/* How long the event needs, in one line: less on the left, more on the right, and
   the number between them. Tapping the number turns it into two small fields, so
   a length nobody would step to is typed instead. A phone gets its number pad from
   inputMode rather than a clock picker, because this is a length, not a time of
   day: "1:30" on a clock is half past one, and here it is an hour and a half.

   Whatever route it comes by, the answer is clamped to the range the caller gives.
   The wizard's range ends at the daily window it is about to set, so an event can
   never be longer than the hours it may happen in. */
export function DurationField({ value, min = 15, max = 720, onChange, label = 'Event length' }: {
  value: number
  min?: number
  max?: number
  onChange: (min: number) => void
  label?: string
}) {
  const [typing, setTyping] = useState(false)
  const [h, setH] = useState('')
  const [m, setM] = useState('')
  const hRef = useRef<HTMLInputElement>(null)
  const clamp = (n: number) => Math.min(max, Math.max(min, n))

  useEffect(() => { if (typing) hRef.current?.select() }, [typing])

  function open() {
    setH(String(Math.floor(value / 60)))
    setM(String(value % 60))
    setTyping(true)
  }
  function commit() {
    const mins = (parseInt(h, 10) || 0) * 60 + (parseInt(m, 10) || 0)
    setTyping(false)
    const next = clamp(mins || min)
    if (next !== value) onChange(next)
  }
  // leaving for the other field is not leaving the control
  function onBlur(e: React.FocusEvent<HTMLDivElement>) {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) commit()
  }

  // the two typing fields and the one collapsed number are sized to the same total,
  // so tapping the number swaps what is inside the control without changing how wide
  // it is. It used to grow by 56px on tap, which pushed it out of the 284px settings
  // popover it lives in on the grid.
  const field = 'h-8 w-[34px] rounded-[6px] border border-border bg-s1 text-center text-[13px] tabular-nums outline-none focus:border-accent-border'
  return (
    <div className="flex flex-none items-center overflow-hidden rounded-[8px] border border-border2 bg-s1">
      <button
        type="button" onClick={() => onChange(clamp(stepDuration(value, -1)))} disabled={value <= min}
        aria-label={`${label}, shorter`} className="grid h-8 w-8 flex-none place-items-center text-dim enabled:hover:bg-s2 enabled:active:bg-s3 disabled:opacity-35"
      ><Minus size={14} /></button>

      {typing ? (
        <div onBlur={onBlur} className="flex w-[104px] items-center justify-center gap-1">
          <input
            ref={hRef} value={h} onChange={(e) => setH(e.target.value.replace(/\D/g, '').slice(0, 2))}
            onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setTyping(false) }}
            inputMode="numeric" aria-label={`${label}, hours`} className={field}
          />
          <span className="text-[11px] text-faint">h</span>
          <input
            value={m} onChange={(e) => setM(e.target.value.replace(/\D/g, '').slice(0, 2))}
            onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setTyping(false) }}
            inputMode="numeric" aria-label={`${label}, minutes`} className={field}
          />
          <span className="text-[11px] text-faint">m</span>
        </div>
      ) : (
        <button
          type="button" onClick={open} aria-label={`${label}, ${fmtDur(value)}. Tap to type it`}
          className="h-8 w-[104px] px-1 text-center text-[13px] font-semibold tabular-nums hover:bg-s2"
        >
          {fmtDur(value)}
        </button>
      )}

      <button
        type="button" onClick={() => onChange(clamp(stepDuration(value, 1)))} disabled={value >= max}
        aria-label={`${label}, longer`} className="grid h-8 w-8 flex-none place-items-center text-dim enabled:hover:bg-s2 enabled:active:bg-s3 disabled:opacity-35"
      ><Plus size={14} /></button>
    </div>
  )
}
