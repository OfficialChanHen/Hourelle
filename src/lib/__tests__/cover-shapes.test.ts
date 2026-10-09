import { describe, expect, it } from 'vitest'
import { coverShapes } from '@/lib/cover-shapes'

// the numbers measured off the real pages (Plans shelf, plan header) at each width
describe('cover shapes follow the layouts they copy', () => {
  it('a Plans card: one, two, then three across, never past the 1240px column', () => {
    expect(coverShapes(390).card).toEqual({ w: 322, h: 120 })
    expect(coverShapes(768).card).toEqual({ w: 318, h: 120 })
    expect(coverShapes(1024).card).toEqual({ w: 277, h: 120 })
    expect(coverShapes(1280).card).toEqual({ w: 349, h: 120 })
    expect(coverShapes(1600).card).toEqual(coverShapes(1280).card)
  })
  it('the plan page picture: full width on a phone, the side column from 768px', () => {
    expect(coverShapes(390).page).toEqual({ w: 338, h: 150 })
    expect(coverShapes(700).page).toEqual({ w: 440, h: 190 })
    expect(coverShapes(900).page).toEqual({ w: 280, h: 168 })
    expect(coverShapes(1280).page).toEqual({ w: 380, h: 214 })
  })
  it('the phone row is upright', () => {
    const { row } = coverShapes(390)
    expect(row.h).toBeGreaterThan(row.w)
  })
})
