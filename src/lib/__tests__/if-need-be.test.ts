import { describe, expect, it } from 'vitest'
import { applyBrush, availIvOf, freeIvOf, myTimesPatch, unionIv } from '@/lib/availability'
import { answeredIds, bestBlock, bestWindow, confirmEvent, getEvent, rsvpPool, type GridDay } from '@/lib/events'
import { needClause } from '@/lib/answers'
import { person, plan, saved } from '../../../test/fixtures'

const days: GridDay[] = [
  { key: 'd1', dow: 'Mon', date: 'Aug 20' },
  { key: 'd2', dow: 'Tue', date: 'Aug 21' },
]
const ev = (availIv: Record<string, Record<string, { s: number; e: number }[]>>, needIv?: typeof availIv) =>
  ({ avail: {}, availIv, needIv, days, granularity: '30' as const })

describe('painting with a brush', () => {
  it('free over if need be replaces it, and the rest of the if-need-be mark stays', () => {
    const out = applyBrush([], [{ s: 0, e: 120 }], { s: 30, e: 60 }, 'free')
    expect(out.free).toEqual([{ s: 30, e: 60 }])
    expect(out.need).toEqual([{ s: 0, e: 30 }, { s: 60, e: 120 }])
  })
  it('if need be over free replaces it', () => {
    const out = applyBrush([{ s: 0, e: 120 }], [], { s: 60, e: 180 }, 'need')
    expect(out.free).toEqual([{ s: 0, e: 60 }])
    expect(out.need).toEqual([{ s: 60, e: 180 }])
  })
  it('erasing takes out both kinds', () => {
    const out = applyBrush([{ s: 0, e: 60 }], [{ s: 60, e: 120 }], { s: 30, e: 90 }, 'erase')
    expect(out.free).toEqual([{ s: 0, e: 30 }])
    expect(out.need).toEqual([{ s: 90, e: 120 }])
  })
  it('a minute is never both', () => {
    const a = applyBrush([{ s: 0, e: 60 }], [], { s: 0, e: 60 }, 'need')
    const b = applyBrush(a.free, a.need, { s: 15, e: 45 }, 'free')
    for (const f of b.free) for (const n of b.need) expect(f.e <= n.s || n.e <= f.s).toBe(true)
  })
})

describe('who can make it', () => {
  it('availIvOf counts free and if need be together, freeIvOf only free', () => {
    const e = ev({ d1: { A: [{ s: 0, e: 60 }] } }, { d1: { A: [{ s: 60, e: 90 }], B: [{ s: 0, e: 30 }] } })
    expect(availIvOf(e).d1).toEqual({ A: [{ s: 0, e: 90 }], B: [{ s: 0, e: 30 }] })
    expect(freeIvOf(e).d1).toEqual({ A: [{ s: 0, e: 60 }] })
  })
  it('a plan without if-need-be marks reads exactly as before', () => {
    const e = ev({ d1: { A: [{ s: 0, e: 60 }] } })
    expect(availIvOf(e)).toEqual(freeIvOf(e))
  })
  it('unionIv merges per person per day', () => {
    expect(unionIv({ d1: { A: [{ s: 0, e: 30 }] } }, { d1: { A: [{ s: 30, e: 60 }] }, d2: { B: [{ s: 0, e: 30 }] } }))
      .toEqual({ d1: { A: [{ s: 0, e: 60 }] }, d2: { B: [{ s: 0, e: 30 }] } })
  })
})

describe('saving your times with if-need-be marks', () => {
  it('writes your if-need-be row beside your free row and leaves others alone', () => {
    const cur = { granularity: '60' as const, avail: {}, availIv: { d1: { A: [{ s: 0, e: 60 }] } }, needIv: { d1: { A: [{ s: 60, e: 120 }] } } }
    const out = myTimesPatch(cur, 'ME', [{ key: 'd1' }], { d1: [{ s: 0, e: 60 }] }, 3, 60, { d1: [{ s: 120, e: 180 }] })
    expect(out.availIv!.d1).toEqual({ A: [{ s: 0, e: 60 }], ME: [{ s: 0, e: 60 }] })
    expect(out.needIv!.d1).toEqual({ A: [{ s: 60, e: 120 }], ME: [{ s: 120, e: 180 }] })
    // the per-cell view counts both kinds
    expect(out.avail!.d1).toEqual([['A', 'ME'], ['A'], ['ME']])
  })
  it('without a need map, your if-need-be marks are left as they were', () => {
    const cur = { granularity: '60' as const, avail: {}, availIv: {}, needIv: { d1: { ME: [{ s: 60, e: 120 }] } } }
    const out = myTimesPatch(cur, 'ME', [{ key: 'd1' }], { d1: [{ s: 0, e: 60 }] }, 3, 60)
    expect(out.needIv).toBeUndefined()
  })
})

