'use client'

import { useEffect, useState } from 'react'
import {
  Calendar, Zap, ChevronDown, CalendarCheck, CalendarClock,
  CalendarPlus, CalendarX2, Compass, type LucideIcon,
} from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { StoredEventCard } from '@/components/ui/StoredEventCard'
import { listEvents, type AppEvent } from '@/lib/events'

export default function HomePage() {
  const [events, setEvents] = useState<AppEvent[] | null>(null)
  useEffect(() => { setEvents(listEvents()) }, [])

  const has = !!events && events.length > 0
  const current = has ? events![0] : null
  const yours = events ?? []

  return (
    <div className="mx-auto max-w-[1240px] px-[26px] pb-[104px] pt-[34px]">
      {/* greeting */}
      <div className="mb-5">
        <h1 className="mb-[9px] font-serif text-[33px] leading-[1.02] tracking-[-0.01em]">Good afternoon, Jordan</h1>
        <div className="flex items-center gap-3.5 text-[12px] text-dim">
          <span className="flex items-center gap-1.5">
            <Calendar size={13} /> {has ? `${yours.length} event${yours.length === 1 ? '' : 's'} you're planning` : 'No events yet'}
          </span>
        </div>
      </div>

      {/* Current event */}
      <SectionHeader icon={Zap} iconColor="var(--accent-text)" title="Current event" />
      {current ? (
        <div className="grid grid-cols-1 gap-[13px] sm:grid-cols-2 lg:grid-cols-3">
          <StoredEventCard e={current} />
        </div>
      ) : (
        <EmptyState
          icon={CalendarPlus}
          title="Nothing going on yet"
          body="Once you create or join an event, you'll see it here with the date, place, and how planning is going."
          action={{ label: 'Create an event', href: '/create' }}
        />
      )}

      {/* Your events */}
      <SectionHeader icon={CalendarCheck} title="Your events" count={yours.length} sort={has} className="mt-[26px]" />
      {has ? (
        <div className="grid grid-cols-1 gap-[13px] sm:grid-cols-2 lg:grid-cols-3">
          {yours.map((e) => <StoredEventCard key={e.id} e={e} />)}
        </div>
      ) : (
        <EmptyState
          icon={CalendarX2}
          title="You haven't made any events"
          body="Start one from scratch or begin with a template. Picking a time, voting on a spot, and tracking who's coming are all built in."
          action={{ label: 'Create an event', href: '/create' }}
          compact
        />
      )}

      {/* Upcoming events (events others invite you to) */}
      <SectionHeader icon={CalendarClock} title="Upcoming events" count={0} className="mt-[26px]" />
      <EmptyState icon={Compass} title="Nothing coming up" body="Events other people invite you to will show up here." compact />
    </div>
  )
}

function SectionHeader({ icon: Icon, title, count, sort, iconColor, className = '' }: { icon: LucideIcon; title: string; count?: number; sort?: boolean; iconColor?: string; className?: string }) {
  return (
    <div className={`flex items-center justify-between ${className} mb-[11px]`}>
      <div className="flex items-center gap-2 text-[13px] font-semibold">
        <Icon size={14} style={{ color: iconColor ?? 'var(--dim)' }} />
        {title}
        {count != null && <span className="rounded-full border border-border bg-s2 px-[7px] py-px text-[10.5px] text-dim">{count}</span>}
      </div>
      {sort && (
        <div className="flex items-center gap-2 text-[11.5px] text-faint">
          <span>Sort</span>
          <span className="flex h-7 items-center gap-1.5 rounded-lg border border-border bg-s1 px-2.5 text-dim">Closest date <ChevronDown size={13} className="text-faint" /></span>
        </div>
      )}
    </div>
  )
}
