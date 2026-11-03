import { describe, expect, it } from 'vitest'
import { availIvOf, bestWindow, blockersOf } from '@/lib/events'
import { blockedClause } from '@/lib/answers'
import { person, plan } from '../../../test/fixtures'

const D = '2026-10-20'
const people = [person('H', { host: true, you: true }), person('A'), person('B'), person('C')]
const best = (ev: ReturnType<typeof plan>) => bestWindow(availIvOf(ev), ev.days, 60, 'full', ev.needIv)!

describe('who blocks the best time', () => {
  it('names the people who answered but cannot make the whole best time', () => {
    const ev = plan({
      participants: people,
      availIv: { [D]: { H: [{ s: 0, e: 120 }], A: [{ s: 0, e: 120 }], B: [{ s: 0, e: 120 }], C: [{ s: 180, e: 240 }] } },
    })
    expect(blockersOf(ev, best(ev).ids).map((p) => p.id)).toEqual(['C'])
  })
  it('someone free only if need be over the best time is not blocking', () => {
    const ev = plan({
      participants: people,
      availIv: { [D]: { H: [{ s: 0, e: 120 }], A: [{ s: 0, e: 120 }], B: [{ s: 0, e: 120 }] } },
      needIv: { [D]: { C: [{ s: 0, e: 120 }] } },
    })
    expect(blockersOf(ev, best(ev).ids)).toEqual([])
  })
  it('people who have not answered are waited on, not blocking', () => {
    const ev = plan({
      participants: people,
      availIv: { [D]: { H: [{ s: 0, e: 120 }], A: [{ s: 0, e: 120 }] } },
    })
    expect(blockersOf(ev, best(ev).ids)).toEqual([])
  })
  it('"none of these days work" blocks every time', () => {
    const ev = plan({
      participants: people,
      availIv: { [D]: { H: [{ s: 0, e: 120 }], A: [{ s: 0, e: 120 }] } },
      unavailableIds: ['B'],
    })
    expect(blockersOf(ev, best(ev).ids).map((p) => p.id)).toEqual(['B'])
  })
  it('someone removed from the plan never blocks', () => {
    const ev = plan({
      participants: people.slice(0, 3),
      availIv: { [D]: { H: [{ s: 0, e: 120 }], A: [{ s: 0, e: 120 }], C: [{ s: 180, e: 240 }] } },
    })
    expect(blockersOf(ev, best(ev).ids)).toEqual([])
  })
})

describe('the blocked clause', () => {
  const p = (id: string, you = false) => person(id, { name: `${id}am Lee`, you })
  it('says everyone when nobody who answered is blocking', () => {
    expect(blockedClause([], 3)).toBe('works for everyone so far')
  })
  it('names one or two people by first name, you as you', () => {
    expect(blockedClause([p('S')], 3)).toBe('works for everyone but Sam so far')
    expect(blockedClause([p('S'), p('J', true)], 4)).toBe('works for everyone but Sam and you so far')
  })
  it('falls back to the most people for three or more, or a lone answer', () => {
    expect(blockedClause([p('S'), p('J'), p('K')], 6)).toBe('works for the most people so far')
    expect(blockedClause([], 1)).toBe('works for the most people so far')
  })
  it('falls back when the best time holds nobody but the blockers left out', () => {
    expect(blockedClause([p('S')], 1)).toBe('works for the most people so far')
  })
})

describe('asking a blocker by email', async () => {
  const { askMail, askSlot } = await import('@/lib/server/mail')
  const ev = plan({ participants: people })
  it('keeps only a real stretch on the plan days', () => {
    expect(askSlot(ev, { dayKey: D, startMin: 540, endMin: 600 })).toEqual({ dayKey: D, startMin: 540, endMin: 600 })
    expect(askSlot(ev, { dayKey: '2030-01-01', startMin: 540, endMin: 600 })).toBeNull()
    expect(askSlot(ev, { dayKey: D, startMin: 600, endMin: 540 })).toBeNull()
    expect(askSlot(ev, { dayKey: D, startMin: 0, endMin: 2000 })).toBeNull()
    expect(askSlot(ev, { dayKey: D, startMin: '9 AM', endMin: 600 })).toBeNull()
    expect(askSlot(ev, { dayKey: '2026-10-21', endDayKey: D, startMin: 0, endMin: 1440 })).toBeNull()
    expect(askSlot(ev, 'Fri at 7')).toBeNull()
  })
  it('says the time with its zone and who else is out', () => {
    const one = askMail(ev, people[3], 'c@x.io', 'https://x.io', { dayKey: D, startMin: 540, endMin: 600 }, 0)
    expect(one.subject).toBe('Can you make Board game night on Tue, Oct 20, 9:00 AM – 10:00 AM CDT?')
    expect(one.text).toContain('works for everyone else on Board game night so far')
    const two = askMail(ev, people[3], 'c@x.io', 'https://x.io', { dayKey: D, startMin: 0, endMin: 1440 }, 1)
    expect(two.text).toContain('Tue, Oct 20 works for everyone but you and one other person')
  })
})
