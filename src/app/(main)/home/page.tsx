'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Calendar, Zap, CalendarCheck, CalendarPlus, CalendarClock, Mail, Check, Link2,
  ArrowRight, type LucideIcon,
} from 'lucide-react'
import { Swiper, SwiperSlide } from 'swiper/react'
import { Navigation, Pagination, A11y } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/navigation'
import 'swiper/css/pagination'
import { EmptyState } from '@/components/ui/EmptyState'
import { FlashToast } from '@/components/ui/FlashToast'
import { StoredEventCard } from '@/components/ui/StoredEventCard'
import { Cover } from '@/components/ui/Cover'
import { Badge } from '@/components/ui/Badge'
import { TimezonePill } from '@/components/ui/TimezonePill'
import { LifecycleStrip, PHASE_BADGE } from '@/components/ui/LifecycleStrip'
import {
  listEvents, phaseOf, daysUntil, daysUntilLabel, dateRangeText, confirmedSlotText, sameDayLabelFor,
  type AppEvent, type Phase,
} from '@/lib/events'

// what part of the day it is, by the reader's clock
function greetingFor(hour: number): string {
  if (hour < 5) return 'Good evening'
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export default function HomePage() {
  const [events, setEvents] = useState<AppEvent[] | null>(null)
  // greeting settles after mount so the server-rendered HTML never disagrees
  // with a visitor in another timezone
  const [greeting, setGreeting] = useState('Good afternoon')
  useEffect(() => {
    setEvents(listEvents())
    setGreeting(greetingFor(new Date().getHours()))
  }, [])

  const withPhase = (events ?? []).map((e) => ({ e, phase: phaseOf(e) }))
  const active = withPhase.filter((x) => x.phase !== 'past')

  // up next: the closest confirmed plans, nearest day first and same-day ties to the
  // earlier start — up to five slides. With nothing confirmed, the newest planning
  // event stands in so the spot never sits empty.
  const upNext = active
    .filter((x) => x.phase === 'today' || x.phase === 'soon' || x.phase === 'upcoming')
    .sort((a, b) =>
      ((daysUntil(a.e.confirmed?.dayKey ?? a.e.startDate) ?? 0) - (daysUntil(b.e.confirmed?.dayKey ?? b.e.startDate) ?? 0)) ||
      ((a.e.confirmed?.startMin ?? 0) - (b.e.confirmed?.startMin ?? 0)))
    .slice(0, 5)
  const heroes = upNext.length > 0 ? upNext : active.filter((x) => x.phase === 'planning').slice(0, 1)
  const heroIds = new Set(heroes.map((x) => x.e.id))
  const rest = active.filter((x) => !heroIds.has(x.e.id))
  const yours = rest.filter((x) => x.e.hostedByYou)
  const invited = rest.filter((x) => !x.e.hostedByYou)
  const sameDay = sameDayLabelFor(active.map((x) => x.e))

  return (
    <div className="relative mx-auto max-w-[1240px] px-[26px] pb-[104px] pt-[34px]">
      <FlashToast />
      {/* greeting */}
      <div className="mb-5">
        <h1 className="mb-[9px] font-serif text-[37px] leading-[1.02] tracking-[-0.01em]" suppressHydrationWarning>{greeting}, Jordan</h1>
        <div className="flex items-center gap-1.5 text-[13.5px] text-dim">
          <Calendar size={15} /> {active.length > 0 ? `${active.length} event${active.length === 1 ? '' : 's'} in motion` : 'No events yet'}
        </div>
      </div>

      {/* Up next — the closest confirmed plans, one card at a time */}
      <SectionHeader icon={Zap} iconColor="var(--accent-text)" title="Up next" count={heroes.length > 1 ? heroes.length : undefined} />
      {heroes.length > 1 ? (
        <Swiper modules={[Navigation, Pagination, A11y]} slidesPerView={1} spaceBetween={18} navigation pagination={{ clickable: true }} className="upnext-swiper !pb-9">
          {heroes.map((x) => (
            <SwiperSlide key={x.e.id}>
              <HeroCard e={x.e} phase={x.phase} sameDayTitle={sameDay(x.e)} />
            </SwiperSlide>
          ))}
        </Swiper>
      ) : heroes.length === 1 ? (
        <HeroCard e={heroes[0].e} phase={heroes[0].phase} sameDayTitle={sameDay(heroes[0].e)} />
      ) : (
        <EmptyState
          icon={CalendarPlus}
          title="Nothing going on yet"
          body="Create an event and it takes over this spot."
          action={{ label: 'Create an event', href: '/create' }}
        />
      )}

      {/* Your events — everything you host that isn't over */}
      {yours.length > 0 && (
        <>
          <SectionHeader icon={CalendarCheck} title="Your events" count={yours.length} className="mt-[26px]" />
          <div className="grid grid-cols-1 gap-[13px] sm:grid-cols-2 lg:grid-cols-3">
            {yours.map((x) => <StoredEventCard key={x.e.id} e={x.e} sameDayTitle={sameDay(x.e)} />)}
          </div>
        </>
      )}

      {/* You're invited — events someone else is hosting */}
      {invited.length > 0 && (
        <>
          <SectionHeader icon={Mail} title="You're invited" count={invited.length} className="mt-[26px]" />
          <div className="grid grid-cols-1 gap-[13px] sm:grid-cols-2 lg:grid-cols-3">
            {invited.map((x) => <StoredEventCard key={x.e.id} e={x.e} sameDayTitle={sameDay(x.e)} />)}
          </div>
        </>
      )}
    </div>
  )
}

/* the hero: wide card with the lifecycle strip and one contextual action.
   The whole card opens the event's details; only elements with their own job don't. */
function HeroCard({ e, phase, sameDayTitle }: { e: AppEvent; phase: Phase; sameDayTitle?: string }) {
  const router = useRouter()
  const badge = PHASE_BADGE[phase]
  const du = daysUntil(e.confirmed?.dayKey ?? e.startDate)
  const [copied, setCopied] = useState(false)
  const action = phase === 'planning'
    ? { label: 'Add your availability', href: `/events/${e.id}?tab=availability` }
    : { label: 'See the plan', href: `/events/${e.id}` }
  function copyLink(ev: React.MouseEvent) {
    ev.stopPropagation()
    navigator.clipboard?.writeText(`https://aline.app/e/${e.id}`).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600) }).catch(() => {})
  }
  return (
    <div
      onClick={() => router.push(`/events/${e.id}?tab=details`)}
      className="cursor-pointer overflow-hidden rounded-2xl border border-border bg-s1 transition-colors hover:border-border2"
    >
      <Cover src={e.image} from="#E4EDE7" to="#CFE0D5" className={e.image ? 'h-[110px]' : 'h-[64px]'} />
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 p-5">
        {/* real min width: on phones the CTAs wrap below instead of crushing the title */}
        <div className="min-w-[220px] flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge variant={badge.variant}>{badge.label}</Badge>
            <Badge variant={du !== null && du >= 0 && du <= 14 ? 'accent' : 'neutral'}>{daysUntilLabel(du)}</Badge>
            {!e.hostedByYou && <Badge variant="neutral">Hosted by {e.hostName}</Badge>}
            {e.participants.some((p) => p.you && p.rsvp === 'pending') && <Badge variant="accent">Awaiting your reply</Badge>}
          </div>
          <Link href={`/events/${e.id}?tab=details`} onClick={(ev) => ev.stopPropagation()} className="block font-serif text-[27px] leading-[1.08] tracking-[-0.01em] hover:underline">{e.title}</Link>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[13px] text-dim">
            <Calendar size={14} /> {confirmedSlotText(e) ?? dateRangeText(e)} <TimezonePill tz={e.timezone} />
          </div>
          {sameDayTitle && (
            <div className="mt-1.5 flex items-center gap-1.5 text-[13px] font-medium text-ochre-text">
              <CalendarClock size={14} className="flex-none" /> <span className="truncate">Same day as {sameDayTitle}</span>
            </div>
          )}
          <LifecycleStrip phase={phase} className="mt-4 max-w-[380px]" />
        </div>
        <div className="flex w-full flex-none flex-col gap-2 sm:w-auto sm:flex-row-reverse sm:items-center">
          <Link href={action.href} onClick={(ev) => ev.stopPropagation()} className="flex h-10 w-full flex-none items-center justify-center gap-1.5 rounded-[10px] bg-accent px-4 text-[14px] font-semibold text-on-accent sm:w-auto">
            {action.label} <ArrowRight size={15} />
          </Link>
          {e.hostedByYou && (
            <button
              type="button" onClick={copyLink}
              className={`flex h-10 w-full flex-none items-center justify-center gap-1.5 rounded-[10px] border px-4 text-[14px] font-semibold sm:w-auto ${copied ? 'border-accent-border bg-accent-bg text-accent-text' : 'border-border2 bg-s1 text-text hover:bg-s2'}`}
            >
              {copied ? <><Check size={15} /> Link copied</> : <><Link2 size={15} /> Share link</>}
            </button>
          )}
        </div>
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
