import { describe, expect, it } from 'vitest'
import { answeredCount, answeredIds, confirmEvent, getEvent, reopenEvent, rsvpPool } from '@/lib/events'
import { answeredLine, goingLine } from '@/lib/answers'
import { person, plan, saved } from '../../../test/fixtures'

const PEOPLE = [person('H', { host: true, you: true, rsvp: 'attending' }), person('FIT'), person('PART'), person('MISS'), person('OTHER'), person('NONE'), person('NODAYS')]
const D1 = '2026-10-20'

function deciding() {
  return plan({
    participants: PEOPLE, unavailableIds: ['NODAYS', 'GONE2'],
    availIv: {
      [D1]: { H: [{ s: 0, e: 360 }], FIT: [{ s: 60, e: 180 }], PART: [{ s: 120, e: 300 }], MISS: [{ s: 240, e: 360 }], GONE: [{ s: 0, e: 360 }] },
      '2026-10-21': { OTHER: [{ s: 0, e: 360 }] },
      '2026-09-01': { NONE: [{ s: 0, e: 60 }] }, // a day the plan no longer covers
    },
  })
}

describe('answered (while deciding)', () => {
  it('counts people on the plan who marked a current day or said none work', () => {
    const ev = deciding()
    expect([...answeredIds(ev)].sort()).toEqual(['FIT', 'H', 'MISS', 'NODAYS', 'OTHER', 'PART'])
    expect(answeredCount(ev)).toBe(6)
  })
  it('reads one way everywhere', () => {
    expect(answeredLine(6, 7)).toBe('6 of 7 have answered')
    expect(answeredLine(1, 1)).toBe('1 of 1 has answered')
  })
})

describe('lock-in', () => {
  // locked Tue 10 AM to 12 PM on a 9 AM grid: grid minutes 60 to 180
  const slot = { dayKey: D1, startMin: 600, endMin: 720, placeIds: [] }
  it('starts covered as going, missed as can’t go, partial and silent at no reply', () => {
    saved(deciding())
    confirmEvent('plan-1', slot)
    const r = Object.fromEntries(getEvent('plan-1')!.participants.map((p) => [p.id, `${p.rsvp}${p.rsvpAuto ? '*' : ''}`]))
    expect(r).toEqual({ H: 'attending', FIT: 'attending*', PART: 'pending', MISS: 'not_going*', OTHER: 'not_going*', NONE: 'pending', NODAYS: 'not_going*' })
  })
  it('counts going out of who can make the time', () => {
    saved(deciding())
    confirmEvent('plan-1', slot)
    const ev = getEvent('plan-1')!
    expect(goingLine(rsvpPool(ev), true)).toBe('2 of 2 who can make it are going')
    const later = { ...ev, participants: ev.participants.map((p) => (p.id === 'NONE' ? { ...p, rsvp: 'attending' as const } : p.id === 'FIT' ? { ...p, rsvp: 'maybe' as const } : p)) }
    expect(goingLine(rsvpPool(later), true)).toBe('2 of 3 who can make it are going: 1 maybe')
  })
  it('counts out of everyone when the date was set at creation', () => {
    const fixed = plan({ participants: PEOPLE, confirmed: slot, status: 'confirmed' })
    expect(rsvpPool(fixed).byTimes).toBe(false)
    expect(goingLine(rsvpPool(fixed), true)).toBe('1 of 7 are going: 6 haven’t replied')
  })
  it('reopening clears every reply but the host’s', () => {
    saved(deciding())
    confirmEvent('plan-1', slot)
    reopenEvent('plan-1')
    const ev = getEvent('plan-1')!
    expect(ev.confirmed).toBeUndefined()
    expect(ev.participants.filter((p) => p.rsvp !== 'pending').map((p) => p.id)).toEqual(['H'])
  })
})
