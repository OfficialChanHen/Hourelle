import { beforeAll, describe, expect, it } from 'vitest'
import { webcrypto } from 'node:crypto'
import {
  canDeletePoll, canEditOption, canEditQuestion, decodePoll, encodePoll, encodePollDelete, encodePollEdit, encodePollOption, encodePollSettings,
  isControlMessage, makePoll, messagePreview, placeVotes, pollKey, reducePolls, tapPollOption, DEFAULT_POLL_SETTINGS,
  type PollState,
} from '@/lib/polls'
import type { ChatMessage } from '@/lib/sample'

beforeAll(() => { (globalThis as { crypto?: unknown }).crypto ??= webcrypto })

let at = 1
const line = (id: string, text: string): ChatMessage => ({ id, name: id, time: '', at: at++, text, you: false })
const HOST = new Set(['HOST'])

function posted(by = 'SAM') {
  const poll = makePoll('Which game?', ['Catan', 'Uno'])
  const msgs = [line(by, encodePoll(poll))]
  const state = () => reducePolls(msgs, HOST).get(poll.id)!
  return { poll, msgs, state }
}

describe('a new poll', () => {
  it('starts with adding options off, one vote each, voters shown', () => {
    expect(DEFAULT_POLL_SETTINGS).toEqual({ n: 1, add: false, hide: false })
    expect(posted().state().s.add).toBe(false)
  })
  it('drops repeated options, however they are typed', () => {
    expect(makePoll('Q', ['Uno', ' uno ', 'UNO', 'Catan']).o.map((o) => o.t)).toEqual(['Uno', 'Catan'])
  })
  it('refuses lines that only look like polls', () => {
    expect(decodePoll('[poll]not json')).toBeNull()
    expect(decodePoll('[poll]{"id":"x","q":"Q","o":[{"id":"a","t":"A"}]}')).toBeNull() // one option
    expect(decodePoll('hello')).toBeNull()
  })
})

describe('adding options', () => {
  it('only the host adds while adding is off, the poll’s writer included', () => {
    const { poll, msgs, state } = posted()
    msgs.push(line('ANI', encodePollOption(poll.id, 'x1', 'Chess')))
    msgs.push(line('SAM', encodePollOption(poll.id, 'x2', 'Risk')))
    msgs.push(line('HOST', encodePollOption(poll.id, 'x3', 'Go')))
    expect(state().o.map((o) => o.t)).toEqual(['Catan', 'Uno', 'Go'])
  })
  it('anyone adds once the host allows it, and a repeat is dropped', () => {
    const { poll, msgs, state } = posted()
    msgs.push(line('HOST', encodePollSettings(poll.id, { n: 1, add: true, hide: false })))
    msgs.push(line('ANI', encodePollOption(poll.id, 'x1', 'Chess')))
    msgs.push(line('BO', encodePollOption(poll.id, 'x2', 'chess')))
    expect(state().o.map((o) => `${o.t}:${o.by ?? '-'}`)).toEqual(['Catan:-', 'Uno:-', 'Chess:ANI'])
  })
  it('only the host changes settings, the poll’s writer included', () => {
    const { poll, msgs, state } = posted()
    msgs.push(line('SAM', encodePollSettings(poll.id, { n: 2, add: true, hide: true })))
    expect(state().s).toEqual(DEFAULT_POLL_SETTINGS)
  })
})

