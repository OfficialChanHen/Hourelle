import { describe, expect, it } from 'vitest'
import { mergeRemovedIds, mergeRoster, mergeSave } from '@/lib/roster-merge'
import type { AppEvent, Participant } from '@/lib/events'

const HOST = '11111111-1111-4111-8111-111111111111'
const CADEN = '22222222-2222-4222-8222-222222222222'
const person = (id: string, more: Partial<Participant> = {}): Participant =>
  ({ id, initials: 'XX', name: id, color: 'green', rsvp: 'pending', ...more })
const ids = (list: Participant[]) => list.map((p) => p.id)

describe('mergeRoster', () => {
  it('keeps someone who joined from another device since this copy was read', () => {
    // the Sea of Thieves case: the host's copy is from before Caden joined, and the
    // host changes their own entry; Caden must still be on the plan afterwards
    const host = person(HOST, { host: true, rsvp: 'attending' })
    const stale = [host]
    const server = [host, person(CADEN, { joinedAt: 5 })]
    const merged = mergeRoster(server, stale, [{ ...host, color: 'blue' }])
    expect(ids(merged)).toEqual([HOST, CADEN])
    expect(merged[0].color).toBe('blue')
  })

  it('keeps the server version of anyone this save did not touch', () => {
    const before = [person(HOST, { host: true }), person(CADEN)]
    const server = [person(HOST, { host: true }), person(CADEN, { rsvp: 'attending' })]
    const after = [person(HOST, { host: true, name: 'Renamed' }), person(CADEN)]
    const merged = mergeRoster(server, before, after)
    expect(merged.find((p) => p.id === CADEN)?.rsvp).toBe('attending')
    expect(merged.find((p) => p.id === HOST)?.name).toBe('Renamed')
  })

  it('adds the people this save added', () => {
    const before = [person(HOST, { host: true })]
    const after = [...before, person('g:sam', { guest: true })]
    expect(ids(mergeRoster(before, before, after))).toEqual([HOST, 'g:sam'])
  })

  it('takes off only who this save took off', () => {
    const before = [person(HOST, { host: true }), person('g:sam')]
    const server = [...before, person(CADEN)]
    expect(ids(mergeRoster(server, before, [before[0]]))).toEqual([HOST, CADEN])
  })

  it('does not bring back someone another device took off or folded into an account', () => {
    const before = [person(HOST, { host: true }), person('g:caden', { guest: true })]
    const server = [person(HOST, { host: true }), person(CADEN)] // the guest entry was adopted
    expect(ids(mergeRoster(server, before, before))).toEqual([HOST, CADEN])
  })

  it('reads entries as equal whatever their key order', () => {
    const a = { id: CADEN, name: 'C', initials: 'C', color: 'green', rsvp: 'pending' } as Participant
    const b = { rsvp: 'pending', color: 'green', initials: 'C', name: 'C', id: CADEN } as Participant
    const server = [{ ...a, rsvp: 'attending' as const }]
    expect(mergeRoster(server, [a], [b])[0].rsvp).toBe('attending')
  })
})

describe('mergeRemovedIds', () => {
  it('never loses a removal to a stale save', () => {
    expect(mergeRemovedIds(['g:old'], undefined)).toEqual(['g:old'])
    expect(mergeRemovedIds(['g:old'], ['g:new'])).toEqual(['g:old', 'g:new'])
    expect(mergeRemovedIds(undefined, ['g:new'])).toEqual(['g:new'])
  })
})

describe('mergeSave', () => {
  it('lays the save over the server roster and leaves the rest of the document alone', () => {
    const host = person(HOST, { host: true })
    const after = { id: 'x', title: 'Renamed', participants: [host], removedIds: undefined } as unknown as AppEvent
    const out = mergeSave({ participants: [host, person(CADEN)], removedIds: ['g:gone'] }, { participants: [host] }, after)
    expect(out.title).toBe('Renamed')
    expect(ids(out.participants)).toEqual([HOST, CADEN])
    expect(out.removedIds).toEqual(['g:gone'])
  })

  it('sends the save as it is when the server copy has no list', () => {
    const after = { id: 'x', participants: [person(HOST), person(CADEN)] } as unknown as AppEvent
    const server = { participants: null } as unknown as Pick<AppEvent, 'participants'>
    expect(mergeSave(server, { participants: [person(HOST)] }, after)).toBe(after)
  })
})
