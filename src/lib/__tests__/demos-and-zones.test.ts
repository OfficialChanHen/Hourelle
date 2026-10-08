import { describe, expect, it } from 'vitest'
import { daysUntil, listDemos } from '@/lib/events'
import { tzAbbr } from '@/components/ui/TimezonePill'

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

describe('demo dates', () => {
  const demos = listDemos()
  it('start about two months out, never years', () => {
    const lead = Math.min(...demos.map((d) => daysUntil(d.startDate) ?? 0))
    expect(lead).toBeGreaterThanOrEqual(56)
    expect(lead).toBeLessThanOrEqual(64)
    for (const d of demos) expect(daysUntil(d.startDate)!).toBeLessThan(200)
  })
  it('keep every weekday and relabel every day', () => {
    for (const d of demos) for (const g of d.days) {
      const [y, m, dd] = g.key.split('-').map(Number)
      expect(DOW[new Date(y, m - 1, dd).getDay()]).toBe(g.dow)
    }
  })
  it('move the dates in chat lines with the grid', () => {
    const offsite = demos.find((d) => d.id === 'q3-offsite')!
    expect(offsite.messages.some((m) => m.text.includes('2029'))).toBe(false)
    expect(JSON.stringify(offsite)).not.toContain('2029-')
  })
})

describe('tzAbbr', () => {
  it('names the zone for the day it labels', () => {
    expect(tzAbbr('America/Los_Angeles', '2026-12-30')).toBe('PST')
    expect(tzAbbr('America/Los_Angeles', '2026-07-01')).toBe('PDT')
  })
  it('falls back for a zone it does not know', () => {
    expect(tzAbbr('Nowhere/Atlantis')).toBe('ATL')
  })
})
