import { beforeEach, describe, expect, it } from 'vitest'
import {
  confirmEvent, getEvent, needOnlyIds, rsvpPool, sameDayLabelFor, slotFits, slotFromRows, slotTouches,
  type ConfirmedSlot,
} from '@/lib/events'
import { day, person, plan, saved } from '../../../test/fixtures'

// a grid from midnight, so grid minutes and clock minutes are the same
const allHours = Array.from({ length: 24 }, (_, h) => `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`)
const days = [day('2026-11-20'), day('2026-11-21'), day('2026-11-22')]
const h = (n: number) => n * 60

const weekend: ConfirmedSlot = {
  dayKey: '2026-11-20', endDayKey: '2026-11-22', startMin: h(18), endMin: h(13), placeIds: [],
  sessions: [
    { dayKey: '2026-11-20', startMin: h(18), endMin: h(22) },
    { dayKey: '2026-11-21', startMin: h(11), endMin: h(16) },
    { dayKey: '2026-11-22', startMin: h(11), endMin: h(13) },
  ],
}

const ev = plan({
  days, times: allHours,
  participants: [person('H', { host: true, you: true, rsvp: 'attending' }), person('A'), person('B'), person('C'), person('D')],
  availIv: {
    '2026-11-20': { A: [{ s: h(17), e: h(23) }] },
    '2026-11-21': { A: [{ s: h(10), e: h(17) }], B: [{ s: h(11), e: h(16) }], C: [{ s: h(20), e: h(21) }], D: [{ s: h(20) + 30, e: h(24) - 1 }] },
    '2026-11-22': { A: [{ s: h(11), e: h(13) }] },
  },
})

describe('a run with its own hours each day', () => {
  it('fits someone free for every day’s hours', () => {
    expect(slotFits(ev, weekend, 'A')).toBe(true)
  })
  it('reads someone free on one day only as part of it', () => {
    expect(slotFits(ev, weekend, 'B')).toBe(false)
    expect(slotTouches(ev, weekend, 'B')).toBe(true)
  })
  it('starts lock-in with going for the whole run and no reply for part of it', () => {
    saved(ev)
    confirmEvent('plan-1', weekend)
    const after = getEvent('plan-1')!
    expect(after.participants.find((p) => p.id === 'A')?.rsvp).toBe('attending')
    expect(after.participants.find((p) => p.id === 'B')?.rsvp).toBe('pending')
    const pool = rsvpPool(after).people.map((p) => p.id)
    expect(pool).toContain('A')
    expect(pool).not.toContain('B')
  })
  it('clashes only on the days it keeps', () => {
    const skipping = plan({ id: 'trip', confirmed: { ...weekend, sessions: [weekend.sessions![0], weekend.sessions![2]] }, status: 'confirmed' })
    const saturday = plan({ id: 'party', confirmed: { dayKey: '2026-11-21', startMin: h(19), endMin: h(22), placeIds: [] }, status: 'confirmed' })
    const sunday = plan({ id: 'brunch', confirmed: { dayKey: '2026-11-22', startMin: h(10), endMin: h(12), placeIds: [] }, status: 'confirmed' })
    const label = sameDayLabelFor([skipping, saturday, sunday])
    expect(label(saturday)).toBeUndefined()
    expect(label(sunday)?.label).toBe(skipping.title)
  })
})

describe('an open end', () => {
  const open: ConfirmedSlot = { dayKey: '2026-11-21', startMin: h(20), endMin: h(23) + 30, placeIds: [], openEnd: true }
  it('fits anyone free for the first hour', () => {
    expect(slotFits(ev, open, 'C')).toBe(true)
  })
  it('reads someone who arrives late as part of it', () => {
    expect(slotFits(ev, open, 'D')).toBe(false)
    expect(slotTouches(ev, open, 'D')).toBe(true)
  })
  it('notes who leans on if need be within the first hour', () => {
    const rest = Object.fromEntries(Object.entries(ev.availIv!['2026-11-21']).filter(([id]) => id !== 'C'))
    const withNeed = { ...ev, availIv: { ...ev.availIv, '2026-11-21': rest }, needIv: { '2026-11-21': { C: [{ s: h(20), e: h(21) }] } } }
    expect(needOnlyIds(withNeed, open).has('C')).toBe(true)
  })
})

describe('older slots read as before', () => {
  it('a whole-day run asks only for a mark on each day', () => {
    const run: ConfirmedSlot = { dayKey: '2026-11-20', endDayKey: '2026-11-22', startMin: 0, endMin: h(24), placeIds: [] }
    expect(slotFits(ev, run, 'A')).toBe(true)
    expect(slotFits(ev, run, 'B')).toBe(false)
    expect(slotTouches(ev, run, 'B')).toBe(true)
  })
  it('a single timed day needs the whole window', () => {
    const one: ConfirmedSlot = { dayKey: '2026-11-21', startMin: h(11), endMin: h(16), placeIds: [] }
    expect(slotFits(ev, one, 'B')).toBe(true)
    expect(slotFits(ev, one, 'C')).toBe(false)
  })
})

describe('slotFromRows', () => {
  const rows = weekend.sessions!.map((s) => ({ ...s, skip: false }))
  it('has nothing to lock with every day skipped', () => {
    expect(slotFromRows(rows.map((r) => ({ ...r, skip: true })), [], false)).toBeNull()
  })
  it('locks one kept day as a plain slot', () => {
    expect(slotFromRows(rows.map((r, i) => ({ ...r, skip: i !== 1 })), ['p'], false)).toEqual({ dayKey: '2026-11-21', startMin: h(11), endMin: h(16), placeIds: ['p'] })
  })
  it('locks several days with their own hours and the span outside', () => {
    expect(slotFromRows(rows, [], false)).toEqual(weekend)
  })
  it('carries an open end', () => {
    expect(slotFromRows(rows, [], true)?.openEnd).toBe(true)
  })
})

beforeEach(() => localStorage.clear())
