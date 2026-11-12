import { describe, expect, it } from 'vitest'
import { sessionsOf, slotLines, slotOver, slotWhen, type SlotLike } from '@/lib/slot'

const next = (k: string) => {
  const [y, m, d] = k.split('-').map(Number)
  const t = new Date(y, m - 1, d + 1)
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
}
const day = (k: string) => ({ '2026-11-20': 'Fri, Nov 20', '2026-11-21': 'Sat, Nov 21', '2026-11-22': 'Sun, Nov 22' })[k] ?? k
const time = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`

const three: SlotLike = {
  dayKey: '2026-11-20', endDayKey: '2026-11-22', startMin: 18 * 60, endMin: 13 * 60,
  sessions: [
    { dayKey: '2026-11-20', startMin: 18 * 60, endMin: 22 * 60 },
    { dayKey: '2026-11-21', startMin: 11 * 60, endMin: 16 * 60 },
    { dayKey: '2026-11-22', startMin: 11 * 60, endMin: 13 * 60 },
  ],
}
const skipped: SlotLike = { ...three, sessions: [three.sessions![0], three.sessions![2]] }
const open: SlotLike = { dayKey: '2026-11-21', startMin: 20 * 60, endMin: 23 * 60 + 30, openEnd: true }

describe('sessionsOf', () => {
  it('gives the sessions a slot carries', () => {
    expect(sessionsOf(three, next)).toEqual(three.sessions)
  })
  it('gives one whole-day session per day of an all-day run', () => {
    expect(sessionsOf({ dayKey: '2026-11-20', endDayKey: '2026-11-22', startMin: 0, endMin: 1440 }, next)).toEqual([
      { dayKey: '2026-11-20', startMin: 0, endMin: 1440 },
      { dayKey: '2026-11-21', startMin: 0, endMin: 1440 },
      { dayKey: '2026-11-22', startMin: 0, endMin: 1440 },
    ])
  })
  it('splits a timed run at midnight: first from its start, last to its end', () => {
    expect(sessionsOf({ dayKey: '2026-11-20', endDayKey: '2026-11-22', startMin: 18 * 60, endMin: 12 * 60 }, next)).toEqual([
      { dayKey: '2026-11-20', startMin: 18 * 60, endMin: 1440 },
      { dayKey: '2026-11-21', startMin: 0, endMin: 1440 },
      { dayKey: '2026-11-22', startMin: 0, endMin: 12 * 60 },
    ])
  })
  it('gives a single day as itself', () => {
    expect(sessionsOf({ dayKey: '2026-11-21', startMin: 600, endMin: 660 }, next)).toEqual([{ dayKey: '2026-11-21', startMin: 600, endMin: 660 }])
  })
})

describe('saying it', () => {
  it('says a run with its own hours as a span of days', () => {
    expect(slotWhen(three, day, time)).toBe('Fri, Nov 20 – Sun, Nov 22, 3 days')
    expect(slotWhen(skipped, day, time)).toBe('Fri, Nov 20 – Sun, Nov 22, 2 days')
  })
  it('says an open end without an end time', () => {
    expect(slotWhen(open, day, time)).toBe('Sat, Nov 21, 20:00, open end')
  })
  it('gives one line per day where there is room', () => {
    expect(slotLines(three, day, time)).toEqual(['Fri, Nov 20, 18:00 – 22:00', 'Sat, Nov 21, 11:00 – 16:00', 'Sun, Nov 22, 11:00 – 13:00'])
    expect(slotLines({ ...skipped, openEnd: true }, day, time)).toEqual(['Fri, Nov 20, 18:00, open end', 'Sun, Nov 22, 11:00, open end'])
    expect(slotLines({ dayKey: '2026-11-21', startMin: 600, endMin: 660 }, day, time)).toEqual(['Sat, Nov 21, 10:00 – 11:00'])
  })
})

describe('slotOver', () => {
  it('ends a run of sessions at the last one’s end', () => {
    expect(slotOver(three, '2026-11-20', 23 * 60)).toBe(false)
    expect(slotOver(three, '2026-11-22', 12 * 60)).toBe(false)
    expect(slotOver(three, '2026-11-22', 13 * 60)).toBe(true)
  })
  it('keeps an open end going to the end of its day', () => {
    expect(slotOver(open, '2026-11-21', 23 * 60 + 59)).toBe(false)
    expect(slotOver(open, '2026-11-22', 0)).toBe(true)
  })
})
