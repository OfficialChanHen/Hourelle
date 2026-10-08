import { describe, expect, it } from 'vitest'
import { lookOf, shelfLooks, tiltFor, withDetail } from '@/components/ui/Keepsake'

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
