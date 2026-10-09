'use client'

import type { ReactNode } from 'react'
import * as Slider from '@radix-ui/react-slider'
import { fmtDur } from '@/app/(main)/events/[id]/_components/availability/grid-lib'

/* How long the event needs, as a length you can see.

   A track as wide as the panel it lives in, filled up to the length chosen, on the
   same Radix slider the daily window uses, with the value beside its label.

   The scale is even: one step size for the whole track, picked from how long the
   longest choice is (quarter hours up to six hours, half hours up to twelve, whole
   hours past that), so a step is the same distance wherever the thumb is. The labels
   under it are even too: one interval (30m, 1h, 2h, 3h, 4h or 6h), the smallest that
   keeps them to about four, each placed where its length falls. The longest length
   and the shortest are always named at the ends.

   The length is its own measure, not the grid's: the best-time search works in
   minutes and the grid outlines what it finds even partway through a slot, so the
   steps never follow the slot size. Arrows walk the steps, Home and End run to the
   ends, and the thumb announces "1h 30m", not a step number. */
const DAY = 24 * 60
const stepFor = (top: number) => (top <= 6 * 60 ? 15 : top <= 12 * 60 ? 30 : 60)
function stopsFor(min: number, max: number): number[] {
  const top = Math.min(max, DAY)
  const step = stepFor(top)
  const out: number[] = []
  for (let m = step; m <= top; m += step) if (m >= min) out.push(m)
  // a window that ends between steps still offers its own length as the last one
  if (!out.length || out[out.length - 1] < top) out.push(top)
  return out
}
// one even interval for the labels, the smallest that keeps them to about four
function marksFor(first: number, last: number): number[] {
  const every = [30, 60, 120, 180, 240, 360].find((i) => last / i <= 4) ?? 360
  const out: number[] = []
  for (let m = every; m <= last; m += every) if (m >= first) out.push(m)
  return out
}

export function DurationField({ value, min = 15, max = DAY, onChange, label = 'How long it lasts', title }: {
  value: number
  min?: number
  max?: number
  onChange: (min: number) => void
  label?: string
  /** what sits before the value on the top line; the value always follows it */
  title?: ReactNode
}) {
  const stops = stopsFor(min, max)
  // the stop nearest the value, so a length from before the stops changed still lands
  let at = 0
  for (let i = 1; i < stops.length; i++) if (Math.abs(stops[i] - value) < Math.abs(stops[at] - value)) at = i
  const shown = stops[at]

  return (
    <div className="w-full min-w-0">
      <div className="flex min-w-0 items-baseline gap-2">
        {title}
        <span className="text-[13.5px] font-semibold tabular-nums text-accent-text">{fmtDur(shown)}</span>
      </div>
      <Slider.Root
        value={[at]}
        min={0}
        max={Math.max(1, stops.length - 1)}
        step={1}
        disabled={stops.length < 2}
        onValueChange={([i]) => { if (stops[i] !== value) onChange(stops[i]) }}
        className="relative mt-1 flex h-8 w-full touch-none select-none items-center"
        aria-label={label}
      >
        <Slider.Track className="relative h-1.5 w-full rounded-full bg-s3">
          <Slider.Range className="absolute h-full rounded-full bg-accent" />
        </Slider.Track>
        {/* the dot is 20px; the space that answers a finger is 44 */}
        <Slider.Thumb
          aria-label={label}
          aria-valuetext={fmtDur(shown)}
          className="relative block h-5 w-5 rounded-full border-2 border-accent bg-s1 shadow-soft outline-none before:absolute before:-inset-3 before:content-[''] focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-s1"
        />
      </Slider.Root>
      {/* the ends, and the even marks between them, each where its length falls */}
      <div className="relative h-4 text-[11px] tabular-nums text-faint">
        {(() => {
          const first = stops[0], last = stops[stops.length - 1]
          const span = last - first
          const pct = (m: number) => (span > 0 ? ((m - first) / span) * 100 : 0)
          // both ends always, and the even marks between them that have room
          const inner = marksFor(first, last).filter((m) => pct(m) >= 15 && pct(m) <= 85)
          const marks = span > 0 ? [first, ...inner, last] : [first]
          return marks.map((m) => {
            const p = pct(m)
            // the ends sit inside the track; the rest centre on their point
            const shift = p >= 99.5 ? '-translate-x-full' : p <= 0.5 ? '' : '-translate-x-1/2'
            return <span key={m} className={`absolute top-0 ${shift}`} style={{ left: `${p}%` }}>{fmtDur(m)}</span>
          })
        })()}
      </div>
    </div>
  )
}
