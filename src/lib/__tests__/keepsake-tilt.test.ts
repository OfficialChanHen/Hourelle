import { describe, expect, it } from 'vitest'
import { lookOf, rowLeans, rowLooks, shelfLooks, tiltFor, withDetail } from '@/components/ui/Keepsake'

describe('a card turns the way its detail would let it', () => {
  it('held at the top right or down the right edge, the left side drops (counter-clockwise)', () => {
    for (const k of ['tape-corner', 'tape-right', 'clip'] as const) expect(tiltFor(k, 2, 1)).toBe(-2)
  })
  it('held on the left, the right side drops (clockwise)', () => {
    expect(tiltFor('tape-left', 2, -1)).toBe(2)
  })
  it('held at two points, it hangs straight', () => {
    for (const k of ['pin', 'mounts', 'tape-two'] as const) expect(tiltFor(k, 2, 1)).toBe(0)
  })
  it('loose, with no detail, it leans the way it was dealt', () => {
    expect(tiltFor('none', 2, 1)).toBe(2)
    expect(tiltFor('none', 2, -1)).toBe(-2)
  })
  it('a host’s pick turns the card with it', () => {
    const look = lookOf('plan-xyz', 0)
    expect(Math.sign(withDetail(look, 'tape-left').tilt)).toBe(1)
    expect(withDetail(look, 'pin').tilt).toBe(0)
  })
  it('shelves lie straight whatever the detail', () => {
    for (const l of shelfLooks(['a', 'b', 'c', 'd', 'e', 'f', 'g'])) expect(l.tilt).toBe(0)
    expect(withDetail(shelfLooks(['a'])[0], 'tape-left').tilt).toBe(0)
  })
})

describe('a row of tilted cards', () => {
  const ids = (n: number, salt: string) => Array.from({ length: n }, (_, i) => `${salt}-${i}`)
  const sign = (t: number) => Math.sign(t)
  it('never puts two neighbours leaning the same way', () => {
    for (let k = 0; k < 40; k++) for (const n of [2, 3, 4, 5]) {
      const tilts = rowLooks(ids(n, `r${k}`)).map((l) => sign(l.tilt))
      for (let i = 1; i < n; i++) if (tilts[i] && tilts[i - 1]) expect(tilts[i]).not.toBe(tilts[i - 1])
    }
  })
  it('only ever hangs a card straight in the middle of an odd row, mirrored around it', () => {
    let sawMiddle = false
    for (let k = 0; k < 60; k++) {
      const leans = rowLeans(ids(3, `m${k}`))
      const zeros = leans.flatMap((l, i) => (l === 0 ? [i] : []))
      if (zeros.length) {
        sawMiddle = true
        expect(zeros).toEqual([1])
        expect(leans[0]).toBe(-leans[2])
      } else {
        expect(leans[0]).toBe(leans[2])
        expect(leans[1]).toBe(-leans[0])
      }
    }
    expect(sawMiddle).toBe(true)
  })
  it('gives each card a detail that really hangs the way its place needs', () => {
    for (let k = 0; k < 20; k++) {
      const row = ids(3, `d${k}`)
      const leans = rowLeans(row)
      rowLooks(row).forEach((l, i) => expect(sign(l.tilt)).toBe(leans[i]))
    }
  })
  it('lets a host’s own pick win', () => {
    expect(rowLooks(['a', 'b', 'c'], [undefined, 'pin', undefined])[1].kind).toBe('pin')
  })
  it('keeps the same look for the same row', () => {
    expect(rowLooks(ids(3, 'same'))).toEqual(rowLooks(ids(3, 'same')))
  })
})
