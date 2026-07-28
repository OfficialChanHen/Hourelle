'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Bell, CalendarClock, CalendarRange, ChevronRight, MapPin, Undo2, Video, Vote } from 'lucide-react'
import { TimezonePill } from '@/components/ui/TimezonePill'
import { fmtMinute, listEvents, respondedCount, type AppEvent } from '@/lib/events'
import { deriveNotifications, markAllNotificationsSeen, seenNotificationKeys, type NotificationItem } from '@/lib/notifications'

type Bucket = { title: string; items: NotificationItem[] }

export default function NotificationsPage() {
  const [events, setEvents] = useState<AppEvent[] | null>(null)
  // anything you haven't seen before gets a short highlight, then settles in
  const [fresh, setFresh] = useState<Set<string>>(new Set())
  useEffect(() => { setEvents(listEvents()) }, [])
  useEffect(() => {
    if (!events) return
    const seen = seenNotificationKeys()
    const f = new Set(deriveNotifications(events).filter((n) => !seen.has(n.key)).map((n) => n.key))
    setFresh(f)
    markAllNotificationsSeen()
    if (f.size === 0) return
    const t = setTimeout(() => setFresh(new Set()), 2400)
    return () => clearTimeout(t)
  }, [events])

  const notifications = deriveNotifications(events ?? [])
  const buckets: Bucket[] = [
    { title: 'Today', items: notifications.filter((r) => r.du <= 0) },
    { title: 'This week', items: notifications.filter((r) => r.du > 0 && r.du <= 7) },
    { title: 'Later', items: notifications.filter((r) => r.du > 7) },
  ].filter((b) => b.items.length > 0)

  // shared card shell; fresh ones glow briefly, then the color eases away
  const cardCls = (key: string) =>
    `flex items-center gap-3 rounded-xl border p-3.5 transition-all duration-700 hover:-translate-y-0.5 ${
      fresh.has(key) ? 'border-accent-border bg-accent-bg/40' : 'border-border bg-s1 hover:border-border2'
    }`

  return (
    <div className="mx-auto max-w-[760px] px-4 pb-[104px] pt-[34px] sm:px-[26px]">
      <h1 className="font-serif text-[33.5px] leading-[1.04] tracking-[-0.01em]">Notifications</h1>
      <p className="mt-1.5 text-[13.5px] text-dim">Locked-in plans, reopened plans, open votes, and polls waiting on you.</p>

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
              {b.items.map(({ e, du, kind, key }) => {
                if (kind === 'reopened') {
                  return (
                    <Link key={key} href={`/events/${e.id}?tab=details`} className={cardCls(key)}>
                      <span className="grid h-[38px] w-[38px] flex-none place-items-center rounded-[10px] border border-ochre-border bg-ochre-bg text-ochre-text">
                        <Undo2 size={19} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[14.5px] font-semibold">{e.title}</div>
                        <div className="mt-0.5 text-[12.5px] text-dim">{e.hostName} has reopened for planning</div>
                      </div>
                      <ChevronRight size={17} className="flex-none text-faint" />
                    </Link>
                  )
                }
                if (kind === 'availability') {
                  const replied = respondedCount(e.avail, e.unavailableIds)
                  return (
                    <Link key={key} href={`/events/${e.id}?tab=availability`} className={cardCls(key)}>
                      <span className={`grid h-[38px] w-[38px] flex-none place-items-center rounded-[10px] border ${du <= 0 ? 'border-accent-border bg-accent-bg text-accent-text' : 'border-border bg-s2 text-dim'}`}>
                        <CalendarRange size={19} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[14.5px] font-semibold">{e.title}</div>
                        <div className="mt-0.5 text-[12.5px] text-dim">
                          Waiting on your availability · {replied} of {e.participants.length} replied so far
                        </div>
                      </div>
                      <ChevronRight size={17} className="flex-none text-faint" />
                    </Link>
                  )
                }
                if (kind === 'votes') {
                  return (
                    <Link key={key} href={`/events/${e.id}?tab=location`} className={cardCls(key)}>
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
                  <Link key={key} href={`/events/${e.id}?tab=details`} className={cardCls(key)}>
                    <span className={`grid h-[38px] w-[38px] flex-none place-items-center rounded-[10px] border ${du <= 0 ? 'border-accent-border bg-accent-bg text-accent-text' : 'border-teal-border bg-teal-bg text-teal-text'}`}>
                      <CalendarClock size={19} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14.5px] font-semibold">{e.title}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12.5px] text-dim">
                        <span>
                          Locked in · {du <= 0 ? 'today' : `in ${du} day${du === 1 ? '' : 's'}`}
                          {day ? ` · ${day.dow}, ${day.date}` : ''}
                          {c.endDayKey && (() => { const ed = e.days.find((d) => d.key === c.endDayKey); return ed ? ` – ${ed.dow}, ${ed.date}` : '' })()}
                          {c.startMin === 0 && c.endMin === 24 * 60 ? '' : ` · ${fmtMinute(c.startMin)}`}
                        </span>
                        {!(c.startMin === 0 && c.endMin === 24 * 60) && <TimezonePill tz={e.timezone} />}
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
