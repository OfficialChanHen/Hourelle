import { describe, expect, it, vi } from 'vitest'
import { canBeCohost, canManage, isCohost, managesEvent, setCohostPatch } from '@/lib/cohosts'
import { createEvent, draftFromEvent, type CreateInput, type Participant } from '@/lib/events'

const HOST = '11111111-1111-4111-8111-111111111111'
const ANA = '22222222-2222-4222-8222-222222222222'
const person = (id: string, more: Partial<Participant> = {}): Participant =>
  ({ id, initials: 'XX', name: id, color: 'green', rsvp: 'pending', ...more })

const plan = (participants: Participant[], more = {}) => ({ hostedByYou: false, participants, ...more })

describe('isCohost', () => {
  it('is the flag, and never the host', () => {
    expect(isCohost(person(ANA, { cohost: true }))).toBe(true)
    expect(isCohost(person(ANA))).toBe(false)
    expect(isCohost(person(HOST, { host: true, cohost: true }))).toBe(false)
  })
})

describe('canBeCohost', () => {
  const ev = plan([person(HOST, { host: true }), person(ANA), person('g:sam', { guest: true })])
  it('takes an account on a plan an account owns', () => {
    expect(canBeCohost(ev, ev.participants[1])).toBe(true)
  })
  it('never takes a guest, the host, or anyone on an ownerless plan', () => {
    expect(canBeCohost(ev, ev.participants[2])).toBe(false)
    expect(canBeCohost(ev, ev.participants[0])).toBe(false)
    const ownerless = plan([person('me', { host: true }), person(ANA)])
    expect(canBeCohost(ownerless, ownerless.participants[1])).toBe(false)
  })
})

describe('canManage', () => {
  it('is the host', () => {
    expect(canManage(plan([person(HOST, { host: true, you: true })], { hostedByYou: true }))).toBe(true)
  })
  it('is a co-host looking at their own entry', () => {
    expect(canManage(plan([person(HOST, { host: true }), person(ANA, { you: true, cohost: true })]))).toBe(true)
  })
  it('is not someone else while a co-host exists', () => {
    expect(canManage(plan([person(HOST, { host: true }), person(ANA, { cohost: true }), person('g:sam', { you: true })]))).toBe(false)
  })
  it('is nobody on a demo', () => {
    expect(canManage(plan([person(ANA, { you: true, cohost: true })], { hostedByYou: true, demo: true }))).toBe(false)
  })
})

describe('managesEvent', () => {
  const ev = plan([person(HOST, { host: true }), person(ANA, { cohost: true }), person('33333333-3333-4333-8333-333333333333')])
  it('lets the host column and co-hosts through, nobody else', () => {
    expect(managesEvent(ev, HOST, HOST)).toBe(true)
    expect(managesEvent(ev, HOST, ANA)).toBe(true)
    expect(managesEvent(ev, HOST, '33333333-3333-4333-8333-333333333333')).toBe(false)
    expect(managesEvent(ev, null, HOST)).toBe(false)
  })
})

describe('setCohostPatch', () => {
  it('sets and clears the flag on one person only', () => {
    const ev = plan([person(HOST, { host: true }), person(ANA)])
    const on = setCohostPatch(ev, ANA, true)
    expect(on.participants.map((p) => !!p.cohost)).toEqual([false, true])
    const off = setCohostPatch(on, ANA, false)
    expect(off.participants[1].cohost).toBeUndefined()
  })
})

describe('co-hosts chosen in the create wizard', () => {
  const BO = '33333333-3333-4333-8333-333333333333'
  const input = (accounts: CreateInput['accounts']): CreateInput => ({
    title: 'Board games', description: '', startDate: '2026-12-01', endDate: '2026-12-03', granularity: '30', timezone: 'America/Chicago',
    budget: '', locMode: 'later', planMode: 'vote', picked: [], platform: '', meetingLink: '', emails: [], accounts,
  } as CreateInput)
  const signIn = (id: string) => localStorage.setItem('hourelle.account', JSON.stringify({ id, name: 'Hana Host', color: 'green', kind: 'person', signedIn: true }))

  it('starts the plan with them as co-hosts, and nobody else', () => {
    signIn(HOST)
    const ev = createEvent(input([{ id: ANA, name: 'Ana', color: 'pink', cohost: true }, { id: BO, name: 'Bo', color: 'blue' }]))
    expect(ev.participants.filter(isCohost).map((p) => p.id)).toEqual([ANA])
  })
  it('keeps them as co-hosts when the plan is duplicated', () => {
    signIn(HOST)
    const ev = createEvent(input([{ id: ANA, name: 'Ana', color: 'pink', cohost: true }, { id: BO, name: 'Bo', color: 'blue' }]))
    const draft = draftFromEvent(ev.id)!
    expect(draft.accounts!.map((a) => [a.id, !!a.cohost])).toEqual([[ANA, true], [BO, false]])
  })
  it('makes no co-host on a plan with no account behind it', async () => {
    // the account is cached per module, so a fresh copy reads the stub host
    vi.resetModules()
    signIn('stub')
    const fresh = await import('@/lib/events')
    const ev = fresh.createEvent(input([{ id: ANA, name: 'Ana', color: 'pink', cohost: true }]))
    expect(ev.participants.some(isCohost)).toBe(false)
  })
})
