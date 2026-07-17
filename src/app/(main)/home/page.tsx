'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Calendar, Zap, CalendarCheck, CalendarPlus, History,
  ArrowRight, type LucideIcon,
} from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { FlashToast } from '@/components/ui/FlashToast'
import { StoredEventCard } from '@/components/ui/StoredEventCard'
import { Cover } from '@/components/ui/Cover'
import { Badge } from '@/components/ui/Badge'
import { TimezonePill } from '@/components/ui/TimezonePill'
import { LifecycleStrip, PHASE_BADGE } from '@/components/ui/LifecycleStrip'
import {
  listEvents, phaseOf, daysUntil, daysUntilLabel, dateRangeText,
  type AppEvent, type Phase,
} from '@/lib/events'

export default function HomePage() {
  const [events, setEvents] = useState<AppEvent[] | null>(null)
  useEffect(() => { setEvents(listEvents()) }, [])

  const withPhase = (events ?? []).map((e) => ({ e, phase: phaseOf(e) }))
  const active = withPhase.filter((x) => x.phase !== 'past')
  const past = withPhase.filter((x) => x.phase === 'past')

  // the one event that needs you next: happening today, else the nearest confirmed,
  // else the newest one still planning
  const hero =
    active.find((x) => x.phase === 'today') ??
    active
      .filter((x) => x.phase === 'soon' || x.phase === 'upcoming')
      .sort((a, b) => (daysUntil(a.e.confirmed?.dayKey ?? a.e.startDate) ?? 0) - (daysUntil(b.e.confirmed?.dayKey ?? b.e.startDate) ?? 0))[0] ??
    active.find((x) => x.phase === 'planning') ??
    null
  const rest = active.filter((x) => x.e.id !== hero?.e.id)

  return (
    <div className="relative mx-auto max-w-[1240px] px-[26px] pb-[104px] pt-[34px]">
      <FlashToast />
      {/* greeting */}
      <div className="mb-5">
        <h1 className="mb-[9px] font-serif text-[37px] leading-[1.02] tracking-[-0.01em]">Good afternoon, Jordan</h1>
        <div className="flex items-center gap-1.5 text-[13.5px] text-dim">
          <Calendar size={15} /> {active.length > 0 ? `${active.length} event${active.length === 1 ? '' : 's'} in motion` : 'No events yet'}
        </div>
      </div>

      {/* Up next — the single event that wants your attention */}
      <SectionHeader icon={Zap} iconColor="var(--accent-text)" title="Up next" />
      {hero ? (
        <HeroCard e={hero.e} phase={hero.phase} />
      ) : (
        <EmptyState
          icon={CalendarPlus}
          title="Nothing going on yet"
          body="Create an event and it takes over this spot."
          action={{ label: 'Create an event', href: '/create' }}
        />
      )}

      {/* Your events — everything else that isn't over */}
      {rest.length > 0 && (
        <>
          <SectionHeader icon={CalendarCheck} title="Your events" count={rest.length} className="mt-[26px]" />
          <div className="grid grid-cols-1 gap-[13px] sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((x) => <StoredEventCard key={x.e.id} e={x.e} />)}
          </div>
        </>
      )}

      {/* Past events — done, and one click away from becoming the next one */}
      {past.length > 0 && (
        <>
          <SectionHeader icon={History} title="Past events" count={past.length} className="mt-[26px]" />
          <div className="grid grid-cols-1 gap-[13px] sm:grid-cols-2 lg:grid-cols-3">
            {past.map((x) => <StoredEventCard key={x.e.id} e={x.e} reuseHref={`/create?from=${x.e.id}`} />)}
          </div>
        </>
      )}
    </div>
  )
}

/* the hero: wide card with the lifecycle strip and one contextual action */
function HeroCard({ e, phase }: { e: AppEvent; phase: Phase }) {
  const badge = PHASE_BADGE[phase]
  const du = daysUntil(e.confirmed?.dayKey ?? e.startDate)
  const action = phase === 'planning'
    ? { label: 'Add your availability', href: `/events/${e.id}?tab=availability` }
    : { label: 'See the plan', href: `/events/${e.id}` }
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-s1">
      <Cover src={e.image} from="#E4EDE7" to="#CFE0D5" className={e.image ? 'h-[110px]' : 'h-[64px]'} />
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 p-5">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center gap-2">
            <Badge variant={badge.variant}>{badge.label}</Badge>
            <Badge variant={du !== null && du >= 0 && du <= 14 ? 'accent' : 'neutral'}>{daysUntilLabel(du)}</Badge>
          </div>
          <Link href={`/events/${e.id}`} className="block font-serif text-[27px] leading-[1.08] tracking-[-0.01em] hover:underline">{e.title}</Link>
          <div className="mt-1.5 flex items-center gap-1.5 text-[13px] text-dim">
            <Calendar size={14} /> {dateRangeText(e)} <TimezonePill tz={e.timezone} />
          </div>
          <LifecycleStrip phase={phase} className="mt-4 max-w-[380px]" />
        </div>
        <Link href={action.href} className="flex h-10 flex-none items-center gap-1.5 rounded-[10px] bg-accent px-4 text-[14px] font-semibold text-on-accent">
          {action.label} <ArrowRight size={15} />
        </Link>
      </div>
    </div>
  )
}

function SectionHeader({ icon: Icon, title, count, iconColor, className = '' }: { icon: LucideIcon; title: string; count?: number; iconColor?: string; className?: string }) {
  return (
    <div className={`flex items-center justify-between ${className} mb-[11px]`}>
      <div className="flex items-center gap-2 text-[14.5px] font-semibold">
        <Icon size={16} style={{ color: iconColor ?? 'var(--dim)' }} />
        {title}
        {count != null && <span className="rounded-full border border-border bg-s2 px-[7px] py-px text-[12px] text-dim">{count}</span>}
      </div>
    </div>
  )
}
