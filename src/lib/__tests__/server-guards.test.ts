import { describe, expect, it } from 'vitest'
import { tooMany } from '@/lib/server/rate'
import { bearerMatches } from '@/lib/server/db'

const from = (ip: string, auth?: string) =>
  new Request('https://example.test/api', { headers: { 'x-forwarded-for': `${ip}, 10.0.0.1`, ...(auth ? { authorization: auth } : {}) } })

describe('tooMany', () => {
  it('lets the first calls through and stops the one past the limit', () => {
    const t = 1_000_000
    expect(tooMany('t1', from('1.1.1.1'), 2, 60_000, t)).toBe(false)
    expect(tooMany('t1', from('1.1.1.1'), 2, 60_000, t + 1)).toBe(false)
    expect(tooMany('t1', from('1.1.1.1'), 2, 60_000, t + 2)).toBe(true)
  })
  it('counts each address and each route on its own', () => {
    const t = 2_000_000
    expect(tooMany('t2', from('2.2.2.2'), 1, 60_000, t)).toBe(false)
    expect(tooMany('t2', from('3.3.3.3'), 1, 60_000, t)).toBe(false)
    expect(tooMany('t2b', from('2.2.2.2'), 1, 60_000, t)).toBe(false)
    expect(tooMany('t2', from('2.2.2.2'), 1, 60_000, t)).toBe(true)
  })
  it('forgets calls older than the window', () => {
    const t = 3_000_000
    expect(tooMany('t3', from('4.4.4.4'), 1, 60_000, t)).toBe(false)
    expect(tooMany('t3', from('4.4.4.4'), 1, 60_000, t + 60_001)).toBe(false)
  })
})

describe('bearerMatches', () => {
  it('accepts only the exact secret', () => {
    expect(bearerMatches(from('x', 'Bearer s3cret'), 's3cret')).toBe(true)
    expect(bearerMatches(from('x', 'Bearer s3cres'), 's3cret')).toBe(false)
    expect(bearerMatches(from('x', 'Bearer s3cret!'), 's3cret')).toBe(false)
    expect(bearerMatches(from('x'), 's3cret')).toBe(false)
  })
  it('refuses everything when no secret is set', () => {
    expect(bearerMatches(from('x', 'Bearer '), undefined)).toBe(false)
    expect(bearerMatches(from('x', 'Bearer '), '')).toBe(false)
  })
})
