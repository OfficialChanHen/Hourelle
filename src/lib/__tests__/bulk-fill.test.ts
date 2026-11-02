import { beforeEach, describe, expect, it } from 'vitest'
import { applyFill, undoFill } from '@/lib/bulk-calendar'
import { getEvent } from '@/lib/events'
import { emptyWeek } from '@/lib/usual-week'
import { plan, saved } from '../../../test/fixtures'

// the fixture: Tue Oct 20 and Wed Oct 21, 9 AM to 3 PM Chicago, H is you
const withNeed = () => plan({ availIv: { '2026-10-20': { H: [{ s: 0, e: 60 }] } }, needIv: { '2026-10-20': { H: [{ s: 120, e: 180 }] } } })

describe('applyFill', () => {
  beforeEach(() => localStorage.clear())

  it('from a calendar, never turns an if-need-be mark into free', () => {
    saved(withNeed())
    const out = applyFill(['plan-1'], [])
    expect(out.ok).toBe(true)
    const ev = getEvent('plan-1')!
    expect(ev.availIv?.['2026-10-20']?.H).toEqual([{ s: 0, e: 120 }, { s: 180, e: 360 }])
    expect(ev.needIv?.['2026-10-20']?.H).toEqual([{ s: 120, e: 180 }])
  })

  it('from the usual week, adds free time, keeps if need be, and Undo puts it back', () => {
    saved(withNeed())
    const week = emptyWeek('America/Chicago')
    week.days[2] = [{ s: 540, e: 900 }] // Tuesdays 9 AM to 3 PM
    const out = applyFill(['plan-1'], { week })
    if (!out.ok) throw new Error('fill failed')
    expect(out.results[0].addedMin).toBe(360 - 60 - 60)
    let ev = getEvent('plan-1')!
    expect(ev.availIv?.['2026-10-20']?.H).toEqual([{ s: 0, e: 120 }, { s: 180, e: 360 }])
    expect(ev.availIv?.['2026-10-21']?.H).toBeUndefined()
    expect(ev.needIv?.['2026-10-20']?.H).toEqual([{ s: 120, e: 180 }])
    undoFill(out.undo)
    ev = getEvent('plan-1')!
    expect(ev.availIv?.['2026-10-20']?.H).toEqual([{ s: 0, e: 60 }])
  })
})
