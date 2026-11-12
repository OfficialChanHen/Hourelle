import { describe, expect, it } from 'vitest'
import { previewOf, previewVersion } from '@/lib/link-preview'
import { person, plan } from '../../../test/fixtures'

const D1 = '2026-10-20'
// far enough ahead that the plan is never "past" while these tests are run
const FUTURE = ['2099-10-20', '2099-10-21']

function deciding() {
  return plan({
    hostName: 'Sam Rivera',
    startDate: FUTURE[0], endDate: FUTURE[1],
    days: FUTURE.map((key) => ({ key, dow: 'Tue', date: 'Oct 20' })),
    participants: [person('H', { host: true, rsvp: 'attending' }), person('A', { inviteToken: 'tok-a' }), person('B'), person('C')],
    availIv: { [FUTURE[0]]: { H: [{ s: 0, e: 120 }], A: [{ s: 60, e: 180 }] } },
  })
}

describe('link preview', () => {
  it('shows the name, the host and how many have answered while deciding', () => {
    const p = previewOf(deciding())!
    expect(p.title).toBe('Board game night')
    expect(p.host).toBe('Sam Rivera')
    expect(p.status).toBe('2 of 4 have answered')
    expect(p.locked).toBe(false)
    expect(p.tz).toBeNull() // a date range has no time, so no zone to name
    expect(p.description).toContain('2 of 4 have answered')
    expect(p.description).toContain('Hosted by Sam Rivera')
  })

  it('shows the locked time with its zone, and who is going', () => {
    const ev = { ...deciding(), status: 'confirmed' as const, confirmed: { dayKey: FUTURE[0], startMin: 19 * 60, endMin: 21 * 60, placeIds: [] } }
    const p = previewOf(ev)!
    expect(p.locked).toBe(true)
    expect(p.when).toMatch(/7:00 PM/)
    expect(p.tz).toBe('CDT')
    expect(p.status).toMatch(/going/)
    expect(p.description.startsWith(p.when)).toBe(true)
  })

  it('says a past plan already happened', () => {
    const ev = plan({ status: 'confirmed', confirmed: { dayKey: D1, startMin: 600, endMin: 720, placeIds: [] }, startDate: D1, endDate: D1 })
    expect(previewOf(ev)!.status).toBe('This plan already happened')
  })

  it('opens a personal link only while that person is still on the plan', () => {
    const ev = deciding()
    expect(previewOf(ev, 'tok-a')).not.toBeNull()
    // removed: their entry is gone, and so is anything about the plan
    const removed = { ...ev, participants: ev.participants.filter((p) => p.id !== 'A'), removedIds: ['A'] }
    expect(previewOf(removed, 'tok-a')).toBeNull()
    expect(previewOf(ev, 'made-up')).toBeNull()
    // the plain link is the plan's own invitation and still shows it
    expect(previewOf(removed)).not.toBeNull()
  })

  it('shows nothing for a missing plan or a demo', () => {
    expect(previewOf(null)).toBeNull()
    expect(previewOf({ ...deciding(), demo: true })).toBeNull()
  })

  it('names the cover kind without reading anything else', () => {
    expect(previewOf({ ...deciding(), image: 'preset:meadow' })!.cover).toEqual({ kind: 'preset', id: 'meadow' })
    expect(previewOf({ ...deciding(), image: 'https://x.supabase.co/storage/v1/object/public/covers/a/b.jpg' })!.cover.kind).toBe('photo')
    expect(previewOf(deciding())!.cover.kind).toBe('plain')
  })

  it('changes its version when what it shows changes', () => {
    const a = previewOf(deciding())!
    const more = deciding()
    more.availIv![FUTURE[1]] = { B: [{ s: 0, e: 60 }] }
    expect(previewVersion(a)).toBe(previewVersion(previewOf(deciding())!))
    expect(previewVersion(a)).not.toBe(previewVersion(previewOf(more)!))
  })
  it('says a run with its own hours as its span of days', () => {
    const p = previewOf({
      ...deciding(), status: 'confirmed',
      confirmed: {
        dayKey: FUTURE[0], endDayKey: FUTURE[1], startMin: 18 * 60, endMin: 13 * 60, placeIds: [],
        sessions: [{ dayKey: FUTURE[0], startMin: 18 * 60, endMin: 22 * 60 }, { dayKey: FUTURE[1], startMin: 11 * 60, endMin: 13 * 60 }],
      },
    })!
    expect(p.when).toMatch(/, 2 days$/)
  })
})
