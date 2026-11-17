import { describe, expect, it } from 'vitest'
import { runHours, type AvailIntervals } from '@/lib/events'
import { day } from '../../../test/fixtures'

const days = [day('2026-11-20'), day('2026-11-21'), day('2026-11-22')]
const h = (n: number) => n * 60
const free = (ids: string[], s: number, e: number) => Object.fromEntries(ids.map((id) => [id, [{ s, e }]]))

describe('the hours each day of a run', () => {
  it('takes the whole stretch the group shares each day, not one length-sized window', () => {
    const iv: AvailIntervals = {
      '2026-11-20': free(['A', 'B'], h(18), h(23)),
      '2026-11-21': free(['A', 'B'], h(10), h(16)),
      '2026-11-22': free(['A', 'B'], h(9), h(12)),
    }
    expect(runHours(iv, days, 60).map(({ dayKey, s, e }) => [dayKey, s, e])).toEqual([
      ['2026-11-20', h(18), h(23)],
      ['2026-11-21', h(10), h(16)],
      ['2026-11-22', h(9), h(12)],
    ])
  })
  it('cuts each day to where the most people overlap', () => {
    const iv: AvailIntervals = {
      '2026-11-20': { A: [{ s: h(10), e: h(18) }], B: [{ s: h(12), e: h(20) }], C: [{ s: h(19), e: h(21) }] },
    }
    const [fri] = runHours(iv, days.slice(0, 1), 60)
    expect([fri.s, fri.e, fri.count]).toEqual([h(12), h(18), 2])
  })
  it('keeps the stretch at least the plan length when it can', () => {
    const iv: AvailIntervals = {
      '2026-11-20': { A: [{ s: h(10), e: h(11) }], B: [{ s: h(10), e: h(11) }], C: [{ s: h(10), e: h(14) }], D: [{ s: h(10), e: h(14) }] },
    }
    const [fri] = runHours(iv, days.slice(0, 1), h(3))
    expect([fri.s, fri.e, fri.count]).toEqual([h(10), h(14), 2])
  })
  it('leaves out a day nobody marked', () => {
    const iv: AvailIntervals = { '2026-11-20': free(['A'], h(9), h(10)) }
    expect(runHours(iv, days, 60).map((r) => r.dayKey)).toEqual(['2026-11-20'])
  })
})
