import { beforeEach, describe, expect, it } from 'vitest'
import { keepMenuTrailOn, menuOrigin, noteMenuTrip, placeName } from '@/lib/nav'

const names = { about: 'About Timeld' }

describe('account menu trail', () => {
  beforeEach(() => { sessionStorage.clear() })

  it('leads a page opened from the menu back to where the menu was opened', () => {
    noteMenuTrip('/events/abc?tab=location', '/settings')
    expect(menuOrigin('/settings')).toBe('/events/abc?tab=location')
    expect(menuOrigin('/help')).toBeNull()
  })

  it('keeps the first origin, so hopping between menu pages never loops', () => {
    noteMenuTrip('/home', '/settings')
    noteMenuTrip('/settings', '/help')
    noteMenuTrip('/help', '/settings')
    expect(menuOrigin('/settings')).toBe('/home')
    expect(menuOrigin('/help')).toBe('/settings')
  })

  it('ignores the menu pointing at the page you are on', () => {
    noteMenuTrip('/profile', '/profile')
    expect(menuOrigin('/profile')).toBeNull()
  })

  it('holds among the account pages and forgets once you leave them', () => {
    noteMenuTrip('/home', '/settings')
    keepMenuTrailOn('/pricing')
    keepMenuTrailOn('/settings')
    expect(menuOrigin('/settings')).toBe('/home')
    keepMenuTrailOn('/events')
    expect(menuOrigin('/settings')).toBeNull()
  })

  it('never hands back an address off this site', () => {
    sessionStorage.setItem('hourelle.menu-from', JSON.stringify({ '/help': '//evil.example' }))
    expect(menuOrigin('/help')).toBeNull()
  })
})

describe('placeName', () => {
  it('names pages the way the nav does', () => {
    expect(placeName('/home', names)).toBe('Home')
    expect(placeName('/events?filter=past', names)).toBe('Plans')
    expect(placeName('/about', names)).toBe('About Timeld')
    expect(placeName('/somewhere', names)).toBe('Back')
  })

  it('names a plan by its title, or plainly when it is unknown', () => {
    expect(placeName('/events/abc?tab=chat', { ...names, plan: 'Board games' })).toBe('Board games')
    expect(placeName('/events/abc', names)).toBe('Back to the plan')
  })
})
