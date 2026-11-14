import { describe, expect, it } from 'vitest'
import { localPath } from '@/lib/local-path'

describe('localPath', () => {
  it('keeps our own pages with their query and hash', () => {
    expect(localPath('/home')).toBe('/home')
    expect(localPath('/events/abc-123/join?token=x#grid')).toBe('/events/abc-123/join?token=x#grid')
    expect(localPath('/welcome?next=%2Fhome')).toBe('/welcome?next=%2Fhome')
    // an encoded backslash stays encoded, so it is a path here, not a way out
    expect(localPath('/%5C%5Cevil.com')).toBe('/%5C%5Cevil.com')
  })
  it('refuses addresses that leave the site', () => {
    for (const bad of [
      '//evil.com', '/\\evil.com', '/\\/evil.com', '/\t/evil.com', '/\n/evil.com',
      'https://evil.com', 'javascript:alert(1)', 'evil.com', '\\\\evil.com',
    ]) expect(localPath(bad), bad).toBeNull()
  })
  it('refuses nothing at all', () => {
    expect(localPath('')).toBeNull()
    expect(localPath(null)).toBeNull()
    expect(localPath(undefined)).toBeNull()
  })
})
