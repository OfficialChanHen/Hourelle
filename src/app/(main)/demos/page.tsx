'use client'

import { useEffect, useState } from 'react'
import { StoredEventCard } from '@/components/ui/StoredEventCard'
import { listDemos, phaseOf, sameDayLabelFor, type AppEvent } from '@/lib/events'

/* ── the demo shelf: example events, full of people and answers ──
   Moved out of the real lists so Home and Events belong to your own plans. Anything
   changed here persists only on this device (joining one makes it a live copy). */
export default function DemosPage() {
  const [demos, setDemos] = useState<AppEvent[] | null>(null)
  useEffect(() => { setDemos(listDemos()) }, [])

  const sameDay = demos ? sameDayLabelFor(demos) : () => undefined

  return (
    <div className="mx-auto max-w-[1240px] px-[26px] pb-[104px] pt-[34px]">
      <div className="mb-[18px]">
        <h1 className="mb-1.5 font-serif text-[36px] leading-[1.02] tracking-[-0.01em]">Demos</h1>
        <div className="text-[13.5px] text-dim">
          Example events, already full of people and answers. Open one and poke around. Changes stay on this device.
        </div>
      </div>
      {demos === null ? (
        <div className="grid grid-cols-1 gap-[13px] sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-[240px] animate-pulse rounded-[13px] bg-s2" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-[13px] sm:grid-cols-2 lg:grid-cols-3">
          {demos.map((e) => (
            <StoredEventCard key={e.id} e={e} reuseHref={phaseOf(e) === 'past' ? `/create?from=${e.id}` : undefined} sameDay={sameDay(e)} />
          ))}
        </div>
      )}
    </div>
  )
}
