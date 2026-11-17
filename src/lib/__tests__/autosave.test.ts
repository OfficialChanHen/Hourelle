import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAutosave, SAVED_MS, SAVING_MS, SETTLE_MS, type SaveStatus } from '../autosave'

function setup() {
  const commit = vi.fn()
  const seen: SaveStatus[] = []
  const auto = createAutosave<string>({ commit, onStatus: (s) => seen.push(s) })
  const last = () => seen[seen.length - 1]
  return { auto, commit, last }
}

describe('createAutosave', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('waits for a pause in typing, then saves, then says saved, then goes quiet', () => {
    const { auto, commit, last } = setup()
    auto.change('Dinn')
    vi.advanceTimersByTime(SETTLE_MS - 1)
    auto.change('Dinner')
    vi.advanceTimersByTime(SETTLE_MS - 1)
    expect(commit).not.toHaveBeenCalled()
    expect(last()).toBe('idle')
    vi.advanceTimersByTime(1)
    expect(commit).toHaveBeenCalledTimes(1)
    expect(commit).toHaveBeenCalledWith('Dinner')
    expect(last()).toBe('saving')
    vi.advanceTimersByTime(SAVING_MS)
    expect(last()).toBe('saved')
    vi.advanceTimersByTime(SAVED_MS)
    expect(last()).toBe('idle')
  })

  it('hides the status as soon as typing starts again', () => {
    const { auto, last } = setup()
    auto.change('a')
    vi.advanceTimersByTime(SETTLE_MS + SAVING_MS)
    expect(last()).toBe('saved')
    auto.change('ab')
    expect(last()).toBe('idle')
    vi.advanceTimersByTime(SETTLE_MS - 1) // the old timers must not fire into the new wait
    expect(last()).toBe('idle')
  })

  it('flush writes a waiting change at once, and only once', () => {
    const { auto, commit, last } = setup()
    auto.change('Picnic')
    auto.flush()
    expect(commit).toHaveBeenCalledWith('Picnic')
    expect(last()).toBe('saving')
    vi.advanceTimersByTime(SETTLE_MS)
    auto.flush()
    expect(commit).toHaveBeenCalledTimes(1)
  })

  it('flush with nothing waiting does nothing', () => {
    const { auto, commit, last } = setup()
    auto.flush()
    expect(commit).not.toHaveBeenCalled()
    expect(last()).toBeUndefined()
  })

  it('cancel drops the waiting change', () => {
    const { auto, commit, last } = setup()
    auto.change('x')
    auto.cancel()
    vi.advanceTimersByTime(SETTLE_MS * 2)
    expect(commit).not.toHaveBeenCalled()
    expect(last()).toBe('idle')
  })

  it('dispose keeps what was typed without touching the status', () => {
    const { auto, commit, last } = setup()
    auto.change('Brunch')
    auto.dispose()
    expect(commit).toHaveBeenCalledWith('Brunch')
    expect(last()).toBe('idle')
    vi.advanceTimersByTime(SETTLE_MS * 2)
    expect(commit).toHaveBeenCalledTimes(1)
  })
})
