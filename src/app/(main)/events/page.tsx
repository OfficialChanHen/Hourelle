import { Search, ChevronDown, History } from 'lucide-react'
import { EventCard } from '@/components/ui/EventCard'
import { AvatarRow } from '@/components/ui/AvatarRow'
import { TimezonePill } from '@/components/ui/TimezonePill'
import { Badge } from '@/components/ui/Badge'
import { allEvents, pastEvents } from '@/lib/home'
import { Calendar } from 'lucide-react'

const FILTERS = ['All', 'Hosting', 'Attending', 'Planning', 'Confirmed']

export default function EventsPage() {
  return (
    <div className="mx-auto max-w-[1240px] px-[26px] pb-[104px] pt-[34px]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3.5">
        <div>
          <h1 className="mb-1.5 font-serif text-[32px] leading-[1.02] tracking-[-0.01em]">Events</h1>
          <div className="text-[12px] text-dim">6 upcoming · 3 past · hosting 3</div>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="flex h-[34px] w-[220px] items-center gap-2 rounded-[9px] border border-border bg-s1 px-3">
            <Search size={14} className="text-dim" />
            <span className="text-[12px] text-faint">Search events…</span>
          </div>
          <span className="flex h-[34px] cursor-pointer items-center gap-1.5 rounded-[9px] border border-border bg-s1 px-2.5 text-[11.5px]">
            Closest date <ChevronDown size={13} className="text-dim" />
          </span>
        </div>
      </div>

      {/* filter pills */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {FILTERS.map((f, i) => (
          <span
            key={f}
            className={`flex h-[30px] cursor-pointer items-center rounded-full px-[13px] text-[11.5px] ${
              i === 0 ? 'bg-accent font-semibold text-on-accent' : 'border border-border bg-s1 font-medium text-dim'
            }`}
          >
            {f}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-[13px] sm:grid-cols-2 lg:grid-cols-3">
        {allEvents.map((e) => <EventCard key={e.title} e={e} />)}
      </div>

      {/* Past events */}
      <div className="mb-3 mt-7 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[13px] font-semibold">
          <History size={14} className="text-dim" /> Past events
          <span className="rounded-full border border-border bg-s2 px-[7px] py-px text-[10.5px] text-dim">{pastEvents.length}</span>
        </div>
        <span className="cursor-pointer text-[11.5px] font-semibold text-accent-text">View all →</span>
      </div>
      <div className="grid grid-cols-1 gap-[13px] sm:grid-cols-2 lg:grid-cols-3">
        {pastEvents.map((e) => (
          <div key={e.title} className="rounded-[13px] border border-border bg-s1 p-3.5 opacity-75 transition-opacity hover:opacity-100">
            <div className="mb-2.5 flex items-center justify-between">
              <Badge variant="teal">{e.badge.text}</Badge>
              <span className="text-[10.5px] text-faint">{e.days.text}</span>
            </div>
            <h3 className="mb-[9px] text-[13.5px] font-semibold tracking-[-0.01em]">{e.title}</h3>
            <div className="mb-[11px] flex items-center gap-1.5 text-[11.5px] text-dim">
              <Calendar size={13} /> {e.date} <TimezonePill tz={e.tz === 'EDT' ? 'America/New_York' : 'America/Los_Angeles'} />
            </div>
            <div className="flex items-center justify-between">
              <AvatarRow people={e.avatars} size={21} max={3} more={e.more} />
              <span className="text-[11px] text-faint">{e.going}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
