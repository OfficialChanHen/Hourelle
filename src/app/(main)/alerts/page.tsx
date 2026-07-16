'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Bell, CalendarClock, ChevronRight, MapPin, Video, Vote } from 'lucide-react'
import { TimezonePill } from '@/components/ui/TimezonePill'
import { daysUntil, fmtMinute, listEvents, phaseOf, type AppEvent } from '@/lib/events'

type Reminder = { e: AppEvent; du: number; kind: 'event' | 'votes' }
type Bucket = { title: string; items: Reminder[] }

export default function AlertsPage() {
  const [events, setEvents] = useState<AppEvent[] | null>(null)
  useEffect(() => { setEvents(listEvents()) }, [])

  // reminders are derived, not stored: confirmed events that haven't happened yet,
  // plus voting deadlines still open on events being planned
  const reminders: Reminder[] = (events ?? [])
    .flatMap((e): Reminder[] => {
      const phase = phaseOf(e)
      if (e.confirmed && ['today', 'soon', 'upcoming'].includes(phase)) {
        return [{ e, du: daysUntil(e.confirmed.dayKey) ?? 0, kind: 'event' }]
      }
      if (phase === 'planning' && e.voteDeadline) {
        const du = daysUntil(e.voteDeadline)
        if (du !== null && du >= 0) return [{ e, du, kind: 'votes' }]
      }
      return []
    })
    .sort((a, b) => a.du - b.du)

  const buckets: Bucket[] = [
    { title: 'Today', items: reminders.filter((r) => r.du <= 0) },
    { title: 'This week', items: reminders.filter((r) => r.du > 0 && r.du <= 7) },
    { title: 'Later', items: reminders.filter((r) => r.du > 7) },
  ].filter((b) => b.items.length > 0)

  return (
    <div className="mx-auto max-w-[760px] px-4 pb-[104px] pt-[34px] sm:px-[26px]">
      <h1 className="font-serif text-[33.5px] leading-[1.04] tracking-[-0.01em]">Alerts</h1>
      <p className="mt-1.5 text-[13.5px] text-dim">Reminders for confirmed events and open votes.</p>

      {buckets.length === 0 ? (
        <div className="mt-6 grid min-h-[300px] place-items-center rounded-2xl border border-dashed border-border2 bg-s1 px-6 text-center">
          <div className="max-w-sm">
            <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl border border-border bg-s2 text-dim"><Bell size={22} /></span>
            <p className="font-serif text-[25px] tracking-[-0.01em]">You&apos;re all caught up</p>
            <p className="mt-1.5 text-[13px] leading-[1.55] text-dim">Once an event is locked in, its reminders show up here until the day itself.</p>
          </div>
        </div>
      ) : (
        buckets.map((b) => (
          <div key={b.title} className="mt-6">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[.13em] text-faint">{b.title}</div>
            <div className="flex flex-col gap-2">
              {b.items.map(({ e, du, kind }) => {
                if (kind === 'votes') {
                  return (
                    <Link key={`${e.id}-votes`} href={`/events/${e.id}?tab=location`} className="flex items-center gap-3 rounded-xl border border-border bg-s1 p-3.5 transition-all hover:-translate-y-0.5 hover:border-border2">
                      <span className={`grid h-[38px] w-[38px] flex-none place-items-center rounded-[10px] border ${du <= 0 ? 'border-ochre-border bg-ochre-bg text-ochre-text' : 'border-border bg-s2 text-dim'}`}>
                        <Vote size={19} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[14.5px] font-semibold">{e.title}</div>
                        <div className="mt-0.5 text-[12.5px] text-dim">
                          Voting closes {du <= 0 ? 'today' : `in ${du} day${du === 1 ? '' : 's'}`} · {e.location.places.length} place{e.location.places.length === 1 ? '' : 's'} on the ballot
                        </div>
                      </div>
                      <ChevronRight size={17} className="flex-none text-faint" />
                    </Link>
                  )
                }
                const c = e.confirmed!
                const day = e.days.find((d) => d.key === c.dayKey)
                const remote = e.location.mode === 'remote'
                const place = remote
                  ? `Online on ${e.location.platform}`
                  : c.placeIds.map((id) => e.location.places.find((p) => p.id === id)?.name).filter(Boolean).join(' · ') || 'Place still open'
                return (
                  <Link key={e.id} href={`/events/${e.id}`} className="flex items-center gap-3 rounded-xl border border-border bg-s1 p-3.5 transition-all hover:-translate-y-0.5 hover:border-border2">
                    <span className={`grid h-[38px] w-[38px] flex-none place-items-center rounded-[10px] border ${du <= 0 ? 'border-accent-border bg-accent-bg text-accent-text' : 'border-teal-border bg-teal-bg text-teal-text'}`}>
                      <CalendarClock size={19} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14.5px] font-semibold">{e.title}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12.5px] text-dim">
                        <span>{du <= 0 ? 'Today' : `In ${du} day${du === 1 ? '' : 's'}`}{day ? ` · ${day.dow}, ${day.date}` : ''} · {fmtMinute(c.startMin)}</span>
                        <TimezonePill tz={e.timezone} />
                        <span className="flex items-center gap-1">{remote ? <Video size={12} /> : <MapPin size={12} />} {place}</span>
                      </div>
                    </div>
                    <ChevronRight size={17} className="flex-none text-faint" />
                  </Link>
                )
              })}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
