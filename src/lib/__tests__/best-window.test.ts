import { describe, expect, it } from 'vitest'
import { bestWindow, type GridDay } from '@/lib/events'

const days: GridDay[] = [
  { key: '2029-08-20', dow: 'Mon', date: 'Aug 20' },
  { key: '2029-08-23', dow: 'Thu', date: 'Aug 23' },
]

describe('the best time, when windows tie', () => {
  it('takes the first day that fits, not the earliest hour on any day', () => {
    // the same two people free for two hours on each day: Monday from 2 PM (grid
    // minute 300 from 9 AM), Thursday from 9 AM
    const iv = {
      '2029-08-20': { A: [{ s: 300, e: 420 }], B: [{ s: 300, e: 420 }] },
      '2029-08-23': { A: [{ s: 0, e: 120 }], B: [{ s: 0, e: 120 }] },
    }
    const bw = bestWindow(iv, days, 120)
    expect(bw?.dayKey).toBe('2029-08-20')
    expect(bw?.s).toBe(300)
  })
  it('still takes the earliest start within that day', () => {
    const iv = { '2029-08-20': { A: [{ s: 0, e: 60 }, { s: 300, e: 360 }], B: [{ s: 0, e: 60 }, { s: 300, e: 360 }] } }
    expect(bestWindow(iv, days, 60)?.s).toBe(0)
  })
  it('a day with more people still wins over an earlier one', () => {
    const iv = {
      '2029-08-20': { A: [{ s: 0, e: 120 }] },
      '2029-08-23': { A: [{ s: 0, e: 120 }], B: [{ s: 0, e: 120 }] },
    }
    expect(bestWindow(iv, days, 120)?.dayKey).toBe('2029-08-23')
  })
})
