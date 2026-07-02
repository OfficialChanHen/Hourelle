import { Search, ChevronDown, History, CalendarX2 } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'

const FILTERS = ['All', 'Hosting', 'Attending', 'Planning', 'Confirmed']

export default function EventsPage() {
  return (
    <div className="mx-auto max-w-[1240px] px-[26px] pb-[104px] pt-[34px]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3.5">
        <div>
          <h1 className="mb-1.5 font-serif text-[32px] leading-[1.02] tracking-[-0.01em]">Events</h1>
          <div className="text-[12px] text-dim">0 upcoming · 0 past · hosting 0</div>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="flex h-[34px] w-[220px] items-center gap-2 rounded-[9px] border border-border bg-s1 px-3">
            <Search size={14} className="text-dim" />
            <span className="text-[12px] text-faint">Search events…</span>
          </div>
          <span className="flex h-[34px] cursor-pointer items-center gap-1.5 rounded-[9px] border border-border bg-s1 px-2.5 text-[11.5px] text-dim">
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

      <EmptyState
        icon={CalendarX2}
        title="No events yet"
        body="You're not hosting or attending anything right now. Create your first event and it'll show up here."
        action={{ label: 'Create an event', href: '/create' }}
      />

      {/* Past events */}
      <div className="mb-3 mt-7 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[13px] font-semibold">
          <History size={14} className="text-dim" /> Past events
          <span className="rounded-full border border-border bg-s2 px-[7px] py-px text-[10.5px] text-dim">0</span>
        </div>
      </div>
      <EmptyState icon={History} title="No past events" body="Once an event wraps up, it moves here so you can look back on it." compact />
    </div>
  )
}
