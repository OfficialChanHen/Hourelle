'use client'

import { answeredLine } from '@/lib/answers'
import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import Link from 'next/link'
import { Bell, CalendarClock, CalendarRange, ChevronRight, Hourglass, MapPin, Undo2, UserCheck, Video, Vote } from 'lucide-react'
import { TimezonePill } from '@/components/ui/TimezonePill'
import { dateRangeText, fmtMinute, listEvents, respondedCount, type AppEvent } from '@/lib/events'
import { deriveNotifications, markAllNotificationsSeen, seenNotificationKeys, type NotificationItem } from '@/lib/notifications'
import { useLiveEvents } from '@/hooks/useLiveEvents'
import { reducedMotion } from '@/lib/prefs'

type Bucket = { title: string; items: NotificationItem[] }

export default function NotificationsPage() {
  const [events, setEvents] = useState<AppEvent[] | null>(null)
  // anything you hadn't seen before wears a "New" chip for the rest of this visit.
  // Seen keys are saved straight away, so the next visit starts calm; ones that
  // arrive live while the page is open join the set.
  const [fresh, setFresh] = useState<Set<string>>(new Set())
  useEffect(() => { setEvents(listEvents()) }, [])
  // new replies and votes from other people should raise alerts without a reload
  useLiveEvents(() => setEvents(listEvents()))
  useEffect(() => {
    if (!events) return
    const seen = seenNotificationKeys()
    const unseen = deriveNotifications(events).filter((n) => !seen.has(n.key)).map((n) => n.key)
    markAllNotificationsSeen()
    if (unseen.length) setFresh((prev) => new Set([...prev, ...unseen]))
  }, [events])

  const notifications = deriveNotifications(events ?? [])
  const buckets: Bucket[] = [
    { title: 'Today', items: notifications.filter((r) => r.du <= 0) },
    { title: 'This week', items: notifications.filter((r) => r.du > 0 && r.du <= 7) },
    { title: 'Later', items: notifications.filter((r) => r.du > 7) },
  ].filter((b) => b.items.length > 0)

  // shared card shell
  const cardCls = 'flex items-center gap-3 rounded-xl border border-border bg-s1 p-3.5 transition-transform hover:-translate-y-0.5 hover:border-border2'
  // the plan's name, with the chip beside it when the item is new
  const titleOf = (title: string, key: string) => (
    <div className="flex min-w-0 items-center gap-2">
      <span className="truncate text-[14.5px] font-semibold">{title}</span>
      {fresh.has(key) && <NewChip />}
    </div>
  )

  return (
    <div className="mx-auto max-w-[760px] px-4 pb-[92px] pt-[34px] sm:px-[26px]">
      <h1 className="font-serif font-normal text-[33.5px] leading-[1.04] tracking-[-0.01em]">Notifications</h1>
      <p className="mt-1.5 text-[13.5px] text-dim">Locked-in plans, reopened plans, open votes, and polls waiting on you.</p>

      {events === null ? (
        /* localStorage only exists after mount — pulse rows, never a flash of "caught up" */
        <div className="mt-6 flex flex-col gap-2">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="h-[68px] animate-pulse rounded-xl bg-s2" />
          ))}
        </div>
      ) : buckets.length === 0 ? (
        <div className="mt-6 grid min-h-[300px] place-items-center rounded-2xl border border-dashed border-border2 bg-s1 px-6 text-center">
          <div className="max-w-sm">
            <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl border border-border bg-s2 text-dim"><Bell size={22} /></span>
            <p className="font-serif text-[25px] tracking-[-0.01em]">You&apos;re all caught up</p>
            <p className="mt-1.5 text-[13px] leading-[1.55] text-dim">When a plan locks in, its reminders land here.</p>
          </div>
        </div>
      ) : (
        buckets.map((b) => (
          <div key={b.title} className="mt-6">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[.13em] text-faint">{b.title}</div>
            <div className="flex flex-col gap-2">
              {b.items.map(({ e, du, kind, key }) => {
                if (kind === 'plan-deadline') {
                  return (
                    <Link key={key} href={`/events/${e.id}?tab=details`} className={cardCls}>
                      <span className={`grid h-[38px] w-[38px] flex-none place-items-center rounded-[10px] border ${du <= 0 ? 'border-ochre-border bg-ochre-bg text-ochre-text' : 'border-border bg-s2 text-dim'}`}>
                        <Hourglass size={19} />
                      </span>
                      <div className="min-w-0 flex-1">
                        {titleOf(e.title, key)}
                        <div className="mt-0.5 text-[12.5px] text-dim">Planning wraps up {du <= 0 ? 'today' : 'tomorrow'}{e.hostedByYou ? ', time to lock it in' : ''}</div>
                      </div>
                      <ChevronRight size={17} className="flex-none text-faint" />
                    </Link>
                  )
                }
                if (kind === 'rsvp-deadline') {
                  return (
                    <Link key={key} href={`/events/${e.id}?tab=details`} className={cardCls}>
                      <span className={`grid h-[38px] w-[38px] flex-none place-items-center rounded-[10px] border ${du <= 0 ? 'border-ochre-border bg-ochre-bg text-ochre-text' : 'border-border bg-s2 text-dim'}`}>
                        <UserCheck size={19} />
                      </span>
                      <div className="min-w-0 flex-1">
                        {titleOf(e.title, key)}
                        <div className="mt-0.5 text-[12.5px] text-dim">RSVPs are due {du <= 0 ? 'today' : 'tomorrow'}</div>
                      </div>
                      <ChevronRight size={17} className="flex-none text-faint" />
                    </Link>
                  )
                }
                if (kind === 'rsvp-closed') {
                  // the host's tally once the soft deadline passes — a wrap-up, not a lock
                  const counts = { attending: 0, maybe: 0, not_going: 0, pending: 0 }
                  for (const p of e.participants) counts[p.rsvp]++
                  const tally = [
                    `${counts.attending} going`,
                    counts.maybe > 0 && `${counts.maybe} maybe`,
                    counts.not_going > 0 && `${counts.not_going} can’t go`,
                    counts.pending > 0 && `${counts.pending} no reply`,
                  ].filter(Boolean).join(', ')
                  return (
                    <Link key={key} href={`/events/${e.id}?tab=attendance`} className={cardCls}>
                      <span className="grid h-[38px] w-[38px] flex-none place-items-center rounded-[10px] border border-teal-border bg-teal-bg text-teal-text">
                        <UserCheck size={19} />
                      </span>
                      <div className="min-w-0 flex-1">
                        {titleOf(e.title, key)}
                        <div className="mt-0.5 text-[12.5px] text-dim">RSVPs were due {dateRangeText({ startDate: e.rsvpDeadline!, endDate: e.rsvpDeadline! })}: {tally}</div>
                      </div>
                      <ChevronRight size={17} className="flex-none text-faint" />
                    </Link>
                  )
                }
                if (kind === 'reopened') {
                  return (
                    <Link key={key} href={`/events/${e.id}?tab=details`} className={cardCls}>
                      <span className="grid h-[38px] w-[38px] flex-none place-items-center rounded-[10px] border border-ochre-border bg-ochre-bg text-ochre-text">
                        <Undo2 size={19} />
                      </span>
                      <div className="min-w-0 flex-1">
                        {titleOf(e.title, key)}
                        <div className="mt-0.5 text-[12.5px] text-dim">{e.hostName} has reopened for planning</div>
                      </div>
                      <ChevronRight size={17} className="flex-none text-faint" />
                    </Link>
                  )
                }
                if (kind === 'availability') {
                  const replied = respondedCount(e.avail, e.unavailableIds)
                  return (
                    <Link key={key} href={`/events/${e.id}?tab=availability`} className={cardCls}>
                      <span className={`grid h-[38px] w-[38px] flex-none place-items-center rounded-[10px] border ${du <= 0 ? 'border-accent-border bg-accent-bg text-accent-text' : 'border-border bg-s2 text-dim'}`}>
                        <CalendarRange size={19} />
                      </span>
                      <div className="min-w-0 flex-1">
                        {titleOf(e.title, key)}
                        <div className="mt-0.5 text-[12.5px] text-dim">
                          Waiting on your availability. {answeredLine(replied, e.participants.length)}
                        </div>
                      </div>
                      <ChevronRight size={17} className="flex-none text-faint" />
                    </Link>
                  )
                }
                if (kind === 'votes') {
                  return (
                    <Link key={key} href={`/events/${e.id}?tab=location`} className={cardCls}>
                      <span className={`grid h-[38px] w-[38px] flex-none place-items-center rounded-[10px] border ${du <= 0 ? 'border-ochre-border bg-ochre-bg text-ochre-text' : 'border-border bg-s2 text-dim'}`}>
                        <Vote size={19} />
                      </span>
                      <div className="min-w-0 flex-1">
                        {titleOf(e.title, key)}
                        <div className="mt-0.5 text-[12.5px] text-dim">
                          Voting closes {du <= 0 ? 'today' : `in ${du} day${du === 1 ? '' : 's'}`}, with {e.location.places.length} place{e.location.places.length === 1 ? '' : 's'} on the ballot
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
                  : c.placeIds.map((id) => e.location.places.find((p) => p.id === id)?.name).filter(Boolean).join(', ') || 'Place still open'
                return (
                  <Link key={key} href={`/events/${e.id}?tab=details`} className={cardCls}>
                    <span className={`grid h-[38px] w-[38px] flex-none place-items-center rounded-[10px] border ${du <= 0 ? 'border-accent-border bg-accent-bg text-accent-text' : 'border-teal-border bg-teal-bg text-teal-text'}`}>
                      <CalendarClock size={19} />
                    </span>
                    <div className="min-w-0 flex-1">
                      {titleOf(e.title, key)}
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12.5px] text-dim">
                        <span>
                          {du <= 0 ? 'Today' : `In ${du} day${du === 1 ? '' : 's'}`}, locked in
                          {day ? ` for ${day.dow}, ${day.date}` : ''}
                          {c.startMin === 0 && c.endMin === 24 * 60 ? '' : ` at ${fmtMinute(c.startMin)}`}
                          {c.endDayKey && (() => {
                            // a timed run says when it ends as well as when it starts
                            const ed = e.days.find((d) => d.key === c.endDayKey)
                            if (!ed) return ''
                            return c.startMin === 0 && c.endMin === 24 * 60 ? ` – ${ed.dow}, ${ed.date}` : `, until ${ed.dow}, ${ed.date} at ${fmtMinute(c.endMin)}`
                          })()}
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

/* "New", on an item you had not seen before: a small accent chip that pops in once
   beside the plan's name and stays for the visit. */
function NewChip() {
  const ref = useRef<HTMLSpanElement>(null)
  useGSAP(() => {
    if (reducedMotion() || !ref.current) return
    gsap.from(ref.current, { scale: 0.4, opacity: 0, rotate: -8, duration: 0.45, delay: 0.15, ease: 'back.out(2.2)' })
  }, { scope: ref })
  return (
    <span ref={ref} className="inline-flex h-[20px] flex-none items-center rounded-full border border-accent-border bg-accent-bg px-2 text-[11.5px] font-semibold leading-none text-accent-text">
      New
    </span>
  )
}
