// The locked-in plan as a calendar entry (RFC 5545), the same file whether it rides
// in an email or is downloaded from the event page. Nothing here touches storage or
// the network, so the server can use it too.
//
// One stable UID per event and a SEQUENCE that rises with every lock-in, so a mail
// client that already added the entry updates it in place instead of adding a twin.
// METHOD:PUBLISH rather than REQUEST: the mailbox offers "add to calendar" without
// RSVP buttons that would reply to a sending address nobody reads.

import type { AppEvent } from './events'
import { zonedToUtc } from './tz'

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
// long lines fold at 75 octets with a leading space on the continuation. Byte
// counts through TextEncoder, which the browser and Node both have.
const bytes = (s: string) => new TextEncoder().encode(s).length
function fold(line: string): string {
  const out: string[] = []
  let rest = line
  while (bytes(rest) > 75) {
    let cut = 75
    while (cut > 1 && bytes(rest.slice(0, cut)) > 75) cut--
    out.push(rest.slice(0, cut))
    rest = ' ' + rest.slice(cut)
  }
  out.push(rest)
  return out.join('\r\n')
}
const stamp = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
const dateOnly = (iso: string) => iso.replace(/-/g, '')
function plusDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + 1))
  return dt.toISOString().slice(0, 10)
}

/** Where it is, as a calendar app wants it: the chosen place, or the meeting link
 *  for an online event (calendar apps turn that into a join button). */
export function icsLocation(ev: AppEvent): string {
  const ids = ev.confirmed?.placeIds ?? []
  const names = ids.map((id) => ev.location.places.find((p) => p.id === id)?.name).filter((n): n is string => !!n)
  if (names.length) return names.join(', ')
  if (ev.location.mode === 'remote') return ev.location.meetingLink || (ev.location.platform ? `Online on ${ev.location.platform}` : 'Online')
  if (ev.location.mode === 'set' && ev.location.places[0]) return ev.location.places[0].name
  return ''
}

// one plan's VEVENT lines, or null while nothing is locked in. `status` is said only
// in the feed, where it carries your own reply (CONFIRMED going, TENTATIVE not yet)
function vevent(ev: AppEvent, link: string, now: number, status?: 'CONFIRMED' | 'TENTATIVE'): string[] | null {
  const c = ev.confirmed
  if (!c || !/^\d{4}-\d{2}-\d{2}$/.test(c.dayKey)) return null
  const allDay = c.startMin === 0 && c.endMin === 24 * 60
  const lines = [
    'BEGIN:VEVENT',
    `UID:${ev.id}@hourelle.com`,
    `DTSTAMP:${stamp(now)}`,
    `SEQUENCE:${ev.confirmedAt ? Math.floor(ev.confirmedAt / 1000) : 0}`,
  ]
  if (allDay) {
    lines.push(`DTSTART;VALUE=DATE:${dateOnly(c.dayKey)}`, `DTEND;VALUE=DATE:${dateOnly(plusDay(c.endDayKey ?? c.dayKey))}`)
  } else {
    lines.push(
      `DTSTART:${stamp(zonedToUtc(c.dayKey, c.startMin, ev.timezone))}`,
      `DTEND:${stamp(zonedToUtc(c.endDayKey ?? c.dayKey, c.endMin, ev.timezone))}`,
    )
  }
  lines.push(`SUMMARY:${esc(ev.title)}`)
  const where = icsLocation(ev)
  if (where) lines.push(`LOCATION:${esc(where)}`)
  const description = [ev.description.trim(), `The plan, the people and the chat: ${link}`].filter(Boolean).join('\n\n')
  lines.push(`DESCRIPTION:${esc(description)}`, `URL:${link}`)
  if (status) lines.push(`STATUS:${status}`)
  lines.push('END:VEVENT')
  return lines
}

/** The .ics text for a locked-in event, or null while nothing is locked in. `link`
 *  is the reader's own way into the event and goes in the description and URL. */
export function icsFor(ev: AppEvent, link: string, now = Date.now()): string | null {
  const body = vevent(ev, link, now)
  if (!body) return null
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Hourelle//Event//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', ...body, 'END:VCALENDAR']
  return lines.map(fold).join('\r\n') + '\r\n'
}

/* ── the subscribed feed: every locked-in plan one person is on ──
   The same entries as the single file, with the same UID and SEQUENCE, so a plan
   added by hand earlier and then seen in the feed is one entry, not two. What is in
   it is decided by `feedStatus`; anything it leaves out disappears from the
   subscriber's calendar on the next fetch, which is how a reopened plan goes. */
export type FeedEntry = { ev: AppEvent; link: string; status: 'CONFIRMED' | 'TENTATIVE' }

/** Whether a plan belongs in this person's feed, and how sure: going is CONFIRMED,
 *  maybe or no reply yet is TENTATIVE, can't go (or not on the plan) is left out. A
 *  plan with no locked time, including one that reopened, is left out too. */
export function feedStatus(ev: AppEvent, personId: string): FeedEntry['status'] | null {
  if (ev.demo || !ev.confirmed) return null
  const p = ev.participants.find((x) => x.id === personId)
  if (!p || p.rsvp === 'not_going') return null
  return p.rsvp === 'attending' ? 'CONFIRMED' : 'TENTATIVE'
}

export function icsFeed(entries: FeedEntry[], now = Date.now()): string {
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Hourelle//Plans//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'X-WR-CALNAME:Hourelle',
    // a hint, which Apple and Outlook take; Google keeps its own pace
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H', 'X-PUBLISHED-TTL:PT1H',
  ]
  for (const e of entries) lines.push(...(vevent(e.ev, e.link, now, e.status) ?? []))
  lines.push('END:VCALENDAR')
  return lines.map(fold).join('\r\n') + '\r\n'
}

/** A safe file name for the entry: the title's letters and digits, hyphenated. */
export function icsFileName(ev: AppEvent): string {
  const stem = ev.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `${stem || 'plan'}.ics`
}
