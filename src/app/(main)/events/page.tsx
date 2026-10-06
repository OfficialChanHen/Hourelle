'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CalendarX2 } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { StoredEventCard } from '@/components/ui/StoredEventCard'
import { FaceRibbon } from '@/components/ui/FaceRibbon'
import { SoftShapes } from '@/components/ui/SoftShapes'
import { PencilHover, PencilUnderline } from '@/components/ui/Pencil'
import { lookOf, type Look } from '@/components/ui/Keepsake'
import { listEvents, phaseOf, sameDayLabelFor, type AppEvent, type Participant, type Phase } from '@/lib/events'
import { useLiveEvents } from '@/hooks/useLiveEvents'

// real filters over the derived lifecycle phase — Confirmed covers everything locked in
const FILTERS: { key: string; label: string; match: (p: Phase) => boolean }[] = [
  { key: 'all', label: 'All', match: (p) => p !== 'past' },
  { key: 'planning', label: 'Deciding', match: (p) => p === 'planning' },
  { key: 'confirmed', label: 'Confirmed', match: (p) => p === 'upcoming' || p === 'soon' || p === 'today' },
  { key: 'past', label: 'Past', match: (p) => p === 'past' },
]

// useSearchParams needs a Suspense boundary to prerender; the page itself is the shell
export default function EventsPage() {
  return (
    <Suspense fallback={null}>
      <EventsList />
    </Suspense>
  )
}

function EventsList() {
  const [events, setEvents] = useState<AppEvent[] | null>(null)
  // the filter lives in the URL, so coming back (after a delete, or plain back
  // navigation) lands on the same section you left
  const router = useRouter()
  const filter = useSearchParams().get('filter') ?? 'all'
  const setFilter = (k: string) => router.replace(k === 'all' ? '/events' : `/events?filter=${k}`, { scroll: false })
  useEffect(() => { setEvents(listEvents()) }, [])
  // someone else's change arrived from the cloud: re-read so the list follows it live
  useLiveEvents(() => setEvents(listEvents()))

  const withPhase = (events ?? []).map((e) => ({ e, phase: phaseOf(e) }))
  const match = FILTERS.find((f) => f.key === filter) ?? FILTERS[0]
  const shown = withPhase.filter((x) => match.match(x.phase))
  const past = withPhase.filter((x) => x.phase === 'past')
  const showPastSection = filter === 'all' // the Past filter already shows them above
  const sameDay = sameDayLabelFor(withPhase.filter((x) => x.phase !== 'past').map((x) => x.e))

  // everyone you are planning with, once each, across the plans still to come: the
  // page's picture. One pass over every plan's people; the ribbon draws six.
  const people: Participant[] = []
  const seen = new Set<string>()
  for (const x of withPhase) {
    if (x.phase === 'past') continue
    for (const p of x.e.participants) {
      const key = (p.email ?? p.name).toLowerCase()
      if (p.you || seen.has(key)) continue
      seen.add(key)
      people.push(p)
    }
  }
  const active = withPhase.length - past.length
  // each card's hand-laid details; a neighbour never repeats them
  const looksFor = (list: { e: AppEvent }[]) => {
    const out: Look[] = []
    list.forEach((x, i) => out.push(lookOf(x.e.id, i, out[i - 1])))
    return out
  }
  const shownLooks = looksFor(shown)
  const pastLooks = looksFor(past)
  const grid = 'grid grid-cols-1 gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-3'

  return (
    <div className="mx-auto max-w-[1240px] px-6 pb-[92px] pt-[34px] sm:px-[26px]">
      {/* the people first: who you are planning with, as faces, then the plans */}
      <div className="relative isolate -mt-[34px] mb-8 pb-6 pt-[34px]">
        <SoftShapes variant="plan" />
        <h1 className="font-serif font-normal text-[36px] leading-[1.02] tracking-[-0.01em] sm:text-[40px]">Plans</h1>
        {people.length > 0 ? (
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-3">
            <FaceRibbon people={people} size={40} flippable />
            <p className="text-[14px] text-dim">
              {people.length === 1 ? 'You and 1 other person' : `You and ${people.length} people`}, across {active} {active === 1 ? 'plan' : 'plans'}
            </p>
          </div>
        ) : (
          <p className="mt-1.5 text-[14px] text-dim">{withPhase.length > 0 ? `${withPhase.length} plan${withPhase.length === 1 ? '' : 's'}` : 'No plans yet'}</p>
        )}
      </div>

      {/* the filters read like the tabs: a pencil line under the one you are on */}
      <div className="mb-10 flex flex-wrap items-center gap-1 text-[14px]" role="group" aria-label="Show">
        {FILTERS.map((f) => {
          const on = filter === f.key
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              aria-pressed={on}
              className={`flex h-11 items-center rounded-full px-[13px] sm:h-9 ${on ? 'font-semibold text-text' : 'font-medium text-dim hover:text-text'}`}
            >
              {on ? <PencilUnderline>{f.label}</PencilUnderline> : <PencilHover>{f.label}</PencilHover>}
            </button>
          )
        })}
      </div>

      {events === null ? (
        /* localStorage only exists after mount — pulse card shapes, never a flash of "empty" */
        <div className={grid}>
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-[240px] animate-pulse rounded-2xl bg-s2" />
          ))}
        </div>
      ) : shown.length > 0 ? (
        <div className={grid}>
          {shown.map((x, i) => (
            <StoredEventCard key={x.e.id} e={x.e} sameDay={sameDay(x.e)} look={shownLooks[i]} faded={x.phase === 'past'} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={CalendarX2}
          title={filter === 'all' ? 'Nothing planned yet' : `Nothing under ${match.label}`}
          body={filter === 'all' ? 'Start a plan and it shows up here.' : 'Plans move here as their stage changes.'}
          action={filter === 'all' ? { label: 'Start a plan', href: '/create' } : undefined}
          secondary={filter === 'all' ? { label: 'Or use a template', href: '/templates' } : undefined}
        />
      )}

      {showPastSection && past.length > 0 && (
        <>
          {/* same eyebrow section start as home — faint, because past is over */}
          <div className="mb-10 mt-14 flex items-center gap-2.5">
            <span className="text-[11.5px] font-semibold uppercase tracking-[.13em] text-faint">Past plans</span>
            <span className="rounded-full border border-border bg-s2 px-[7px] py-px text-[11.5px] text-dim">{past.length}</span>
          </div>
          {/* past plans are photos gone a little pale */}
          <div className={grid}>
            {past.map((x, i) => <StoredEventCard key={x.e.id} e={x.e} look={pastLooks[i]} faded />)}
          </div>
        </>
      )}
    </div>
  )
}
