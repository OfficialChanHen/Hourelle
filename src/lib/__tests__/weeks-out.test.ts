import { describe, expect, it } from 'vitest'
import { answeredIds, confirmEvent, getEvent, mergeParticipantsPatch, outOnDay, removeParticipantPatch, weekKeyOf, youReplied } from '@/lib/events'
import { person, plan, saved } from '../../../test/fixtures'

// two calendar weeks: Sun Oct 18 to Sat Oct 24, Sun Oct 25 to Sat Oct 31
const W1 = '2026-10-18', W2 = '2026-10-25'
const days = ['2026-10-20', '2026-10-21', '2026-10-27', '2026-10-28'].map((key) => ({ key, dow: 'Tue', date: key }))

function twoWeeks() {
  return plan({
    days,
    participants: [person('H', { host: true, you: true, rsvp: 'attending' }), person('OUT1'), person('STALE'), person('QUIET')],
    availIv: { '2026-10-27': { OUT1: [{ s: 0, e: 120 }] } },
    // STALE said so about a week the plan no longer covers
    unavailableWeeks: { OUT1: [W1], STALE: ['2026-09-06'] },
  })
}

describe('a week you cannot make', () => {
  it('names a week by its Sunday', () => {
    expect(weekKeyOf('2026-10-18')).toBe(W1)
    expect(weekKeyOf('2026-10-24')).toBe(W1)
    expect(weekKeyOf('2026-10-27')).toBe(W2)
  })
  it('covers every day of that week and none of the next', () => {
    const ev = twoWeeks()
    expect(outOnDay(ev, 'OUT1', '2026-10-20')).toBe(true)
    expect(outOnDay(ev, 'OUT1', '2026-10-27')).toBe(false)
    expect(outOnDay(ev, 'QUIET', '2026-10-20')).toBe(false)
  })
  it('is an answer, but only for a week the plan still covers', () => {
    const ev = twoWeeks()
    ev.availIv = {}
    expect([...answeredIds(ev)].sort()).toEqual(['OUT1'])
  })
  it('counts as your reply', () => {
    const ev = twoWeeks()
    ev.availIv = {}
    ev.participants = ev.participants.map((p) => ({ ...p, you: p.id === 'OUT1' }))
    expect(youReplied(ev)).toBe(true)
  })
  it('starts as can’t go when the locked day falls in it', () => {
    saved(twoWeeks())
    confirmEvent('plan-1', { dayKey: '2026-10-21', startMin: 540, endMin: 600, placeIds: [] })
    expect(getEvent('plan-1')!.participants.find((p) => p.id === 'OUT1')).toMatchObject({ rsvp: 'not_going', rsvpAuto: true })
  })
  it('goes with the person when they are removed or merged', () => {
    const ev = twoWeeks()
    expect(removeParticipantPatch(ev, 'OUT1').unavailableWeeks).toEqual({ STALE: ['2026-09-06'] })
    expect(mergeParticipantsPatch(ev, 'OUT1', 'QUIET').unavailableWeeks).toEqual({ STALE: ['2026-09-06'], QUIET: [W1] })
  })
})
