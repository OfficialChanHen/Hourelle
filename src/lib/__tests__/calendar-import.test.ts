import { describe, expect, it } from 'vitest'
import { buildImportPreview, gridSpanUtc, lockedPlanBusyUtc, planImport, zonedToUtc } from '@/lib/calendar-import'
import { day, person, plan } from '../../../test/fixtures'

const TZ = 'America/Chicago'
const busy = (key: string, fromMin: number, toMin: number, tz = TZ) => ({ s: zonedToUtc(key, fromMin, tz), e: zonedToUtc(key, toMin, tz) })

describe('buildImportPreview', () => {
  it('turns busy instants into grid minutes in the plan’s own timezone', () => {
    // busy 10–11 AM New York is 9–10 AM Chicago: the first row of a 9 AM grid
    const out = buildImportPreview([busy('2026-10-20', 600, 660, 'America/New_York')], [day('2026-10-20')], 540, 360, TZ)
    expect(out['2026-10-20'].busy).toEqual([{ s: 0, e: 60 }])
    expect(out['2026-10-20'].free).toEqual([{ s: 60, e: 360 }])
  })
  it('clips a block that runs past the grid', () => {
    const out = buildImportPreview([busy('2026-10-20', 420, 600)], [day('2026-10-20')], 540, 360, TZ)
    expect(out['2026-10-20'].busy).toEqual([{ s: 0, e: 60 }])
  })
  it('holds across a clock change (Nov 1 2026 in Chicago)', () => {
    const out = buildImportPreview([busy('2026-11-02', 600, 660)], [day('2026-11-02')], 540, 360, TZ)
    expect(out['2026-11-02'].busy).toEqual([{ s: 60, e: 120 }])
  })
})

describe('gridSpanUtc', () => {
  it('runs from the first row of the first day to the end of the last', () => {
    const span = gridSpanUtc([day('2026-10-21'), day('2026-10-20')], 540, 360, TZ)!
    expect(new Date(span.s).toISOString()).toBe('2026-10-20T14:00:00.000Z')
    expect(new Date(span.e).toISOString()).toBe('2026-10-21T20:00:00.000Z')
  })
})

describe('planImport', () => {
  const ev = plan()
  it('adds free time, keeps what you marked, and stripes the busy stretch', () => {
    const out = planImport(ev, 'H', { '2026-10-20': [{ s: 0, e: 30 }] }, [busy('2026-10-20', 600, 660)])
    expect(out.times['2026-10-20']).toEqual([{ s: 0, e: 60 }, { s: 120, e: 360 }])
    expect(out.times['2026-10-21']).toEqual([{ s: 0, e: 360 }])
    expect(out.addedMin).toBe(30 + 240 + 360)
    expect(out.importedIv['2026-10-20']).toEqual({ H: [{ s: 60, e: 120 }] })
    expect(out.timesChanged && out.stripesChanged).toBe(true)
  })
  it('says when the calendar is empty', () => {
    const out = planImport(ev, 'H', {}, [])
    expect(out.none).toBe(true)
    expect(out.stripesChanged).toBe(false)
  })
  it('says when every hour is busy, and paints nothing', () => {
    const out = planImport(ev, 'H', {}, [busy('2026-10-20', 0, 1440), busy('2026-10-21', 0, 1440)])
    expect(out.allBusy).toBe(true)
    expect(out.timesChanged).toBe(false)
  })
  it('never removes a mark, even over a busy stretch', () => {
    const out = planImport(ev, 'H', { '2026-10-20': [{ s: 60, e: 120 }] }, [busy('2026-10-20', 600, 660)])
    expect(out.times['2026-10-20']).toEqual([{ s: 0, e: 360 }])
  })
  it('on a day poll, marks only the clear days', () => {
    const dp = plan({ granularity: 'day', times: ['All day'] })
    const out = planImport(dp, 'H', {}, [busy('2026-10-20', 600, 660)])
    expect(out.times['2026-10-20']).toBeUndefined()
    expect(out.times['2026-10-21']).toEqual([{ s: 0, e: 1440 }])
    expect(out.addedDays).toBe(1)
  })
  it('keeps the stripes it already had', () => {
    const withOld = plan({ importedIv: { '2026-10-21': { H: [{ s: 0, e: 60 }] } } })
    const out = planImport(withOld, 'H', {}, [busy('2026-10-20', 600, 660)])
    expect(out.importedIv['2026-10-21']).toEqual({ H: [{ s: 0, e: 60 }] })
  })
})

describe('lockedPlanBusyUtc', () => {
  const locked = (id: string, rsvp: 'attending' | 'pending' | 'maybe') =>
    plan({ id, confirmed: { dayKey: '2026-10-20', startMin: 13 * 60, endMin: 15 * 60, placeIds: [] }, participants: [person('ME', { you: true, rsvp })] })
  it('counts only locked plans you said you are going to', () => {
    expect(lockedPlanBusyUtc([locked('a', 'attending'), locked('b', 'pending'), locked('c', 'maybe')])).toHaveLength(1)
  })
  it('leaves out the plan being filled, and unlocked plans', () => {
    expect(lockedPlanBusyUtc([locked('a', 'attending')], 'a')).toEqual([])
    expect(lockedPlanBusyUtc([plan()])).toEqual([])
  })
})
