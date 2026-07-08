'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Clock, ChevronDown, Check } from 'lucide-react'
import { fmtMinute } from '@/lib/events'

/**
 * Editorial time dropdown — a custom menu of clock times (no native `<input type="time">`).
 * Bounds are enforced by construction: only times in [min, max] at `step` increments are
 * offered, so the caller can't land outside the allowed window. Matches the DurationPicker
 * look: hairline trigger button, soft-shadow popover, accent-filled active row.
 */
export function TimeSelect({
  value, onChange, min = 0, max = 24 * 60 - 15, step = 15, title, className,
}: {
  value: number // clock minutes
  onChange: (min: number) => void
  min?: number
  max?: number
  step?: number
  title?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('pointerdown', onDown); window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('pointerdown', onDown); window.removeEventListener('keydown', onKey) }
  }, [open])

  // center the selected time when the menu opens
  useLayoutEffect(() => {
    if (!open || !list.current) return
    const active = list.current.querySelector('[data-active="true"]') as HTMLElement | null
    if (active) active.scrollIntoView({ block: 'center' })
  }, [open])

  // build the option list from the bounds (snap `lo` up to a `step` grid off `min`)
  const lo = Math.min(min, max), hi = Math.max(min, max)
  const opts: number[] = []
  for (let t = lo; t <= hi; t += step) opts.push(t)
  if (!opts.length) opts.push(lo)

  return (
    <div ref={wrap} className={`relative ${className ?? ''}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={title}
        className="flex h-7 items-center gap-1.5 rounded-[7px] border border-border bg-s1 px-2 text-[12.5px] font-medium tabular-nums hover:border-border2"
      >
        <Clock size={13} className="text-dim" /> {fmtMinute(value)}
        <ChevronDown size={13} className={`text-faint ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div ref={list} className="scroll-slim absolute left-0 top-full z-30 mt-1 max-h-[212px] w-[120px] overflow-auto rounded-[10px] border border-border bg-s1 p-1 shadow-soft">
          {opts.map((m) => {
            const on = m === value
            return (
              <button
                key={m}
                type="button"
                data-active={on}
                onClick={() => { onChange(m); setOpen(false) }}
                className={`flex w-full items-center justify-between rounded-[7px] px-2 py-1.5 text-[13px] tabular-nums ${on ? 'bg-accent font-semibold text-on-accent' : 'hover:bg-s2'}`}
              >
                {fmtMinute(m)} {on && <Check size={13} />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
