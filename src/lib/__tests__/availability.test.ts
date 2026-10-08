import { describe, expect, it } from 'vitest'
import { intervalsToGrid, myTimesPatch, normalizeIv, stepOf, gridStartMinOf } from '@/lib/availability'

describe('normalizeIv', () => {
  it('sorts, merges touching and overlapping ranges, and drops empty ones', () => {
    expect(normalizeIv([{ s: 120, e: 180 }, { s: 0, e: 60 }, { s: 60, e: 90 }, { s: 30, e: 30 }, { s: 170, e: 200 }]))
      .toEqual([{ s: 0, e: 90 }, { s: 120, e: 200 }])
  })
  it('does not change the ranges it was given', () => {
    const input = [{ s: 0, e: 60 }, { s: 30, e: 90 }]
    normalizeIv(input)
    expect(input).toEqual([{ s: 0, e: 60 }, { s: 30, e: 90 }])
  })
})

describe('grid helpers', () => {
  it('reads the slot size and the first row', () => {
    expect([stepOf('15'), stepOf('30'), stepOf('60'), stepOf('day')]).toEqual([15, 30, 60, 1440])
    expect(gridStartMinOf({ times: ['9 AM', '10 AM'] })).toBe(540)
    expect(gridStartMinOf({ times: ['12:30 PM'] })).toBe(750)
    expect(gridStartMinOf({ times: ['All day'] })).toBe(0)
  })
  it('counts any overlap with a cell as being in it', () => {
    const grid = intervalsToGrid({ d1: { A: [{ s: 50, e: 70 }], B: [{ s: 0, e: 60 }] } }, [{ key: 'd1' }], 3, 60)
    expect(grid.d1).toEqual([['A', 'B'], ['A'], []])
  })
})

describe('myTimesPatch', () => {
  it('replaces only your own row and keeps everyone else, dormant days included', () => {
    const cur = { granularity: '60' as const, avail: {}, availIv: { d1: { A: [{ s: 0, e: 60 }], ME: [{ s: 0, e: 60 }] }, old: { A: [{ s: 0, e: 60 }] } } }
    const out = myTimesPatch(cur, 'ME', [{ key: 'd1' }], { d1: [{ s: 60, e: 120 }] }, 3, 60)
    expect(out.availIv!.d1).toEqual({ A: [{ s: 0, e: 60 }], ME: [{ s: 60, e: 120 }] })
    expect(out.availIv!.old).toEqual({ A: [{ s: 0, e: 60 }] })
  })
  it('removes your row from a day you cleared', () => {
    const cur = { granularity: '60' as const, avail: {}, availIv: { d1: { ME: [{ s: 0, e: 60 }] } } }
    expect(myTimesPatch(cur, 'ME', [{ key: 'd1' }], { d1: [] }, 3, 60).availIv!.d1).toEqual({})
  })
})
