import { describe, expect, it } from 'vitest'
import { hashOpens } from '../useHashOpen'

describe('hashOpens', () => {
  it('opens on a listed hash, with or without the #', () => {
    expect(hashOpens(['face'], '#face')).toBe(true)
    expect(hashOpens(['usual-week', 'usual-days'], 'usual-days')).toBe(true)
  })
  it('never opens with no hash', () => {
    expect(hashOpens(['face'], '')).toBe(false)
    expect(hashOpens([], '')).toBe(false)
    expect(hashOpens([], '#')).toBe(false)
  })
  it('never opens on another hash', () => {
    expect(hashOpens(['face'], '#usual-week')).toBe(false)
    expect(hashOpens([], '#face')).toBe(false)
  })
})
