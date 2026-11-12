import { describe, expect, it } from 'vitest'
import { bestOpenStart, openBest, stayLine, type AvailIntervals } from '@/lib/events'
import { day, person, plan } from '../../../test/fixtures'

const days = [day('2026-11-20'), day('2026-11-21')]
const h = (n: number) => n * 60
const free = (ids: string[], s: number, e: number) => Object.fromEntries(ids.map((id) => [id, [{ s, e }]]))

describe('the best open start', () => {
  it('takes the bigger crowd over a smaller one that stays longer', () => {
    const iv: AvailIntervals = {
      '2026-11-20': free(['A', 'B', 'C', 'D', 'E', 'F', 'G'], h(12), h(14)),
      '2026-11-21': free(['A', 'B', 'C', 'D'], h(10), h(18)),
    }
    const best = bestOpenStart(iv, days)!
    expect(best.dayKey).toBe('2026-11-20')
    expect(best.count).toBe(7)
  })
  it('takes the start the group holds longest when the crowds are equal', () => {
    const iv: AvailIntervals = {
      '2026-11-20': free(['A', 'B'], h(12), h(14)),
      '2026-11-21': free(['A', 'B'], h(12), h(17)),
    }
    const best = bestOpenStart(iv, days)!
    expect(best.dayKey).toBe('2026-11-21')
    expect(best.e - best.s).toBe(h(5))
  })
  it('needs everyone it counts for at least an hour', () => {
    const iv: AvailIntervals = {
      '2026-11-20': { ...free(['A', 'B', 'C'], h(12), h(12) + 30), ...free(['D'], h(14), h(16)) },
    }
    const best = bestOpenStart(iv, days)!
    expect(best.count).toBe(1)
    expect(best.ids).toEqual(['D'])
  })
  it('holds until the group drops below half its size', () => {
    const iv: AvailIntervals = {
      '2026-11-20': { A: [{ s: h(10), e: h(11) }], B: [{ s: h(10), e: h(12) }], C: [{ s: h(10), e: h(13) }] },
    }
    const best = bestOpenStart(iv, days)!
    expect(best.s).toBe(h(10))
    expect(best.e).toBe(h(12))
    expect(best.stay).toEqual({ A: h(11), B: h(12), C: h(13) })
  })
  it('on a tie takes fewer people there only if need be', () => {
    const iv: AvailIntervals = {
      '2026-11-20': free(['A', 'B'], h(10), h(12)),
      '2026-11-21': free(['A', 'B'], h(10), h(12)),
    }
    const need: AvailIntervals = { '2026-11-20': free(['A'], h(10), h(12)) }
    expect(bestOpenStart(iv, days, need)!.dayKey).toBe('2026-11-21')
  })
  it('finds nothing when nobody is free for an hour', () => {
    expect(bestOpenStart({ '2026-11-20': free(['A'], h(10), h(10) + 45) }, days)).toBeNull()
  })
})

describe('openBest', () => {
  const ev = plan({ days, availIv: { '2026-11-20': free(['A', 'B'], 0, h(2)) } })
  it('searches for a fixed window unless the length is unknown', () => {
    expect(openBest(ev)?.e).toBe(h(1))
    expect(openBest({ ...ev, openLength: true })?.e).toBe(h(2))
  })
})

describe('stayLine', () => {
  // grid 9 AM to 3 PM (the fixture's), so grid minute 0 is 9 AM and its end 3 PM
  const ev = plan({
    days,
    participants: [person('H', { host: true, you: true, rsvp: 'attending' }), person('A'), person('B'), person('C', { name: 'Sam Lee' })],
    availIv: { '2026-11-20': { A: [{ s: 0, e: h(2) }], B: [{ s: 0, e: h(3) }], C: [{ s: 0, e: h(6) }] } },
  })
  const session = { dayKey: '2026-11-20', startMin: h(9), endMin: h(12) }
  it('says how late most can stay and who stays latest', () => {
    expect(stayLine(ev, session)).toEqual({ most: h(12), mostIsEnd: false, last: { name: 'Sam', until: h(15), isEnd: true } })
  })
  it('says nothing when nobody marked the start', () => {
    expect(stayLine(ev, { ...session, startMin: h(14) + 30 })).toBeNull()
  })
})
