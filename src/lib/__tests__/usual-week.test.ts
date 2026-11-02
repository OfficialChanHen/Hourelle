import { describe, expect, it } from 'vitest'
import { zonedToUtc } from '@/lib/calendar-import'
import { cleanUsualWeek, emptyWeek, moveWeekToZone, planUsualWeek, usualFreeUtc, weekHasTime, type UsualWeek } from '@/lib/usual-week'
import { day, plan } from '../../../test/fixtures'

const TZ = 'America/Chicago'
// a week with the same ranges on the given weekdays (0 = Sunday)
const week = (ranges: [number, number][], on: number[], tz = TZ): UsualWeek => {
  const w = emptyWeek(tz)
  for (const d of on) w.days[d] = ranges.map(([s, e]) => ({ s, e }))
  return w
}
const iso = (ms: number) => new Date(ms).toISOString()

describe('usualFreeUtc', () => {
  it('turns a weekday pattern into instants on the right dates', () => {
    // Tuesdays 10 AM to noon Chicago; Oct 20 2026 is a Tuesday (CDT, UTC-5)
    const out = usualFreeUtc(week([[600, 720]], [2]), zonedToUtc('2026-10-19', 0, TZ), zonedToUtc('2026-10-22', 0, TZ))
    expect(out.map((b) => [iso(b.s), iso(b.e)])).toEqual([['2026-10-20T15:00:00.000Z', '2026-10-20T17:00:00.000Z']])
  })
  it('keeps local clock times across a clock change', () => {
    // Mondays 6 to 8 PM: Oct 26 is CDT (UTC-5), Nov 2 is CST (UTC-6)
    const out = usualFreeUtc(week([[1080, 1200]], [1]), zonedToUtc('2026-10-26', 0, TZ), zonedToUtc('2026-11-03', 0, TZ))
    expect(out.map((b) => iso(b.s))).toEqual(['2026-10-26T23:00:00.000Z', '2026-11-03T00:00:00.000Z'])
  })
  it('joins a range that ends at midnight to the next morning', () => {
    const w = emptyWeek(TZ)
    w.days[5] = [{ s: 1320, e: 1440 }] // Friday 10 PM to midnight
    w.days[6] = [{ s: 0, e: 60 }]      // Saturday to 1 AM
    const out = usualFreeUtc(w, zonedToUtc('2026-10-23', 0, TZ), zonedToUtc('2026-10-25', 0, TZ))
    expect(out).toHaveLength(1)
    expect(out[0].e - out[0].s).toBe(3 * 3600_000)
  })
  it('clips to the span asked for', () => {
    const out = usualFreeUtc(week([[0, 1440]], [2]), zonedToUtc('2026-10-20', 600, TZ), zonedToUtc('2026-10-20', 660, TZ))
    expect(out).toEqual([{ s: zonedToUtc('2026-10-20', 600, TZ), e: zonedToUtc('2026-10-20', 660, TZ) }])
  })
})

