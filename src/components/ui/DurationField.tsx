'use client'

import type { ReactNode } from 'react'
import * as Slider from '@radix-ui/react-slider'
import { fmtDur } from '@/app/(main)/events/[id]/_components/availability/grid-lib'

/* How long the event needs, as a length you can see.

   It was a stepper: less, the number, more, in a fixed 170px box that every row it
   sat in pushed to the far edge, away from the words saying what it was. A length
   is a distance along something, so it is drawn as one now: the value right beside
   its label, and under both a track as wide as the panel it lives in, filled up to
   the length chosen, on the same Radix slider the daily window uses.

   The stops are not even. Precision matters at the short end and not at the long
   one: quarter hours up to two hours, half hours up to four, whole hours after
   that. The track runs over the list of stops rather than raw minutes, so each is
   the same distance apart and ninety minutes is as easy to land on as nine hours.
   Arrows walk the stops, Home and End run to the ends, and the thumb announces
   "1h 30m", not a stop number. */
function stopsUpTo(min: number, max: number): number[] {
  const out: number[] = []
  for (let m = 15; m <= Math.min(max, 720); m += m < 120 ? 15 : m < 240 ? 30 : 60) if (m >= min) out.push(m)
  // a window that ends between stops still offers its own length as the last one
  if (!out.length || out[out.length - 1] < Math.min(max, 720)) out.push(Math.min(max, 720))
  return out
}

export function DurationField({ value, min = 15, max = 720, onChange, label = 'Event length', title }: {
  value: number
  min?: number
  max?: number
  onChange: (min: number) => void
  label?: string
  /** what sits before the value on the top line; the value always follows it */
  title?: ReactNode
}) {
  const stops = stopsUpTo(min, max)
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
          className="relative block h-5 w-5 rounded-full border-2 border-accent bg-s1 shadow-soft outline-none before:absolute before:-inset-3 before:content-[''] focus-visible:ring-2 focus-visible:ring-accent-border"
        />
      </Slider.Root>
      <div className="flex justify-between text-[11px] tabular-nums text-faint">
        <span>{fmtDur(stops[0])}</span>
        <span>{fmtDur(stops[stops.length - 1])}</span>
      </div>
    </div>
  )
}
