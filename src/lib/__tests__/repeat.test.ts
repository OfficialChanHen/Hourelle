import { afterEach, describe, expect, it, vi } from 'vitest'
import { getEvent, listEvents, type AppEvent } from '@/lib/events'
import { dueRepeats, nextSlot, openDueRepeats, openNext, repeatLabel } from '@/lib/repeat'
import { day, person, plan, saved } from '../../../test/fixtures'

// a poll over Tue Oct 20 and Wed Oct 21 2026, locked on the Tuesday, 10 to 11 AM
const locked = (extra: Partial<AppEvent> = {}) => plan({
  status: 'confirmed', confirmed: { dayKey: '2026-10-20', startMin: 600, endMin: 660, placeIds: [] }, confirmedAt: 1,
  repeat: { every: 'week' }, ...extra,
})

afterEach(() => { vi.useRealTimers() })

const slot = (dayKey: string, startMin = 600, endMin = 660, endDayKey?: string) => ({ dayKey, startMin, endMin, placeIds: [], ...(endDayKey ? { endDayKey } : {}) })

describe('nextSlot', () => {
  it('every week is the same weekday and clock time a week on', () => {
    expect(nextSlot(slot('2026-10-20'), 'week', '2026-10-21')).toEqual({ day: '2026-10-27', start: '10:00', end: '11:00', allDay: false })
  })
  it('skips the dates already gone', () => {
    expect(nextSlot(slot('2026-10-20'), 'week', '2026-11-05').day).toBe('2026-11-10')
    expect(nextSlot(slot('2026-10-20'), '2weeks', '2026-10-21').day).toBe('2026-11-03')
    expect(nextSlot(slot('2026-10-20'), '2weeks', '2026-11-04').day).toBe('2026-11-17')
  })
  it('every month keeps the weekday of the month', () => {
    // Tue Oct 6 2026 is the 1st Tuesday; Nov's is Nov 3
    expect(nextSlot(slot('2026-10-06'), 'month', '2026-10-07').day).toBe('2026-11-03')
    // Fri Oct 30 is the last Friday; Nov's is Nov 27
    expect(nextSlot(slot('2026-10-30'), 'month', '2026-10-31').day).toBe('2026-11-27')
  })
  it('keeps a run of days and an all-day slot whole', () => {
    expect(nextSlot(slot('2026-10-23', 0, 1440, '2026-10-25'), 'week', '2026-10-26'))
      .toEqual({ day: '2026-10-30', endDay: '2026-11-01', start: '00:00', end: '24:00', allDay: true })
  })
})

describe('repeatLabel', () => {
  it('says the cadence, naming the weekday of the month for monthly', () => {
    expect(repeatLabel('week', '2026-10-20')).toBe('Every week')
    expect(repeatLabel('2weeks', '2026-10-20')).toBe('Every 2 weeks')
    expect(repeatLabel('month', '2026-10-06')).toBe('Every month on the 1st Tue')
    expect(repeatLabel('month', '2026-10-30')).toBe('Every month on the last Fri')
  })
})

describe('dueRepeats', () => {
  it('is a repeating plan of yours that is over and has no next week yet', () => {
    vi.useFakeTimers({ now: new Date(2026, 9, 21, 12) })
    expect(dueRepeats([locked()]).map((e) => e.id)).toEqual(['plan-1'])
    expect(dueRepeats([locked({ repeat: { every: 'week', nextId: 'x' } })])).toEqual([])
    expect(dueRepeats([locked({ hostedByYou: false })])).toEqual([])
    expect(dueRepeats([locked({ repeat: undefined })])).toEqual([])
  })
  it('waits until the locked time is over', () => {
    vi.useFakeTimers({ now: new Date(2026, 9, 19, 12) })
    expect(dueRepeats([locked()])).toEqual([])
  })
})

describe('openNext', () => {
  it('opens next week already locked at the same time, with the same people', () => {
    vi.useFakeTimers({ now: new Date(2026, 9, 21, 12) }) // Wed Oct 21, the day after
    saved(locked({ participants: [person('H', { host: true, you: true }), person('A', { email: 'a@x.com', guest: true, rsvp: 'attending' })] }))
    const made = openNext('plan-1')!
    expect(made.status).toBe('confirmed')
    expect(made.confirmed).toMatchObject({ dayKey: '2026-10-27', startMin: 600, endMin: 660 })
    expect(made.repeat).toEqual({ every: 'week' })
    expect(made.repeatOf).toBe('plan-1')
    // everyone is asked again: last week's going is not this week's
    expect(made.participants.find((p) => p.email === 'a@x.com')?.rsvp).toBe('pending')
    expect(getEvent('plan-1')!.repeat?.nextId).toBe(made.id)
  })
  it('keeps the cadence it was given', () => {
    vi.useFakeTimers({ now: new Date(2026, 9, 21, 12) })
    saved(locked({ repeat: { every: 'month' } }))
    const made = openNext('plan-1')!
    expect(made.repeat).toEqual({ every: 'month' })
    expect(made.confirmed?.dayKey).toBe('2026-11-17') // the 3rd Tuesday
  })
  it('opens each due plan once, however often it is asked', () => {
    vi.useFakeTimers({ now: new Date(2026, 9, 21, 12) })
    saved(locked())
    expect(openDueRepeats()).toHaveLength(1)
    expect(openDueRepeats()).toHaveLength(0)
    expect(listEvents()).toHaveLength(2)
  })
  it('repeats a plan whose date was set at creation the same way', () => {
    vi.useFakeTimers({ now: new Date(2026, 9, 20, 22) }) // Tue Oct 20, 10 PM, after it ended
    saved(plan({ days: [day('2026-10-20')], endDate: '2026-10-20', times: ['7 PM', '8 PM'], status: 'confirmed', confirmed: { dayKey: '2026-10-20', startMin: 1140, endMin: 1260, placeIds: [] }, confirmedAt: 1, repeat: { every: 'week' } }))
    const made = openDueRepeats()[0]
    expect(made.status).toBe('confirmed')
    expect(made.confirmed).toMatchObject({ dayKey: '2026-10-27', startMin: 1140, endMin: 1260 })
  })
})
