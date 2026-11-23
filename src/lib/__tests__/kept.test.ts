import { describe, expect, it } from 'vitest'
import { keptError, NOT_KEPT } from '../db'

describe('keptError', () => {
  it('passes the database error through', () => {
    expect(keptError({ data: null, error: { message: 'permission denied' } })).toBe('permission denied')
  })
  it('counts an update that touched no row as not saved', () => {
    // what a row policy that filters the row out looks like: no error, no rows
    expect(keptError({ data: [], error: null })).toBe(NOT_KEPT)
    expect(keptError({ data: null, error: null })).toBe(NOT_KEPT)
  })
  it('counts a row coming back as saved', () => {
    expect(keptError({ data: [{ id: 'a' }], error: null })).toBeNull()
  })
})