describe('planUsualWeek', () => {
  // the fixture: Tue Oct 20 and Wed Oct 21, 9 AM to 3 PM Chicago, hourly
  const ev = plan()
  it('adds the usual free time inside the grid and draws no stripes', () => {
    const out = planUsualWeek(ev, 'H', {}, week([[600, 720]], [2, 3]))
    expect(out.times['2026-10-20']).toEqual([{ s: 60, e: 180 }])
    expect(out.times['2026-10-21']).toEqual([{ s: 60, e: 180 }])
    expect(out.addedMin).toBe(240)
    expect(out.stripesChanged).toBe(false)
    expect(out.importedIv).toEqual({})
  })
  it('reads the week in its own timezone on a plan in another one', () => {
    // 10 AM to noon New York is 9 to 11 AM Chicago
    const out = planUsualWeek(ev, 'H', {}, week([[600, 720]], [2], 'America/New_York'))
    expect(out.times['2026-10-20']).toEqual([{ s: 0, e: 120 }])
  })
  it('never removes a mark, free or if need be', () => {
    const out = planUsualWeek(ev, 'H', { '2026-10-20': [{ s: 0, e: 30 }] }, week([[540, 900]], [2]), { '2026-10-20': [{ s: 120, e: 180 }] })
    expect(out.times['2026-10-20']).toEqual([{ s: 0, e: 120 }, { s: 180, e: 360 }])
    expect(out.addedMin).toBe(360 - 30 - 60)
  })
  it('leaves out what a calendar striped as busy and your locked plans', () => {
    const striped = plan({ importedIv: { '2026-10-20': { H: [{ s: 0, e: 60 }] } } })
    const locked = [{ s: zonedToUtc('2026-10-20', 720, TZ), e: zonedToUtc('2026-10-20', 780, TZ) }]
    const out = planUsualWeek(striped, 'H', {}, week([[540, 900]], [2]), {}, locked)
    expect(out.times['2026-10-20']).toEqual([{ s: 60, e: 180 }, { s: 240, e: 360 }])
    expect(out.importedIv).toEqual(striped.importedIv)
  })
  it('on a day poll, marks days with an hour or more free and nothing marked', () => {
    const dp = plan({ granularity: 'day', times: ['All day'], days: [day('2026-10-20'), day('2026-10-21'), day('2026-10-22')] })
    const w = emptyWeek(TZ)
    w.days[2] = [{ s: 1080, e: 1200 }] // Tue 2h
    w.days[3] = [{ s: 1080, e: 1110 }] // Wed 30m, too short
    w.days[4] = [{ s: 1080, e: 1200 }] // Thu, but already marked
    const out = planUsualWeek(dp, 'H', { '2026-10-22': [{ s: 0, e: 1440 }] }, w)
    expect(out.times['2026-10-20']).toEqual([{ s: 0, e: 1440 }])
    expect(out.times['2026-10-21']).toBeUndefined()
    expect(out.addedDays).toBe(1)
  })
  it('says when the week has nothing in the plan’s window', () => {
    const out = planUsualWeek(ev, 'H', {}, week([[1080, 1200]], [2, 3]))
    expect(out.none).toBe(true)
    expect(out.timesChanged).toBe(false)
  })
})

describe('the stored week', () => {
  it('cleans what comes back from storage', () => {
    expect(cleanUsualWeek(null)).toBeUndefined()
    expect(cleanUsualWeek({ tz: 'UTC', days: 'x' })).toBeUndefined()
    const w = cleanUsualWeek({ tz: 'UTC', days: [[{ s: 60, e: 0 }, { s: 0, e: 30 }, { s: 20, e: 90 }], [], [], [], [], [], [{ s: 1400, e: 2000 }]] })!
    expect(w.days[0]).toEqual([{ s: 0, e: 90 }])
    expect(w.days[6]).toEqual([{ s: 1400, e: 1440 }])
    expect(weekHasTime(w)).toBe(true)
    expect(weekHasTime(emptyWeek('UTC'))).toBe(false)
  })
})

describe('moveWeekToZone', () => {
  it('moves the ranges by the gap between the zones, across midnight', () => {
    const w = emptyWeek('America/Chicago')
    w.days[1] = [{ s: 1080, e: 1440 }] // Monday 6 PM to midnight Chicago
    // in London on Nov 10 2026 that is Tuesday midnight to 6 AM
    const out = moveWeekToZone(w, 'Europe/London', Date.parse('2026-11-10T12:00:00Z'))
    expect(out.tz).toBe('Europe/London')
    expect(out.days[1]).toEqual([])
    expect(out.days[2]).toEqual([{ s: 0, e: 360 }])
  })
  it('wraps Saturday night into Sunday morning', () => {
    const w = emptyWeek('UTC')
    w.days[6] = [{ s: 1380, e: 1440 }]
    const out = moveWeekToZone(w, 'Asia/Tokyo', Date.parse('2026-11-10T12:00:00Z'))
    expect(out.days[0]).toEqual([{ s: 480, e: 540 }])
  })
})
