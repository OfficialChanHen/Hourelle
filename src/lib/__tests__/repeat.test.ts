import { afterEach, describe, expect, it, vi } from 'vitest'
import { getEvent, listEvents, type AppEvent } from '@/lib/events'
import { isDue, nextOccurrence, nextPlanDoc, openDueRepeatsHere, repeatLabel } from '@/lib/repeat'
import { day, person, plan, saved } from '../../../test/fixtures'

// a poll over Tue Oct 20 and Wed Oct 21 2026, locked on the Tuesday, 10 to 11 AM
const locked = (extra: Partial<AppEvent> = {}) => plan({
  status: 'confirmed', confirmed: { dayKey: '2026-10-20', startMin: 600, endMin: 660, placeIds: [] }, confirmedAt: 1,
  repeat: { every: 'week' }, ...extra,
})

afterEach(() => { vi.useRealTimers() })

describe('nextOccurrence', () => {
  it('moves by the cadence to the first date on or after today', () => {
    expect(nextOccurrence('2026-10-20', 'week', '2026-10-21')).toBe('2026-10-27')
    expect(nextOccurrence('2026-10-20', 'week', '2026-11-05')).toBe('2026-11-10')
    expect(nextOccurrence('2026-10-20', '2weeks', '2026-10-21')).toBe('2026-11-03')
    expect(nextOccurrence('2026-10-20', '2weeks', '2026-11-04')).toBe('2026-11-17')
  })
  it('every month keeps the weekday of the month', () => {
    // Tue Oct 6 2026 is the 1st Tuesday; Nov's is Nov 3
    expect(nextOccurrence('2026-10-06', 'month', '2026-10-07')).toBe('2026-11-03')
    // Fri Oct 30 is the last Friday; Nov's is Nov 27
    expect(nextOccurrence('2026-10-30', 'month', '2026-10-31')).toBe('2026-11-27')
  })
  it('is never the date it started from', () => {
    expect(nextOccurrence('2026-10-20', 'week', '2026-10-20')).toBe('2026-10-27')
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

describe('isDue', () => {
  it('is a repeating plan that is over and has no next one yet, whoever is looking', () => {
    vi.useFakeTimers({ now: new Date(2026, 9, 21, 12) })
    expect(isDue(locked())).toBe(true)
    expect(isDue(locked({ hostedByYou: false }))).toBe(true)
    expect(isDue(locked({ repeat: { every: 'week', nextId: 'x' } }))).toBe(false)
    expect(isDue(locked({ repeat: undefined }))).toBe(false)
  })
  it('waits until the locked time is over', () => {
    vi.useFakeTimers({ now: new Date(2026, 9, 19, 12) })
    expect(isDue(locked())).toBe(false)
  })
})

describe('nextPlanDoc', () => {
  const prev = locked({
    participants: [
      person('H', { host: true, you: true, rsvp: 'attending' }),
      person('A', { rsvp: 'attending', rsvpAuto: true }),
      person('g1', { guest: true, email: 'sam@x.com', inviteToken: 'tok', rsvp: 'not_going' }),
      person('g2', { guest: true }), // joined by the link with no address: cannot be reached again
    ],
    availIv: { '2026-10-20': { A: [{ s: 0, e: 60 }] } },
    avail: { '2026-10-20': [[], ['A']], '2026-10-21': [[], []] },
    unavailableIds: ['g1'],
    planDeadline: '2026-10-19',
    messages: [{ id: 'H', name: 'H', time: 'now', text: 'hi', you: true }],
  })
  const next = nextPlanDoc(prev, 'plan-2', '2026-10-21', 5)

  it('reopens as a poll on the next dates, with an empty grid', () => {
    expect(next.id).toBe('plan-2')
    expect(next.status).toBe('planning')
    expect(next.confirmed).toBeUndefined()
    expect(next.days.map((d) => d.key)).toEqual(['2026-10-27', '2026-10-28'])
    expect([next.startDate, next.endDate]).toEqual(['2026-10-27', '2026-10-28'])
    expect(next.days[0]).toMatchObject({ dow: 'Tue', date: 'Oct 27' })
    expect(next.times).toEqual(prev.times)
    expect(next.availIv).toEqual({ '2026-10-27': {}, '2026-10-28': {} })
    expect(next.avail['2026-10-27']).toEqual(prev.times.map(() => []))
    expect(next.unavailableIds).toEqual([])
    expect(next.messages).toEqual([])
    expect(next.planDeadline).toBe('2026-10-26')
  })
  it('keeps the people who can be reached, all back at no reply', () => {
    expect(next.participants.map((p) => p.id)).toEqual(['H', 'A', 'g1'])
    expect(next.participants.map((p) => p.rsvp)).toEqual(['attending', 'pending', 'pending'])
    expect(next.participants.find((p) => p.id === 'A')?.rsvpAuto).toBeUndefined()
    expect(next.participants.find((p) => p.id === 'g1')?.inviteToken).toBe('tok')
  })
  it('keeps repeating, and remembers where it came from', () => {
    expect(next.repeat).toEqual({ every: 'week' })
    expect(next.repeatOf).toBe('plan-1')
    expect(next.createdAt).toBe(5)
  })
  it('settles the place that was locked in', () => {
    const withPlace = locked({
      location: { mode: 'vote', planMode: 'vote', places: [{ id: 'p1', name: 'Cafe', place: '' }, { id: 'p2', name: 'Bar', place: '' }], platform: '', meetingLink: '' },
      votes: { p1: ['H'] }, confirmed: { dayKey: '2026-10-20', startMin: 600, endMin: 660, placeIds: ['p1'] },
    })
    const n = nextPlanDoc(withPlace, 'x', '2026-10-21', 1)
    expect(n.location.mode).toBe('set')
    expect(n.location.places.map((p) => p.id)).toEqual(['p1'])
    expect(n.votes).toEqual({})
  })
  it('brings a plan whose date was set at creation back set, a step on', () => {
    const set = plan({ days: [day('2026-10-20')], endDate: '2026-10-20', times: ['7 PM', '8 PM'], status: 'confirmed', confirmed: { dayKey: '2026-10-20', startMin: 1140, endMin: 1260, placeIds: [] }, confirmedAt: 1, repeat: { every: 'month' } })
    const n = nextPlanDoc(set, 'x', '2026-10-21', 1)
    expect(n.status).toBe('confirmed')
    expect(n.confirmed).toMatchObject({ dayKey: '2026-11-17', startMin: 1140, endMin: 1260 }) // the 3rd Tuesday
    expect(n.days.map((d) => d.key)).toEqual(['2026-11-17'])
  })
})

describe('openDueRepeatsHere', () => {
  it('opens each due plan once in this browser, however often it is asked', () => {
    vi.useFakeTimers({ now: new Date(2026, 9, 21, 12) })
    saved(locked())
    const made = openDueRepeatsHere()
    expect(made).toHaveLength(1)
    expect(openDueRepeatsHere()).toHaveLength(0)
    expect(listEvents()).toHaveLength(2)
    expect(getEvent('plan-1')!.repeat?.nextId).toBe(made[0].id)
    expect(getEvent(made[0].id)!.startDate).toBe('2026-10-27')
  })
})
