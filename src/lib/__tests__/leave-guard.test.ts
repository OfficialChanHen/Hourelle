import { afterEach, describe, expect, it, vi } from 'vitest'
import { confirmLeave, discardAll, hasUnsaved, holdDraft, leavesPage, onAsk, watchDrafts, type LeaveAnswer } from '@/lib/leave-guard'

// answers the next question with `a`, as the dialog would
const answerWith = (a: LeaveAnswer) => onAsk((done) => done(a))

afterEach(() => { discardAll() })

describe('confirmLeave', () => {
  it('lets you go without asking when nothing is unsaved', async () => {
    const ask = vi.fn()
    const off = onAsk(ask)
    expect(await confirmLeave()).toBe(true)
    expect(ask).not.toHaveBeenCalled()
    off()
  })

  it('Save keeps every draft and lets you go', async () => {
    const a = vi.fn(), b = vi.fn(async () => true)
    holdDraft({ save: a }); holdDraft({ save: b })
    const off = answerWith('save')
    expect(await confirmLeave()).toBe(true)
    expect(a).toHaveBeenCalledOnce()
    expect(b).toHaveBeenCalledOnce()
    expect(hasUnsaved()).toBe(false)
    off()
  })

  it('a draft that cannot be saved keeps you on the page', async () => {
    holdDraft({ save: () => false })
    const off = answerWith('save')
    expect(await confirmLeave()).toBe(false)
    expect(hasUnsaved()).toBe(true)
    off()
  })

  it("Don't save drops every draft and lets you go", async () => {
    const save = vi.fn(), discard = vi.fn()
    holdDraft({ save, discard })
    const off = answerWith('discard')
    expect(await confirmLeave()).toBe(true)
    expect(save).not.toHaveBeenCalled()
    expect(discard).toHaveBeenCalledOnce()
    expect(hasUnsaved()).toBe(false)
    off()
  })

  it('staying keeps the draft as it is', async () => {
    const save = vi.fn(), discard = vi.fn()
    holdDraft({ save, discard })
    const off = answerWith('stay')
    expect(await confirmLeave()).toBe(false)
    expect(save).not.toHaveBeenCalled()
    expect(discard).not.toHaveBeenCalled()
    expect(hasUnsaved()).toBe(true)
    off()
  })

  it('two ways out at once share one question', async () => {
    holdDraft({ save: () => true })
    let done: ((a: LeaveAnswer) => void) | null = null
    const ask = vi.fn((d: (a: LeaveAnswer) => void) => { done = d })
    const off = onAsk(ask)
    const p1 = confirmLeave(), p2 = confirmLeave()
    expect(ask).toHaveBeenCalledOnce()
    done!('discard')
    expect(await p1).toBe(true)
    expect(await p2).toBe(true)
    off()
  })

  it('a released draft is no longer asked about, and watchers hear each change', async () => {
    const seen = vi.fn()
    const unwatch = watchDrafts(seen)
    const release = holdDraft({ save: () => true })
    release()
    expect(seen).toHaveBeenCalledTimes(2)
    expect(hasUnsaved()).toBe(false)
    unwatch()
  })
})

describe('leavesPage', () => {
  const here = 'https://hourelle.app/events/abc?tab=availability'
  it('another page or another query leaves', () => {
    expect(leavesPage('/home', here)).toBe(true)
    expect(leavesPage('/events/abc?tab=details', here)).toBe(true)
  })
  it('a jump within the page, a new tab, a download or another site does not', () => {
    expect(leavesPage('#grid', here)).toBe(false)
    expect(leavesPage('/home', here, { target: '_blank' })).toBe(false)
    expect(leavesPage('/home', here, { modified: true })).toBe(false)
    expect(leavesPage('/file.ics', here, { download: true })).toBe(false)
    expect(leavesPage('https://example.com/', here)).toBe(false)
    expect(leavesPage('mailto:a@b.co', here)).toBe(false)
  })
})
