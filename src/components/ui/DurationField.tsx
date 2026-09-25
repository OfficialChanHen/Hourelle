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

   The length is its own measure, not the grid's. The best-time search works in
   minutes over the stretches people marked, and the grid outlines what it finds
   even when that starts or ends partway through a slot, so a 1h 15m event on a
   grid of hour slots is a real answer: the frame just stops a quarter of the way
   into the next row. Tying the steps to the slot size would have hidden lengths the
   app can find. So the steps are quarter hours for every poll, and they only widen
   as the number grows, because nobody weighs 9h 15m against 9h 30m: quarter hours
   up to two hours, half hours up to four, then whole hours to the end of the
   window, a full day at most.

   The track runs over the list of stops rather than raw minutes, so every stop is
   the same distance apart and ninety minutes is as easy to land on as nine hours.
   That makes the scale uneven, so it is labelled: a few hour marks under the track
   show where the hours fall, which is what says the steps are growing. Arrows walk
   the stops, Home and End run to the ends, and the thumb announces "1h 30m", not a
   stop number. */
const DAY = 24 * 60
function stopsFor(min: number, max: number): number[] {
  const top = Math.min(max, DAY)
  const out: number[] = []
  for (let m = 15; m <= top; m += m < 120 ? 15 : m < 240 ? 30 : 60) if (m >= min) out.push(m)
  // a window that ends between stops still offers its own length as the last one
  if (!out.length || out[out.length - 1] < top) out.push(top)
  return out
}
// the hour marks worth naming under the track, in the order the scale reaches them
const MARKS = [60, 120, 240, 480, 720, DAY]

export function DurationField({ value, min = 15, max = DAY, onChange, label = 'Event length', title }: {
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
      {/* the ends, and the hour marks between them that have room to be read */}
      <div className="relative h-4 text-[11px] tabular-nums text-faint">
        {(() => {
          const last = stops.length - 1
          const pos = (i: number) => (last > 0 ? (i / last) * 100 : 0)
          const labels: { pct: number; text: string; edge?: 'l' | 'r' }[] = [{ pct: 0, text: fmtDur(stops[0]), edge: 'l' }]
          for (const m of MARKS) {
            const i = stops.indexOf(m)
            if (i <= 0 || i >= last) continue
            const pct = pos(i)
            if (pct - labels[labels.length - 1].pct < 11 || 100 - pct < 11) continue
            labels.push({ pct, text: fmtDur(m) })
          }
          if (last > 0) labels.push({ pct: 100, text: fmtDur(stops[last]), edge: 'r' })
          return labels.map((l) => (
            <span key={l.pct} className={`absolute top-0 ${l.edge === 'l' ? '' : l.edge === 'r' ? '-translate-x-full' : '-translate-x-1/2'}`} style={{ left: `${l.pct}%` }}>{l.text}</span>
          ))
        })()}
      </div>
    </div>
  )
}
