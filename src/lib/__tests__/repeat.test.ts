import { afterEach, describe, expect, it, vi } from 'vitest'
import { getEvent, listEvents, type AppEvent } from '@/lib/events'
import { carryAnswers, dueRepeats, openDueRepeats, openNextWeek } from '@/lib/repeat'
import { day, person, plan, saved } from '../../../test/fixtures'

// Tue Oct 20 and Wed Oct 21 2026, hourly 9 AM to 3 PM; next week is Oct 27 and 28
const next = (extra: Partial<AppEvent> = {}) => plan({ id: 'plan-2', days: [day('2026-10-27'), day('2026-10-28')], ...extra })
// locked on the Tuesday, 10 to 11 AM
const locked = (extra: Partial<AppEvent> = {}) => plan({
  status: 'confirmed', confirmed: { dayKey: '2026-10-20', startMin: 600, endMin: 660, placeIds: [] }, confirmedAt: 1,
  repeat: { every: 'week' }, ...extra,
})

afterEach(() => { vi.useRealTimers() })

describe('carryAnswers', () => {
  it('moves each answer to the same weekday of the new plan', () => {
    const prev = plan({ participants: [person('H', { host: true }), person('A')], availIv: { '2026-10-20': { A: [{ s: 0, e: 120 }] }, '2026-10-21': { A: [{ s: 180, e: 240 }] } } })
    const out = carryAnswers(prev, next({ participants: [person('H', { host: true }), person('A')] }))
    expect(out.A.free).toEqual({ '2026-10-27': [{ s: 0, e: 120 }], '2026-10-28': [{ s: 180, e: 240 }] })
    expect(out.H).toBeUndefined()
  })
  it('keeps if-need-be marks apart from free ones', () => {
    const prev = plan({ participants: [person('A')], availIv: { '2026-10-20': { A: [{ s: 0, e: 60 }] } }, needIv: { '2026-10-20': { A: [{ s: 60, e: 120 }] } } })
    const out = carryAnswers(prev, next({ participants: [person('A')] }))
    expect(out.A.free).toEqual({ '2026-10-27': [{ s: 0, e: 60 }] })
    expect(out.A.need).toEqual({ '2026-10-27': [{ s: 60, e: 120 }] })
  })
  it('finds a guest again by email, since a guest gets a new id on every plan', () => {
    const prev = plan({ participants: [person('g-old', { guest: true, email: 'Sam@x.com' })], availIv: { '2026-10-20': { 'g-old': [{ s: 0, e: 60 }] } } })
    const out = carryAnswers(prev, next({ participants: [person('g-new', { guest: true, email: 'sam@x.com' })] }))
    expect(out['g-new'].free).toEqual({ '2026-10-27': [{ s: 0, e: 60 }] })
  })
  it('reads the clock, so a grid that starts later keeps the same hours', () => {
    const prev = plan({ participants: [person('A')], availIv: { '2026-10-20': { A: [{ s: 60, e: 240 }] } } }) // 10 AM to 1 PM
    const out = carryAnswers(prev, next({ participants: [person('A')], times: ['11 AM', '12 PM', '1 PM', '2 PM'] }))
    expect(out.A.free).toEqual({ '2026-10-27': [{ s: 0, e: 120 }] }) // 11 AM to 1 PM
  })
  it('takes the latest of two days on the same weekday', () => {
    const prev = plan({ participants: [person('A')], days: [day('2026-10-13'), day('2026-10-20')], availIv: { '2026-10-13': { A: [{ s: 0, e: 60 }] }, '2026-10-20': { A: [{ s: 120, e: 180 }] } } })
    const out = carryAnswers(prev, next({ participants: [person('A')] }))
    expect(out.A.free).toEqual({ '2026-10-27': [{ s: 120, e: 180 }] })
  })
  it('carries nothing for someone who said no days work, or across a change of kind', () => {
    const prev = plan({ participants: [person('A'), person('B')], unavailableIds: ['B'], availIv: { '2026-10-20': { A: [{ s: 0, e: 60 }] } } })
    expect(carryAnswers(prev, next({ participants: [person('A'), person('B')] })).B).toBeUndefined()
    expect(carryAnswers(prev, next({ participants: [person('A')], granularity: 'day', times: ['All day'] }))).toEqual({})
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

describe('openNextWeek', () => {
  it('opens the same plan a week on, repeating, with last answers offered', () => {
    vi.useFakeTimers({ now: new Date(2026, 9, 21, 12) }) // Wed Oct 21, the day after
    saved(locked({ participants: [person('H', { host: true, you: true }), person('A', { email: 'a@x.com', guest: true })], availIv: { '2026-10-20': { A: [{ s: 0, e: 60 }] } } }))
    const made = openNextWeek('plan-1')!
    expect(made.startDate).toBe('2026-10-27')
    expect(made.status).toBe('planning')
    expect(made.repeat).toEqual({ every: 'week' })
    expect(made.repeatOf).toBe('plan-1')
    const a = made.participants.find((p) => p.email === 'a@x.com')!
    expect(made.lastAnswers?.[a.id].free).toEqual({ '2026-10-27': [{ s: 0, e: 60 }] })
    // no one is answered for: the new grid starts empty
    expect(Object.values(made.availIv ?? {}).every((d) => Object.keys(d).length === 0)).toBe(true)
    expect(getEvent('plan-1')!.repeat?.nextId).toBe(made.id)
  })
  it('brings a plan whose date was set back set, on the same weekday', () => {
    vi.useFakeTimers({ now: new Date(2026, 9, 20, 22) }) // Tue Oct 20, 10 PM, after it ended
    // born set: one day, the grid built around 7 to 9 PM
    saved(plan({ days: [day('2026-10-20')], endDate: '2026-10-20', times: ['7 PM', '8 PM'], status: 'confirmed', confirmed: { dayKey: '2026-10-20', startMin: 1140, endMin: 1260, placeIds: [] }, confirmedAt: 1, repeat: { every: 'week' } }))
    const made = openDueRepeats()[0]
    expect(made.status).toBe('confirmed')
    expect(made.confirmed).toMatchObject({ dayKey: '2026-10-27', startMin: 1140, endMin: 1260 })
  })
  it('opens each due plan once, however often it is asked', () => {
    vi.useFakeTimers({ now: new Date(2026, 9, 21, 12) })
    saved(locked())
    expect(openDueRepeats()).toHaveLength(1)
    expect(openDueRepeats()).toHaveLength(0)
    expect(listEvents()).toHaveLength(2)
  })
})
