import { describe, expect, it } from 'vitest'
import { feedStatus, icsFeed, icsFor } from '@/lib/ics'
import { person, plan } from '../../../test/fixtures'
import { APP_NAME } from '@/lib/brand'

const locked = plan({
  id: 'dinner-abc', title: 'Dinner; at last, finally', description: 'Bring a coat\nand shoes',
  confirmed: { dayKey: '2026-10-20', startMin: 19 * 60, endMin: 21 * 60, placeIds: [] }, confirmedAt: 1760000000000,
  participants: [person('GO', { rsvp: 'attending' }), person('MAYBE', { rsvp: 'maybe' }), person('WAIT'), person('NO', { rsvp: 'not_going' })],
})

describe('icsFor', () => {
  it('writes the locked time as UTC instants with a stable id', () => {
    const ics = icsFor(locked, 'https://x/e', 0)!
    expect(ics).toContain('UID:dinner-abc@hourelle.com')
    expect(ics).toContain('DTSTART:20261021T000000Z') // 7 PM Chicago, daylight time
    expect(ics).toContain('DTEND:20261021T020000Z')
    expect(ics).toContain('SEQUENCE:1760000000')
  })
  it('escapes semicolons, commas and line breaks', () => {
    const ics = icsFor(locked, 'https://x/e', 0)!
    expect(ics).toContain('SUMMARY:Dinner\\; at last\\, finally')
    expect(ics).toContain('Bring a coat\\nand shoes')
  })
  it('folds long lines at 75 bytes', () => {
    for (const l of icsFor(locked, 'https://x/e', 0)!.split('\r\n')) expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75)
  })
  it('writes an all-day run with an exclusive end date', () => {
    const run = plan({ confirmed: { dayKey: '2026-10-20', endDayKey: '2026-10-22', startMin: 0, endMin: 1440, placeIds: [] } })
    const ics = icsFor(run, 'https://x/e', 0)!
    expect(ics).toContain('DTSTART;VALUE=DATE:20261020')
    expect(ics).toContain('DTEND;VALUE=DATE:20261023')
  })
  it('writes one entry per day for a run with its own hours, the first keeping the plan’s id', () => {
    const run = plan({
      id: 'trip',
      confirmed: {
        dayKey: '2026-11-20', endDayKey: '2026-11-22', startMin: 18 * 60, endMin: 13 * 60, placeIds: [],
        sessions: [
          { dayKey: '2026-11-20', startMin: 18 * 60, endMin: 22 * 60 },
          { dayKey: '2026-11-21', startMin: 11 * 60, endMin: 16 * 60 },
          { dayKey: '2026-11-22', startMin: 11 * 60, endMin: 13 * 60 },
        ],
      },
    })
    const ics = icsFor(run, 'https://x/e', 0)!
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(3)
    expect(ics).toContain('UID:trip@hourelle.com')
    expect(ics).toContain('UID:trip-2026-11-21@hourelle.com')
    expect(ics).toContain('UID:trip-2026-11-22@hourelle.com')
    expect(ics).toContain('DTSTART:20261121T170000Z') // Saturday 11 AM Chicago, standard time
    expect(ics).toContain('DTEND:20261121T220000Z')
  })
  it('says an open end in the description', () => {
    const open = plan({
      days: [{ key: '2026-10-20', dow: 'Tue', date: 'Oct 20' }],
      participants: [person('H', { host: true, you: true, rsvp: 'attending' }), person('A')],
      availIv: { '2026-10-20': { A: [{ s: 0, e: 4 * 60 }] } },
      confirmed: { dayKey: '2026-10-20', startMin: 9 * 60, endMin: 13 * 60, placeIds: [], openEnd: true },
    })
    const ics = icsFor(open, 'https://x/e', 0)!.replace(/\r\n /g, '')
    expect(ics).toContain('DESCRIPTION:Open end. Most can stay until 1:00 PM.')
  })
  it('has nothing to write before lock-in', () => {
    expect(icsFor(plan(), 'https://x/e')).toBeNull()
  })
})

describe('the feed', () => {
  it('is firm when going, tentative for maybe or no reply, and leaves out can’t go', () => {
    expect(['GO', 'MAYBE', 'WAIT', 'NO', 'STRANGER'].map((id) => feedStatus(locked, id))).toEqual(['CONFIRMED', 'TENTATIVE', 'TENTATIVE', null, null])
  })
  it('leaves out a plan with no locked time, as after a reopen', () => {
    expect(feedStatus({ ...locked, confirmed: undefined }, 'GO')).toBeNull()
  })
  it('carries each entry’s status', () => {
    const feed = icsFeed([{ ev: locked, link: 'https://x/e', status: 'TENTATIVE' }], 0)
    expect(feed).toContain(`X-WR-CALNAME:${APP_NAME}`)
    expect(feed).toContain('STATUS:TENTATIVE')
    expect(feed.match(/BEGIN:VEVENT/g)).toHaveLength(1)
  })
})
