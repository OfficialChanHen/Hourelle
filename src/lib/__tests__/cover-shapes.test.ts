import { describe, expect, it } from 'vitest'
import { coverPlaces, coverShapes } from '@/lib/cover-shapes'

// the numbers measured off the real pages (Home, Plans, the plan header) at each width
describe('cover shapes follow the layouts they copy', () => {
  it('a Plans card: one, two, then three across, never past the widest column', () => {
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
  it('Home: the big card at each width, the smaller ones only from 1024px', () => {
    expect(coverShapes(390).home).toEqual({ w: 322, h: 112 })
    expect(coverShapes(700).home).toEqual({ w: 460, h: 160 })
    expect(coverShapes(900).home).toEqual({ w: 421, h: 160 })
    expect(coverShapes(1100).home).toEqual({ w: 515, h: 160 })
    expect(coverShapes(1440).home).toEqual({ w: 573, h: 160 })
    expect(coverShapes(900).homeSmall).toBeNull()
    expect(coverShapes(1280).homeSmall).toEqual({ w: 392, h: 84 })
  })
  it('the phone row is upright', () => {
    const { row } = coverShapes(390)
    expect(row.h).toBeGreaterThan(row.w)
  })
})

describe('the preview shows only the crops that differ', () => {
  it('wide cards, the plan page, then the upright phone list', () => {
    const places = coverPlaces(1280)
    expect(places.map((p) => p.label)).toEqual(['Cards', 'Plan page', 'Phone list'])
    expect(places[0].ratio).toBeGreaterThan(places[1].ratio)
    expect(places[2].ratio).toBeLessThan(1)
  })
  it('on a phone the cards and the plan page crop alike, so they share one', () => {
    expect(coverPlaces(390).map((p) => p.label)).toEqual(['Cards and plan page', 'Phone list'])
  })
})