describe('rewording', () => {
  it('follows who wrote what, and the host may reword anything', () => {
    const { poll, msgs, state } = posted('SAM')
    msgs.push(line('HOST', encodePollSettings(poll.id, { n: 1, add: true, hide: false })))
    msgs.push(line('ANI', encodePollOption(poll.id, 'x1', 'Chess')))
    msgs.push(line('ANI', encodePollEdit(poll.id, { q: 'Hacked?', o: [{ id: 'a', t: 'Settlers' }, { id: 'x1', t: 'Chess 960' }] })))
    expect(state().q).toBe('Which game?')
    expect(state().o.map((o) => o.t)).toEqual(['Catan', 'Uno', 'Chess 960'])
    msgs.push(line('SAM', encodePollEdit(poll.id, { q: 'Which board game?', o: [{ id: 'b', t: 'Uno!' }] })))
    msgs.push(line('HOST', encodePollEdit(poll.id, { o: [{ id: 'x1', t: 'Chess' }] })))
    expect(state().q).toBe('Which board game?')
    expect(state().o.map((o) => o.t)).toEqual(['Catan', 'Uno!', 'Chess'])
  })
  it('drops a rewording that repeats another option', () => {
    const { poll, msgs, state } = posted()
    msgs.push(line('HOST', encodePollEdit(poll.id, { o: [{ id: 'b', t: 'catan' }] })))
    expect(state().o.map((o) => o.t)).toEqual(['Catan', 'Uno'])
  })
  it('stops at the first vote: the question at the poll’s first, an option at its own', () => {
    const p: PollState = { ...posted('SAM').state() }
    const none = {}
    const onA = { [pollKey(p.id, 'a')]: ['ANI'] }
    expect(canEditQuestion(p, 'SAM', false, none)).toBe(true)
    expect(canEditQuestion(p, 'SAM', false, onA)).toBe(false)
    expect(canEditQuestion(p, 'HOST', true, onA)).toBe(false)
    expect(canEditOption(p, p.o[0], 'HOST', true, onA)).toBe(false)
    expect(canEditOption(p, p.o[1], 'HOST', true, onA)).toBe(true)
    expect(canEditOption(p, p.o[1], 'ANI', false, onA)).toBe(false) // not theirs
  })
})

describe('taking a poll down', () => {
  it('only its writer or the host can', () => {
    const { poll, msgs, state } = posted('SAM')
    msgs.push(line('ANI', encodePollDelete(poll.id)))
    expect(state().removed).toBeUndefined()
    msgs.push(line('SAM', encodePollDelete(poll.id)))
    expect(state().removed).toEqual({ by: 'SAM' })
    expect(canDeletePoll(state(), 'SAM', false)).toBe(true)
    expect(canDeletePoll(state(), 'HOST', true)).toBe(true)
    expect(canDeletePoll(state(), 'ANI', false)).toBe(false)
  })
  it('stays down: nothing sent for it afterwards changes it', () => {
    const { poll, msgs, state } = posted('SAM')
    msgs.push(line('HOST', encodePollDelete(poll.id)))
    msgs.push(line('HOST', encodePollOption(poll.id, 'x1', 'Chess')))
    msgs.push(line('SAM', encodePollEdit(poll.id, { q: 'Back?' })))
    expect(state().removed).toEqual({ by: 'HOST' })
    expect(state().q).toBe('Which game?')
    expect(state().o).toHaveLength(2)
  })
  it('is a control line that previews as what it did', () => {
    const del = line('SAM', encodePollDelete('p'))
    expect(isControlMessage(del)).toBe(true)
    expect(messagePreview(del)).toBe('removed a poll')
  })
})

describe('control lines', () => {
  it('are never shown as chat, and preview as what they did', () => {
    const edit = line('HOST', encodePollEdit('p', { q: 'x' }))
    expect(isControlMessage(edit)).toBe(true)
    expect(messagePreview(edit)).toBe('edited a poll')
    expect(isControlMessage(line('A', 'just text'))).toBe(false)
  })
})

describe('tapPollOption', () => {
  const p = (n: number) => ({ id: 'p1', o: [{ id: 'a', t: 'A' }, { id: 'b', t: 'B' }, { id: 'c', t: 'C' }], s: { n, add: false, hide: false } })
  it('with one vote, a tap moves it', () => {
    let v = tapPollOption({}, p(1), 'ME', 'a')
    v = tapPollOption(v, p(1), 'ME', 'b')
    expect(v).toEqual({ [pollKey('p1', 'b')]: ['ME'] })
  })
  it('a tap on your pick takes it back', () => {
    const v = tapPollOption(tapPollOption({}, p(1), 'ME', 'a'), p(1), 'ME', 'a')
    expect(v).toEqual({})
  })
  it('with two votes, a third tap does nothing until one is taken back', () => {
    let v = tapPollOption({}, p(2), 'ME', 'a')
    v = tapPollOption(v, p(2), 'ME', 'b')
    expect(tapPollOption(v, p(2), 'ME', 'c')).toBe(v)
  })
  it('never touches anyone else, or the place ballot', () => {
    const start = { [pollKey('p1', 'a')]: ['ANI'], P1: ['ME'] }
    const v = tapPollOption(start, p(1), 'ME', 'a')
    expect(v[pollKey('p1', 'a')]).toEqual(['ANI', 'ME'])
    expect(placeVotes(v)).toEqual({ P1: ['ME'] })
  })
})
