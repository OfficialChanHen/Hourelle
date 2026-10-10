'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { Cover } from './Cover'
import { Keepsake, type Look } from './Keepsake'
import { useViewportWidth } from '@/hooks/useViewportWidth'
import { coverPlaces } from '@/lib/cover-shapes'

/* The cover as each place in the app crops it on this screen, side by side at one
   height: just the picture, so the strip stays small and the crops are easy to
   compare. The height is the largest up to `height` that keeps the strip on one
   line, and it wraps rather than go under 64px.

   With a `look`, the places that wear the card's detail (tape, a clip, pins) show it:
   each is drawn at its real size and scaled down whole, so the detail keeps its true
   size against the picture, as the app draws it. */
export function CoverCrops({ image, fit, pos, from, to, look, height = 96 }: {
  image?: string
  fit?: 'fill' | 'fit'
  pos?: { x: number; y: number }
  from: string
  to: string
  look?: Look
  height?: number
}) {
  const places = coverPlaces(useViewportWidth())
  const list = useRef<HTMLUListElement>(null)
  const [room, setRoom] = useState(0)
  useLayoutEffect(() => {
    const el = list.current
    if (!el) return
    const measure = () => setRoom(el.clientWidth)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  // each item is as wide as its picture or its label, whichever is wider
  const label = (s: string) => s.length * 6.4
  const widthAt = (h: number) => places.reduce((sum, p) => sum + Math.max(h * p.ratio, label(p.label)), 0) + GAP * (places.length - 1)
  let h = height
  while (room && h > 64 && widthAt(h) > room) h -= 2
  return (
    <ul ref={list} className="flex flex-wrap items-end gap-y-2.5" style={{ columnGap: GAP }} aria-label="How the cover is cropped around the app">
      {places.map((p) => (
        <li key={p.label} className="flex flex-col gap-1">
          <div className="relative" style={{ height: h, width: Math.round(h * p.ratio) }}>
            {look && p.detail ? (
              // a layer of its own (isolate), so a clip's back leg tucks under this picture
              <div className="absolute left-0 top-0 isolate origin-top-left" style={{ width: p.w, height: p.h, transform: `scale(${h / p.h})` }}>
                <Cover src={image} fit={fit} pos={pos} from={from} to={to} className="h-full w-full" rounded="rounded-lg" />
                <Keepsake look={look} />
              </div>
            ) : (
              <Cover src={image} fit={fit} pos={pos} from={from} to={to} className="h-full w-full" rounded="rounded-md" />
            )}
          </div>
          <span className="whitespace-nowrap text-[11.5px] text-dim">{p.label}</span>
        </li>
      ))}
    </ul>
  )
}

const GAP = 12