describe('the best time with if-need-be marks', () => {
  it('more people who can make it beats fewer who are fully free', () => {
    // d1: A and B free. d2: A, B free and C if need be
    const free = { d1: { A: [{ s: 0, e: 60 }], B: [{ s: 0, e: 60 }] }, d2: { A: [{ s: 0, e: 60 }], B: [{ s: 0, e: 60 }] } }
    const need = { d2: { C: [{ s: 0, e: 60 }] } }
    const bw = bestWindow(unionIv(free, need), days, 60, 'full', need)
    expect(bw?.dayKey).toBe('d2')
    expect(bw?.count).toBe(3)
    expect(bw?.needIds).toEqual(['C'])
  })
  it('on a tie, fewer people on if need be wins, even on a later day', () => {
    const free = { d1: { A: [{ s: 0, e: 60 }] }, d2: { A: [{ s: 0, e: 60 }], B: [{ s: 0, e: 60 }] } }
    const need = { d1: { B: [{ s: 0, e: 60 }] } }
    const bw = bestWindow(unionIv(free, need), days, 60, 'full', need)
    expect(bw?.dayKey).toBe('d2')
    expect(bw?.needIds).toEqual([])
  })
  it('someone free for part and if need be for the rest counts, as if need be', () => {
    const free = { d1: { A: [{ s: 0, e: 30 }] } }
    const need = { d1: { A: [{ s: 30, e: 60 }] } }
    const bw = bestWindow(unionIv(free, need), days, 60, 'full', need)
    expect(bw?.ids).toEqual(['A'])
    expect(bw?.needIds).toEqual(['A'])
  })
  it('crowd mode weighs if-need-be minutes at half', () => {
    // d1: A free for the hour, B if need be for 30 minutes (60 + 15 = 75).
    // d2: A free for the hour, B if need be for 40 minutes (60 + 20 = 80).
    const free = { d1: { A: [{ s: 0, e: 60 }] }, d2: { A: [{ s: 0, e: 60 }] } }
    const need = { d1: { B: [{ s: 0, e: 30 }] }, d2: { B: [{ s: 0, e: 40 }] } }
    expect(bestWindow(unionIv(free, need), days, 60, 'crowd', need)?.dayKey).toBe('d2')
  })
  it('with no if-need-be marks, the answer is unchanged and needIds is empty', () => {
    const free = { d1: { A: [{ s: 0, e: 60 }], B: [{ s: 0, e: 60 }] } }
    const bw = bestWindow(free, days, 60)
    expect(bw?.dayKey).toBe('d1')
    expect(bw?.needIds).toEqual([])
  })
})

describe('the best run of days with if-need-be marks', () => {
  const dayPoll: GridDay[] = [
    { key: '2029-08-20', dow: 'Mon', date: 'Aug 20' },
    { key: '2029-08-21', dow: 'Tue', date: 'Aug 21' },
  ]
  it('ties go to the day with fewer people on if need be', () => {
    const free = { '2029-08-20': { A: [{ s: 0, e: 1440 }] }, '2029-08-21': { A: [{ s: 0, e: 1440 }], B: [{ s: 0, e: 1440 }] } }
    const need = { '2029-08-20': { B: [{ s: 0, e: 1440 }] } }
    const bb = bestBlock(unionIv(free, need), dayPoll, 1, 'full', need)
    expect(bb?.startKey).toBe('2029-08-21')
    expect(bb?.needIds).toEqual([])
  })
  it('a day marked only if need be still counts for that person', () => {
    const free = { '2029-08-20': { A: [{ s: 0, e: 1440 }] } }
    const need = { '2029-08-20': { B: [{ s: 0, e: 1440 }] } }
    const bb = bestBlock(unionIv(free, need), dayPoll, 1, 'full', need)
    expect(bb?.count).toBe(2)
    expect(bb?.needIds).toEqual(['B'])
  })
})

describe('counts and lock-in with if-need-be marks', () => {
  const D1 = '2026-10-20'
  // locked Tue 10 AM to 12 PM on a 9 AM grid: grid minutes 60 to 180
  const slot = { dayKey: D1, startMin: 600, endMin: 720, placeIds: [] }
  const people = [person('H', { host: true, you: true, rsvp: 'attending' }), person('FREE'), person('NEED'), person('MIX'), person('NEEDMISS'), person('NEEDPART')]
  const deciding = () => plan({
    participants: people,
    availIv: { [D1]: { H: [{ s: 0, e: 360 }], FREE: [{ s: 60, e: 180 }], MIX: [{ s: 60, e: 120 }] } },
    needIv: { [D1]: { NEED: [{ s: 0, e: 240 }], MIX: [{ s: 120, e: 180 }], NEEDMISS: [{ s: 300, e: 360 }], NEEDPART: [{ s: 120, e: 240 }] } },
  })
  it('an if-need-be mark counts as an answer', () => {
    expect([...answeredIds(deciding())].sort()).toEqual(['FREE', 'H', 'MIX', 'NEED', 'NEEDMISS', 'NEEDPART'])
  })
  it('covered free starts going, covered with if need be starts maybe, missed starts can’t go', () => {
    saved(deciding())
    confirmEvent('plan-1', slot)
    const r = Object.fromEntries(getEvent('plan-1')!.participants.map((p) => [p.id, `${p.rsvp}${p.rsvpAuto ? '*' : ''}`]))
    expect(r).toEqual({ H: 'attending', FREE: 'attending*', NEED: 'maybe*', MIX: 'maybe*', NEEDMISS: 'not_going*', NEEDPART: 'pending' })
  })
  it('who can make it includes people covered with if need be', () => {
    saved(deciding())
    confirmEvent('plan-1', slot)
    expect(rsvpPool(getEvent('plan-1')!).people.map((p) => p.id).sort()).toEqual(['FREE', 'H', 'MIX', 'NEED'])
  })
  it('the best-time clause names how many lean on if need be, only when someone does', () => {
    expect(needClause(0)).toBe('')
    expect(needClause(1)).toBe(', 1 of them if need be')
    expect(needClause(2)).toBe(', 2 of them if need be')
  })
})
