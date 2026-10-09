'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { Cover } from './Cover'
import { useViewportWidth } from '@/hooks/useViewportWidth'
import { coverPlaces } from '@/lib/cover-shapes'

/* The cover as each place in the app crops it on this screen, side by side at one
   height: just the picture, so the strip stays small and the crops are easy to
   compare. Places with nearly the same shape share one picture. The height is the
   largest up to `height` that keeps the strip on one line, and it wraps only when
   that would go under 32px. */
export function CoverCrops({ image, fit, pos, from, to, height = 56 }: {
  image?: string
  fit?: 'fill' | 'fit'
  pos?: { x: number; y: number }
  from: string
  to: string
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
  while (room && h > 32 && widthAt(h) > room) h -= 2
  return (
    <ul ref={list} className="flex flex-wrap items-end gap-y-2.5" style={{ columnGap: GAP }} aria-label="How the cover is cropped around the app">
      {places.map((p) => (
        <li key={p.label} className="flex flex-col gap-1">
          <div style={{ height: h, width: Math.round(h * p.ratio) }}>
            <Cover src={image} fit={fit} pos={pos} from={from} to={to} className="h-full w-full" rounded="rounded-md" />
          </div>
          <span className="whitespace-nowrap text-[11.5px] text-dim">{p.label}</span>
        </li>
      ))}
    </ul>
  )
}

const GAP = 12
