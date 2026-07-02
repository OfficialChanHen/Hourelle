import {
  Calendar, Zap, ChevronDown, CalendarCheck, CalendarClock,
  CalendarPlus, CalendarX2, Compass, type LucideIcon,
} from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'

export default function HomePage() {
  return (
    <div className="mx-auto max-w-[1240px] px-[26px] pb-[104px] pt-[34px]">
      {/* greeting */}
      <div className="mb-5">
        <h1 className="mb-[9px] font-serif text-[33px] leading-[1.02] tracking-[-0.01em]">Good afternoon, Jordan</h1>
        <div className="flex items-center gap-3.5 text-[12px] text-dim">
          <span className="flex items-center gap-1.5"><Calendar size={13} /> No events yet</span>
        </div>
      </div>

      {/* Current event */}
      <SectionHeader icon={Zap} iconColor="var(--accent-text)" title="Current event" />
      <EmptyState
        icon={CalendarPlus}
        title="No current event"
        body="When you create or join an event, it shows up here with its date, location, and planning progress."
        action={{ label: 'Create an event', href: '/create' }}
      />

      {/* Your events */}
      <SectionHeader icon={CalendarCheck} title="Your events" count={0} sort className="mt-[26px]" />
      <EmptyState
        icon={CalendarX2}
        title="You haven't created any events"
        body="Start from scratch or pick a template — availability, location voting, and attendance come built in."
        action={{ label: 'Create an event', href: '/create' }}
        compact
      />

      {/* Upcoming events */}
      <SectionHeader icon={CalendarClock} title="Upcoming events" count={0} sort className="mt-[26px]" />
      <EmptyState
        icon={Compass}
        title="Nothing on the horizon"
        body="Events you're invited to will appear here. Share a link or invite people to get the ball rolling."
        compact
      />
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
        <div className="flex items-center gap-2 text-[11.5px] text-faint">
          <span>Sort</span>
          <span className="flex h-7 items-center gap-1.5 rounded-lg border border-border bg-s1 px-2.5 text-dim">
            Closest date <ChevronDown size={13} className="text-faint" />
          </span>
        </div>
      )}
    </div>
  )
}
