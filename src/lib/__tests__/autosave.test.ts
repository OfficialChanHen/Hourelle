import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAutosave, SAVED_MS, SAVING_MS, SETTLE_MS, type SaveStatus } from '../autosave'
import type { SaveResult } from '../remote'

/* A commit whose database answer the test hands back when it chooses. */
function setup() {
  const answers: ((r: SaveResult) => void)[] = []
  const commit = vi.fn(() => new Promise<SaveResult>((r) => { answers.push(r) }))
  const seen: SaveStatus[] = []
  const auto = createAutosave<string>({ commit, onStatus: (s) => seen.push(s) })
  const last = () => seen[seen.length - 1]
  const answer = (r: SaveResult, i = answers.length - 1) => answers[i](r)
  return { auto, commit, last, answer }
}
const OK: SaveResult = { ok: true }
const NO: SaveResult = { ok: false, message: 'new row violates row-level security policy' }

describe('createAutosave', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('waits for a pause in typing before it saves', async () => {
    const { auto, commit, last } = setup()
    auto.change('Dinn')
    await vi.advanceTimersByTimeAsync(SETTLE_MS - 1)
    auto.change('Dinner')
    await vi.advanceTimersByTimeAsync(SETTLE_MS - 1)
    expect(commit).not.toHaveBeenCalled()
    expect(last()).toBe('idle')
    await vi.advanceTimersByTimeAsync(1)
    expect(commit).toHaveBeenCalledTimes(1)
    expect(commit).toHaveBeenCalledWith('Dinner')
    expect(last()).toBe('saving')
  })

  it('says saved only once the database has answered yes', async () => {
    const { auto, last, answer } = setup()
    auto.change('Dinner')
    auto.flush()
    await vi.advanceTimersByTimeAsync(SAVING_MS * 10)
    expect(last()).toBe('saving') // no answer yet, however long it takes
    answer(OK)
    await vi.advanceTimersByTimeAsync(0)
    expect(last()).toBe('saved')
    await vi.advanceTimersByTimeAsync(SAVED_MS)
    expect(last()).toBe('idle')
  })

  it('holds "Saving" for a moment even when the answer is instant', async () => {
    const { auto, last, answer } = setup()
    auto.change('a')
    auto.flush()
    answer(OK)
    await vi.advanceTimersByTimeAsync(SAVING_MS - 1)
    expect(last()).toBe('saving')
    await vi.advanceTimersByTimeAsync(1)
    expect(last()).toBe('saved')
  })

  it('says not saved when the database refuses, and keeps saying it', async () => {
    const { auto, last, answer } = setup()
    auto.change('a')
    auto.flush()
    answer(NO)
    await vi.advanceTimersByTimeAsync(SAVING_MS)
    expect(last()).toBe('failed')
    await vi.advanceTimersByTimeAsync(SAVED_MS * 10)
    expect(last()).toBe('failed')
  })

  it('says not saved when the commit throws or rejects', async () => {
    const seen: SaveStatus[] = []
    const auto = createAutosave<string>({ commit: () => Promise.reject(new Error('offline')), onStatus: (s) => seen.push(s) })
    auto.change('a'); auto.flush()
    await vi.advanceTimersByTimeAsync(SAVING_MS)
    expect(seen[seen.length - 1]).toBe('failed')
    const thrown: SaveStatus[] = []
    const auto2 = createAutosave<string>({ commit: () => { throw new Error('boom') }, onStatus: (s) => thrown.push(s) })
    auto2.change('a'); auto2.flush()
    await vi.advanceTimersByTimeAsync(SAVING_MS)
    expect(thrown[thrown.length - 1]).toBe('failed')
  })

  it('retry sends the change that did not save', async () => {
    const { auto, commit, last, answer } = setup()
    auto.change('Picnic')
    auto.flush()
    answer(NO)
    await vi.advanceTimersByTimeAsync(SAVING_MS)
    auto.retry()
    expect(commit).toHaveBeenCalledTimes(2)
    expect(commit).toHaveBeenLastCalledWith('Picnic')
    expect(last()).toBe('saving')
    answer(OK)
    await vi.advanceTimersByTimeAsync(SAVING_MS)
    expect(last()).toBe('saved')
  })

  it('an old answer never speaks over newer typing', async () => {
    const { auto, last, answer } = setup()
    auto.change('a')
    auto.flush()
    auto.change('ab') // typing again before the database answered
    answer(NO, 0)
    await vi.advanceTimersByTimeAsync(SAVING_MS)
    expect(last()).toBe('idle')
    await vi.advanceTimersByTimeAsync(SETTLE_MS)
    answer(OK, 1)
    await vi.advanceTimersByTimeAsync(SAVING_MS)
    expect(last()).toBe('saved')
  })

  it('hides the status as soon as typing starts again', async () => {
    const { auto, last, answer } = setup()
    auto.change('a')
    auto.flush()
    answer(OK)
    await vi.advanceTimersByTimeAsync(SAVING_MS)
    expect(last()).toBe('saved')
    auto.change('ab')
    expect(last()).toBe('idle')
    await vi.advanceTimersByTimeAsync(SETTLE_MS - 1) // the old timers must not fire into the new wait
    expect(last()).toBe('idle')
  })

  it('a commit with nothing further to ask counts as saved', async () => {
    const seen: SaveStatus[] = []
    const auto = createAutosave<string>({ commit: () => {}, onStatus: (s) => seen.push(s) })
    auto.change('a'); auto.flush()
    await vi.advanceTimersByTimeAsync(SAVING_MS)
    expect(seen[seen.length - 1]).toBe('saved')
  })

  it('flush writes a waiting change at once, and only once', () => {
    const { auto, commit } = setup()
    auto.change('Picnic')
    auto.flush()
    auto.flush()
    expect(commit).toHaveBeenCalledTimes(1)
  })

  it('cancel drops the waiting change', async () => {
    const { auto, commit, last } = setup()
    auto.change('x')
    auto.cancel()
    await vi.advanceTimersByTimeAsync(SETTLE_MS * 2)
    expect(commit).not.toHaveBeenCalled()
    expect(last()).toBe('idle')
  })

  it('dispose keeps what was typed without touching the status', async () => {
    const { auto, commit, last } = setup()
    auto.change('Brunch')
    auto.dispose()
    expect(commit).toHaveBeenCalledWith('Brunch')
    expect(last()).toBe('idle')
    await vi.advanceTimersByTimeAsync(SETTLE_MS * 2)
    expect(commit).toHaveBeenCalledTimes(1)
  })
})
