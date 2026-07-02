import Link from 'next/link'
import {
  Calendar, Clock, Zap, ChevronDown, MapPin, User, CheckCircle2,
  Users, Wallet, ExternalLink, CalendarCheck, CalendarClock, type LucideIcon,
} from 'lucide-react'
import { AvatarRow } from '@/components/ui/AvatarRow'
import { TimezonePill } from '@/components/ui/TimezonePill'
import { Cover } from '@/components/ui/Cover'
import { EventCard } from '@/components/ui/EventCard'
import { HeroLifecycle } from './HeroLifecycle'
import { hero, yourEvents, upcomingEvents } from '@/lib/home'

const statIcons: Record<string, LucideIcon> = { users: Users, clock: Clock, wallet: Wallet }

export default function HomePage() {
  return (
    <div className="mx-auto max-w-[1240px] px-[26px] pb-[104px] pt-[34px]">
      {/* greeting */}
      <div className="mb-5">
        <h1 className="mb-[9px] font-serif text-[33px] leading-[1.02] tracking-[-0.01em]">Good afternoon, Jordan</h1>
        <div className="flex items-center gap-3.5 text-[12px] text-dim">
          <span className="flex items-center gap-1.5"><Calendar size={13} /> 3 events this week</span>
          <span className="flex items-center gap-1.5 text-ochre-text"><Clock size={13} /> 1 happening today</span>
        </div>
      </div>

      {/* Current event */}
      <SectionHeader icon={Zap} iconColor="var(--accent-text)" title="Current event" />
      <div className="overflow-hidden rounded-[14px] border-[1.5px] border-accent-border bg-s1 shadow-soft">
        <div className="flex gap-[18px] p-[18px]">
          <Cover from={hero.cover[0]} to={hero.cover[1]} rounded="rounded-[11px]" className="h-auto w-[150px] flex-none self-stretch" />
          <div className="min-w-0 flex-1">
            <div className="mb-2.5 flex items-center gap-2.5">
              <span className="flex h-[23px] items-center gap-1.5 rounded-md border border-ochre-border bg-ochre-bg px-2.5 text-[11px] font-semibold text-ochre-text">
                <Clock size={12} /> {hero.badges.time}
                <span className="font-mono text-[10px] opacity-70">PDT</span>
              </span>
              <span className="flex items-center gap-1.5 text-[11.5px] font-semibold text-teal-text">
                <CheckCircle2 size={13} /> {hero.badges.confirmed}
              </span>
            </div>
            <h2 className="mb-2.5 font-serif text-[27px] leading-[1.05] tracking-[-0.01em]">{hero.title}</h2>
            <div className="mb-3 flex flex-wrap items-center gap-2.5 text-[12px] text-dim">
              <span className="flex items-center gap-1.5"><MapPin size={13} /> {hero.location}</span>
              <TimezonePill tz={hero.tz} />
              <span className="opacity-40">·</span>
              <span className="flex items-center gap-1.5"><User size={13} /> Hosted by you</span>
            </div>
            <div className="flex items-center gap-2.5">
              <AvatarRow people={hero.avatars} size={25} max={6} more={hero.more} />
              <span className="ml-1.5 text-[11.5px] text-dim">{hero.attending}</span>
            </div>
          </div>
          {/* right column */}
          <div className="flex w-[198px] flex-none flex-col gap-[7px]">
            {hero.stats.map((s) => {
              const Icon = statIcons[s.icon]
              return (
                <div key={s.label} className="flex h-[34px] items-center justify-between rounded-[9px] border border-border bg-s2 px-[11px]">
                  <span className="flex items-center gap-1.5 text-[11.5px] text-dim"><Icon size={13} /> {s.label}</span>
                  <span className="text-[12.5px] font-semibold" style={s.accent ? { color: 'var(--ochre-text)' } : undefined}>{s.value}</span>
                </div>
              )
            })}
            <Link href="/events/q3-offsite?tab=availability" className="mt-px flex h-9 items-center justify-center gap-1.5 rounded-[9px] border border-border2 bg-transparent text-[12px] font-semibold hover:bg-s2">
              <ExternalLink size={13} /> View event
            </Link>
          </div>
        </div>
        <div className="border-t border-border bg-s0 px-[18px] py-3.5">
          <HeroLifecycle />
        </div>
      </div>

      {/* Your events */}
      <SectionHeader icon={CalendarCheck} title="Your events" count={yourEvents.length} sort className="mt-[26px]" />
      <div className="grid grid-cols-1 gap-[13px] sm:grid-cols-2 lg:grid-cols-3">
        {yourEvents.map((e) => <EventCard key={e.title} e={e} />)}
      </div>

      {/* Upcoming events */}
      <SectionHeader icon={CalendarClock} title="Upcoming events" count={upcomingEvents.length} sort className="mt-[26px]" />
      <div className="grid grid-cols-1 gap-[13px] sm:grid-cols-2 lg:grid-cols-3">
        {upcomingEvents.map((e) => <EventCard key={e.title} e={e} />)}
      </div>
    </div>
  )
}

function SectionHeader({
  icon: Icon, title, count, sort, iconColor, className = '',
}: {
  icon: LucideIcon
  title: string
  count?: number
  sort?: boolean
  iconColor?: string
  className?: string
}) {
  return (
    <div className={`flex items-center justify-between ${className} mb-[11px]`}>
      <div className="flex items-center gap-2 text-[13px] font-semibold">
        <Icon size={14} style={{ color: iconColor ?? 'var(--dim)' }} />
        {title}
        {count != null && (
          <span className="rounded-full border border-border bg-s2 px-[7px] py-px text-[10.5px] text-dim">{count}</span>
        )}
      </div>
      {sort && (
        <div className="flex items-center gap-2 text-[11.5px] text-dim">
          <span>Sort</span>
          <span className="flex h-7 items-center gap-1.5 rounded-lg border border-border bg-s1 px-2.5 text-text">
            Closest date <ChevronDown size={13} className="text-dim" />
          </span>
        </div>
      )}
    </div>
  )
}
