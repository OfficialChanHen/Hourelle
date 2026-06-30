import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import { AvatarRow } from '@/components/ui/AvatarRow'
import { TimezonePill } from '@/components/ui/TimezonePill'
import { event, participants } from '@/lib/sample'

export default function EventsPage() {
  const going = participants.filter((p) => p.rsvp === 'attending')
  return (
    <div className="mx-auto max-w-[1240px] px-6 pb-20 pt-8 lg:px-8">
      <p className="text-[11px] font-semibold uppercase tracking-[.13em] text-faint">Your events</p>
      <h1 className="mt-1 font-serif text-[36px] tracking-[-0.01em]">Events</h1>

      <Link
        href={`/events/${event.id}?tab=availability`}
        className="mt-7 flex flex-wrap items-center gap-x-8 gap-y-3 rounded-xl border border-border bg-s1 p-5 shadow-soft transition-colors hover:border-border2"
      >
        <div className="min-w-[220px]">
          <Badge variant="ochre" dot>Collecting availability</Badge>
          <h2 className="mt-2.5 font-serif text-[24px] tracking-[-0.01em]">{event.title}</h2>
          <p className="mt-1 flex items-center gap-1.5 text-[13px] text-dim">
            {event.dateRange} <TimezonePill tz={event.timezone} />
          </p>
        </div>
        <div className="ml-auto flex items-center gap-5">
          <AvatarRow people={going.map((p) => ({ initials: p.initials, color: p.color, name: p.name }))} size="md" />
          <span className="text-[13px] font-semibold text-dim">{going.length} of {participants.length} going</span>
        </div>
      </Link>
    </div>
  )
}
