// What the reminder job owes today, worked out per event in its own timezone.
// Kept apart from the route so it can be exercised without a server.

import { phaseOf, type AppEvent, type Participant } from '@/lib/events'
import type { MailKind } from './mail'

export type Due = { kind: MailKind; day: string; people: Participant[]; pref: 'eventDay' | 'deadlines' }

// today and tomorrow as YYYY-MM-DD in a timezone
export function localDays(tz: string, now: Date): { today: string; tomorrow: string } {
  const fmt = (d: Date) => {
    try {
      const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d)
      const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
      return `${get('year')}-${get('month')}-${get('day')}`
    } catch { return d.toISOString().slice(0, 10) }
  }
  return { today: fmt(now), tomorrow: fmt(new Date(now.getTime() + 86_400_000)) }
}

/** Which reminders an event owes right now, and to whom. Two per happening: the
 *  day before ("-eve") and the day of ("-day"). Locked-in events remind everyone
 *  who has not said no, and chase pending RSVPs before the RSVP deadline; events
 *  still being planned chase the host before the plan-by date and the people who
 *  have not voted before the vote closes. */
export function dueFor(ev: AppEvent, now: Date): Due[] {
  const { today, tomorrow } = localDays(ev.timezone || 'UTC', now)
  const out: Due[] = []
  const band = (key: string | undefined): 'eve' | 'day' | null => (key === tomorrow ? 'eve' : key === today ? 'day' : null)
  const host = ev.participants.find((p) => p.host)
  const going = ev.participants.filter((p) => p.rsvp !== 'not_going')

  if (ev.status === 'confirmed' && ev.confirmed) {
    const b = band(ev.confirmed.dayKey)
    // "today" only until it is over. The job runs at one hour of the day, and for an
    // event that finished before that hour, in its own timezone, a note saying it is
    // today would arrive after everyone had already been and gone. phaseOf knows the
    // end time, not just the day.
    const over = phaseOf(ev) === 'past'
    if (b && !over) out.push({ kind: `event-${b}`, day: ev.confirmed.dayKey, people: going, pref: 'eventDay' })
    if (ev.rsvpDeadline) {
      const rb = band(ev.rsvpDeadline)
      if (rb) out.push({ kind: `rsvp-${rb}`, day: ev.rsvpDeadline, people: ev.participants.filter((p) => p.rsvp === 'pending' && !p.host), pref: 'deadlines' })
    }
  } else {
    if (ev.planDeadline && host) {
      const pb = band(ev.planDeadline)
      if (pb) out.push({ kind: `plan-${pb}`, day: ev.planDeadline, people: [host], pref: 'deadlines' })
    }
    if (ev.voteDeadline) {
      const vb = band(ev.voteDeadline)
      if (vb) {
        const voted = new Set(Object.values(ev.votes ?? {}).flat())
        out.push({ kind: `vote-${vb}`, day: ev.voteDeadline, people: ev.participants.filter((p) => !voted.has(p.id) && p.rsvp !== 'not_going'), pref: 'deadlines' })
      }
    }
  }
  return out
}
