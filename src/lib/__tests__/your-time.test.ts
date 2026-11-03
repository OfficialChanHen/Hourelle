import { describe, expect, it } from 'vitest'
import { fmtMinute } from '@/lib/events'
import { localDayOffset, nextDayRow, shiftDay, yourHours } from '@/app/(main)/events/[id]/_components/availability/grid-lib'

// a New York plan read in Manila: 13 hours ahead in November
const MANILA = 13 * 60

describe('a plan read in your own time', () => {
  it('says which of your dates a column starts on', () => {
    expect(localDayOffset(9 * 60, MANILA)).toBe(0) // 9 AM there is 10 PM the same day here
    expect(localDayOffset(12 * 60, MANILA)).toBe(1) // noon there is 1 AM the next day here
    expect(localDayOffset(0, -MANILA)).toBe(-1) // a Manila midnight read in New York
  })

  it('finds the row where your midnight falls', () => {
    // 9 AM to 9 PM in 30-minute rows: 10 PM here, so midnight is 2 hours in, row 4
    expect(nextDayRow(9 * 60, MANILA, 30, 24)).toBe(4)
    // an all-day plan: midnight here is 11 AM there, row 22
    expect(nextDayRow(0, MANILA, 30, 48)).toBe(22)
    // a half-hour zone on hour rows: the first row after midnight
    expect(nextDayRow(0, 10.5 * 60, 60, 24)).toBe(14)
  })

  it('has no midnight row when the column stays on one of your dates', () => {
    expect(nextDayRow(17 * 60, MANILA, 30, 8)).toBe(-1) // 5 to 9 PM there is 6 to 10 AM here
    expect(nextDayRow(9 * 60, 0, 30, 24)).toBe(-1)
    // the plan's hours end exactly at your midnight
    expect(nextDayRow(9 * 60, 3 * 60, 60, 12)).toBe(-1)
  })

  it('moves a day by whole dates, across a month', () => {
    expect(shiftDay({ key: '2026-11-30', dow: 'Mon', date: 'Nov 30' }, 1)).toEqual({ key: '2026-12-01', dow: 'Tue', date: 'Dec 1' })
    expect(shiftDay({ key: '2026-11-07', dow: 'Sat', date: 'Nov 7' }, -1)).toEqual({ key: '2026-11-06', dow: 'Fri', date: 'Nov 6' })
    const d = { key: '2026-11-07', dow: 'Sat', date: 'Nov 7' }
    expect(shiftDay(d, 0)).toBe(d)
  })

  it('names the plan hours on your clock', () => {
    expect(yourHours(9 * 60, 12 * 60, MANILA, false)).toEqual({ plan: '9:00 AM to 9:00 PM', yours: '10:00 PM to 10:00 AM' })
    expect(yourHours(17 * 60, 4 * 60, MANILA, true)).toEqual({ plan: '17:00 to 21:00', yours: '06:00 to 10:00' })
  })

  it('reads a time before your midnight as the evening before', () => {
    // a Manila plan read in New York: midnight there is 11 AM the day before here
    expect(fmtMinute(-MANILA)).toBe('11:00 AM')
    expect(fmtMinute(-30, true)).toBe('23:30')
  })
})
