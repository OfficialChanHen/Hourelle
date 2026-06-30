import Link from 'next/link'
import { LifecycleProgress } from '@/components/ui/LifecycleProgress'
import { AvatarRow } from '@/components/ui/AvatarRow'
import { Badge } from '@/components/ui/Badge'
import { TimezonePill } from '@/components/ui/TimezonePill'
import { event, participants } from '@/lib/sample'

export default function HomePage() {
  const going = participants.filter((p) => p.rsvp === 'attending')

  return (
    <div className="mx-auto max-w-[1240px] px-6 pb-20 pt-8 lg:px-8">
      <p className="text-[11px] font-semibold uppercase tracking-[.13em] text-faint">Your current event</p>
      <h1 className="mt-1 font-serif text-[40px] leading-[1.05] tracking-[-0.01em] text-text">
        Good afternoon, Jordan
      </h1>

      {/* hero / current event */}
      <section className="mt-7 overflow-hidden rounded-2xl border border-border bg-s1 shadow-soft">
        <div className="grid gap-8 p-6 md:grid-cols-[1.4fr_1fr] md:p-8">
          <div>
            <div className="flex items-center gap-2.5">
              <Badge variant="ochre" dot>Collecting availability</Badge>
              <Badge variant="accent">{event.daysAway} days away</Badge>
            </div>
            <h2 className="mt-4 font-serif text-[34px] leading-tight tracking-[-0.01em]">{event.title}</h2>
            <p className="mt-2 max-w-md text-[14px] leading-relaxed text-dim">{event.description}</p>

            <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-4">
              <Stat label="When" value={event.dateRange} tz={event.timezone} />
              <Stat label="Hosted by" value={event.host_name} />
              <Stat label="Going" value={`${going.length} of ${participants.length}`} />
            </div>

            <div className="mt-6 flex items-center gap-3">
              <Link
                href={`/events/${event.id}?tab=availability`}
                className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-[13.5px] font-semibold text-on-accent shadow-soft transition-transform hover:-translate-y-px"
              >
                Open event
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </Link>
              <AvatarRow people={going.map((p) => ({ initials: p.initials, color: p.color, name: p.name }))} size="md" />
            </div>
          </div>

          <div className="flex flex-col justify-between gap-6 rounded-xl border border-border bg-s0 p-6">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[.13em] text-faint">Lifecycle</p>
              <p className="mt-1.5 text-[13px] text-dim">Step 2 of 5 — waiting on {participants.length - going.length} replies.</p>
            </div>
            <LifecycleProgress currentStage={event.status} />
          </div>
        </div>
      </section>

      {/* quick entries */}
      <div className="mt-9 grid gap-4 sm:grid-cols-2">
        <Link
          href="/create"
          className="group rounded-2xl border border-dashed border-border2 bg-s1 p-6 transition-colors hover:border-accent-border hover:bg-accent-bg/40"
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[.13em] text-faint">Start something</p>
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-on-accent">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            </span>
          </div>
          <h3 className="mt-4 font-serif text-[24px] tracking-[-0.01em]">Create a new event</h3>
          <p className="mt-1.5 text-[13px] text-dim">Basics, invites, and a share link in three quick steps.</p>
        </Link>

        <Link
          href={`/events/${event.id}?tab=availability`}
          className="group rounded-2xl border border-border bg-s1 p-6 transition-colors hover:border-border2"
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[.13em] text-faint">Jump back in</p>
            <AvatarRow people={participants.slice(0, 4).map((p) => ({ initials: p.initials, color: p.color }))} size="sm" max={4} />
          </div>
          <h3 className="mt-4 font-serif text-[24px] tracking-[-0.01em]">{event.title}</h3>
          <p className="mt-1.5 text-[13px] text-dim">Mark your availability and chat with the group.</p>
        </Link>
      </div>
    </div>
  )
}

function Stat({ label, value, tz }: { label: string; value: string; tz?: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[.13em] text-faint">{label}</p>
      <p className="mt-1 flex items-center gap-1.5 font-serif text-[22px] leading-none tracking-[-0.01em]">
        {value}
        {tz && <TimezonePill tz={tz} />}
      </p>
    </div>
  )
}
