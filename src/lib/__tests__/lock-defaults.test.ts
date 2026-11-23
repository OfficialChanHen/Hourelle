import { describe, expect, it } from 'vitest'
import { createEvent, lockStart, runRows, type AppEvent } from '@/lib/events'
import gameNight from '../../../test/game-night.json'

// game night: 5 PM to 9 PM, one person, open length. Marked Tue 5:30–7:30, Wed 5–8:30,
// Thu 7–9, Fri 5:30–7:30, Sat 5–9, nothing Sun or Mon
const ev = gameNight as unknown as AppEvent
const at = (h: number, m = 0) => h * 60 + m
const keys = (from: number, n: number) => ev.days.slice(from, from + n).map((d) => d.key)

describe('where the lock-in opens', () => {
  it('opens a run on the grid’s best run of that many days, not the best single start', () => {
    expect(lockStart(ev, 3)).toEqual({ dayKey: '2026-11-17', endDayKey: '2026-11-19' })
    expect(lockStart(ev, 5)).toEqual({ dayKey: '2026-11-17', endDayKey: '2026-11-21' })
  })
  it('opens one day on the best time', () => {
    expect(lockStart(ev, 1)).toEqual({ dayKey: '2026-11-21', endDayKey: '2026-11-21' })
  })
})

describe('the rows of a run before the host changes any', () => {
  it('gives every day of a long run its own hours from its own marks', () => {
    const rows = runRows(ev, keys(0, 5))
    expect(rows.map((r) => [r.dayKey, r.startMin, r.endMin, r.skip])).toEqual([
      ['2026-11-17', at(17, 30), at(19, 30), false],
      ['2026-11-18', at(17), at(20, 30), false],
      ['2026-11-19', at(19), at(21), false],
      ['2026-11-20', at(17, 30), at(19, 30), false],
      ['2026-11-21', at(17), at(21), false],
    ])
  })
  it('starts a day nobody marked skipped instead of lending it another day’s hours', () => {
    const rows = runRows(ev, keys(4, 3))
    expect(rows.map((r) => [r.dayKey, r.skip])).toEqual([
      ['2026-11-21', false], ['2026-11-22', true], ['2026-11-23', true],
    ])
  })
  it('uses the plan’s length on a run of days when the length is set', () => {
    const rows = runRows({ ...ev, openLength: undefined }, keys(0, 3))
    expect(rows.map((r) => [r.startMin, r.endMin])).toEqual([
      [at(17, 30), at(19, 30)], [at(17), at(20, 30)], [at(19), at(21)],
    ])
  })
})

describe('a date set at creation with an open end', () => {
  it('locks a start with no agreed end', () => {
    const made = createEvent({
      title: 'Game night', description: '', budget: '', locMode: 'remote', platform: 'Google Meet', granularity: '30', timezone: 'America/Chicago',
      startDate: '', endDate: '', picked: [], emails: [], accounts: [],
      fixed: { day: '2030-11-21', start: '19:00', end: '21:00', openEnd: true },
    } as unknown as Parameters<typeof createEvent>[0])
    expect(made.confirmed).toMatchObject({ dayKey: '2030-11-21', startMin: at(19), openEnd: true })
    expect(made.confirmed!.endMin).toBeGreaterThan(at(19))
    expect(made.openLength).toBe(true)
  })
})
