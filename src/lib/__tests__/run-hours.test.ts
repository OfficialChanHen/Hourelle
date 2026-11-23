import { describe, expect, it } from 'vitest'
import { runHours, type AvailIntervals } from '@/lib/events'
import { day } from '../../../test/fixtures'

const days = [day('2026-11-20'), day('2026-11-21'), day('2026-11-22')]
const h = (n: number) => n * 60
const free = (ids: string[], s: number, e: number) => Object.fromEntries(ids.map((id) => [id, [{ s, e }]]))

describe('the hours each day of a run', () => {
  it('frames each day at its best window of the plan’s length', () => {
    const iv: AvailIntervals = {
      '2026-11-20': free(['A', 'B'], h(18), h(23)),
      '2026-11-21': free(['A', 'B'], h(10), h(16)),
      '2026-11-22': free(['A', 'B'], h(9), h(12)),
    }
    expect(runHours(iv, days, 60).map(({ dayKey, s, e }) => [dayKey, s, e])).toEqual([
      ['2026-11-20', h(18), h(19)],
      ['2026-11-21', h(10), h(11)],
      ['2026-11-22', h(9), h(10)],
    ])
  })
  it('follows the length as it changes', () => {
    const iv: AvailIntervals = { '2026-11-20': free(['A', 'B'], h(18), h(23)) }
    expect(runHours(iv, days.slice(0, 1), h(3)).map(({ s, e }) => [s, e])).toEqual([[h(18), h(21)]])
    expect(runHours(iv, days.slice(0, 1), h(5)).map(({ s, e }) => [s, e])).toEqual([[h(18), h(23)]])
  })
  it('puts each day’s window where the most people overlap', () => {
    const iv: AvailIntervals = {
      '2026-11-20': { A: [{ s: h(10), e: h(18) }], B: [{ s: h(12), e: h(20) }], C: [{ s: h(19), e: h(21) }] },
    }
    const [fri] = runHours(iv, days.slice(0, 1), 60)
    expect([fri.s, fri.e, fri.count]).toEqual([h(12), h(13), 2])
  })
  it('takes the people free for the whole length over a bigger crowd for less', () => {
    const iv: AvailIntervals = {
      '2026-11-20': { A: [{ s: h(10), e: h(11) }], B: [{ s: h(10), e: h(11) }], C: [{ s: h(10), e: h(14) }], D: [{ s: h(10), e: h(14) }] },
    }
    const [fri] = runHours(iv, days.slice(0, 1), h(3))
    expect([fri.s, fri.e, fri.count]).toEqual([h(10), h(13), 2])
  })
  it('leaves out a day nobody marked, or with no window of the length', () => {
    const iv: AvailIntervals = { '2026-11-20': free(['A'], h(9), h(10)), '2026-11-21': free(['A'], h(9), h(12)) }
    expect(runHours(iv, days, 60).map((r) => r.dayKey)).toEqual(['2026-11-20', '2026-11-21'])
    expect(runHours(iv, days, h(2)).map((r) => r.dayKey)).toEqual(['2026-11-21'])
  })
})
