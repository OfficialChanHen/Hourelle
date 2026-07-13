'use client'

import { useEffect, useState } from 'react'
import { History, CalendarX2 } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { StoredEventCard } from '@/components/ui/StoredEventCard'
import { listEvents, phaseOf, type AppEvent, type Phase } from '@/lib/events'

// real filters over the derived lifecycle phase — Confirmed covers everything locked in
const FILTERS: { key: string; label: string; match: (p: Phase) => boolean }[] = [
  { key: 'all', label: 'All', match: (p) => p !== 'past' },
  { key: 'planning', label: 'Planning', match: (p) => p === 'planning' },
  { key: 'confirmed', label: 'Confirmed', match: (p) => p === 'upcoming' || p === 'soon' || p === 'today' },
  { key: 'past', label: 'Past', match: (p) => p === 'past' },
]

export default function EventsPage() {
  const [events, setEvents] = useState<AppEvent[] | null>(null)
  const [filter, setFilter] = useState('all')
  useEffect(() => { setEvents(listEvents()) }, [])

  const withPhase = (events ?? []).map((e) => ({ e, phase: phaseOf(e) }))
  const match = FILTERS.find((f) => f.key === filter) ?? FILTERS[0]
  const shown = withPhase.filter((x) => match.match(x.phase))
  const past = withPhase.filter((x) => x.phase === 'past')
  const showPastSection = filter === 'all' // the Past filter already shows them above

  return (
    <div className="mx-auto max-w-[1240px] px-[26px] pb-[104px] pt-[34px]">
      <div className="mb-4">
        <h1 className="mb-1.5 font-serif text-[36px] leading-[1.02] tracking-[-0.01em]">Events</h1>
        <div className="text-[13.5px] text-dim">{withPhase.length > 0 ? `${withPhase.length} event${withPhase.length === 1 ? '' : 's'}` : 'No events yet'}</div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`flex h-[30px] items-center rounded-full px-[13px] text-[13px] ${filter === f.key ? 'bg-accent font-semibold text-on-accent' : 'border border-border bg-s1 font-medium text-dim hover:border-border2'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {shown.length > 0 ? (
        <div className="grid grid-cols-1 gap-[13px] sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((x) => (
            <StoredEventCard key={x.e.id} e={x.e} reuseHref={x.phase === 'past' ? `/create?from=${x.e.id}` : undefined} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={CalendarX2}
          title={filter === 'all' ? 'No events yet' : `Nothing under ${match.label}`}
          body={filter === 'all' ? 'Make your first event and it shows up here.' : 'Events move here as their stage changes.'}
          action={filter === 'all' ? { label: 'Create an event', href: '/create' } : undefined}
        />
      )}

      {showPastSection && past.length > 0 && (
        <>
          <div className="mb-3 mt-7 flex items-center gap-2 text-[14.5px] font-semibold">
            <History size={16} className="text-dim" /> Past events
            <span className="rounded-full border border-border bg-s2 px-[7px] py-px text-[12px] text-dim">{past.length}</span>
          </div>
          <div className="grid grid-cols-1 gap-[13px] sm:grid-cols-2 lg:grid-cols-3">
            {past.map((x) => <StoredEventCard key={x.e.id} e={x.e} reuseHref={`/create?from=${x.e.id}`} />)}
          </div>
        </>
      )}
    </div>
  )
}
