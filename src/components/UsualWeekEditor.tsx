'use client'

/* ── my usual week, painted on the profile page ──
   Two views of one week, under a switch. Hours: the plan grid's look and its way of
   painting, on a week with no dates, Monday to Sunday, the whole day in half hours,
   only your own marks. Drag across cells to paint, drag from a marked cell to rub
   out; on a phone a finger that rests for a beat paints and a quick swipe scrolls, as
   on a plan. Whole days: the weekdays you can usually give a whole day to, which is
   all a plan asking for days reads. It saves as you go. Plans fill from it only when
   you ask (see lib/usual-week.ts). */

import { useEffect, useRef, useState } from 'react'
import { Check, Eraser } from 'lucide-react'
import { TimezonePill } from '@/components/ui/TimezonePill'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { localTimeZone } from '@/lib/calendar-import'
import { paintRanges } from '@/lib/availability'
import { prefH24 } from '@/lib/prefs'
import { updateUsualWeek, type Account } from '@/lib/session'
import { emptyWeek, hasHours, hasWholeDays, moveWeekToZone, weekHasTime, type UsualWeek } from '@/lib/usual-week'
import type { Iv } from '@/lib/events'

const COLS = [1, 2, 3, 4, 5, 6, 0] // Monday first; the numbers are Date.getDay()
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DOW_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const START = 0, STEP = 30, ROWS = (24 * 60 - START) / STEP
const HOLD_MS = 160 // touch: rest the finger this long to paint; a quicker swipe scrolls
const SLOP = 8
const SAVE_MS = 600

type View = 'hours' | 'days'
type Pt = { c: number; r: number }
type Drag = { a: Pt; b: Pt; erase: boolean }

const on = (list: Iv[], r: number) => {
  const s = START + r * STEP
  return list.some((iv) => iv.s <= s && iv.e >= s + STEP)
}
const inRect = (d: Drag, c: number, r: number) =>
  c >= Math.min(d.a.c, d.b.c) && c <= Math.max(d.a.c, d.b.c) && r >= Math.min(d.a.r, d.b.r) && r <= Math.max(d.a.r, d.b.r)

function clock(min: number, h24: boolean) {
  const h = Math.floor(min / 60) % 24, m = String(min % 60).padStart(2, '0')
  if (h24) return `${String(h).padStart(2, '0')}:${m}`
  return `${h % 12 === 0 ? 12 : h % 12}${m === '00' ? '' : `:${m}`} ${h < 12 ? 'AM' : 'PM'}`
}

// the rail's label: "12:30" or "7:00" beside a small AM or PM, or "19:30" on a 24-hour clock
function clockMain(min: number, h24: boolean) {
  const h = Math.floor(min / 60) % 24, m = String(min % 60).padStart(2, '0')
  return h24 ? `${String(h).padStart(2, '0')}:${m}` : `${h % 12 === 0 ? 12 : h % 12}:${m}`
}

export function UsualWeekEditor({ account }: { account: Account }) {
  const h24 = prefH24()
  const [week, setWeek] = useState<UsualWeek>(() => account.usualWeek ?? emptyWeek(localTimeZone()))
  const [drag, setDrag] = useState<Drag | null>(null)
  const dragRef = useRef<Drag | null>(null)
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [cleared, setCleared] = useState<UsualWeek | null>(null)
  // a plan asking for days links here with #usual-days; otherwise the view that has
  // something in it, hours first
  const [view, setView] = useState<View>(() => {
    const w = account.usualWeek
    return hasWholeDays(w) && !hasHours(w) ? 'days' : 'hours'
  })
  // a link can set the address after this first draws, so it is read here and on change
  useEffect(() => {
    const read = () => { if (window.location.hash === '#usual-days') setView('days') }
    read()
    window.addEventListener('hashchange', read)
    return () => window.removeEventListener('hashchange', read)
  }, [])
  const grid = useRef<HTMLDivElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
  // opens on the earliest time you marked, an hour above it; an empty week on 5 PM,
  // since most usual free time is in the evening
  const placed = useRef(false)
  useEffect(() => {
    const el = scroller.current
    // placed again when the stored week arrives late, until you first paint
    if (!el || placed.current) return
    const firsts = week.days.flatMap((d) => d.slice(0, 1).map((iv) => iv.s))
    const at = firsts.length ? Math.max(START, Math.min(...firsts) - 60) : 17 * 60
    const row = grid.current?.querySelector<HTMLElement>(`[data-uw="0:${Math.round((at - START) / STEP)}"]`)
    const head = grid.current?.querySelector<HTMLElement>('[role="columnheader"]')
    if (row) el.scrollTop = row.offsetTop - (head?.offsetHeight ?? 0)
  }, [week, view])
  const hold = useRef<{ timer: ReturnType<typeof setTimeout> | null; pt: Pt; x: number; y: number } | null>(null)

  // saves a beat after the last change, and only a real change
  const stored = useRef(JSON.stringify(account.usualWeek ?? null))
  useEffect(() => {
    const next = weekHasTime(week) ? week : null
    if (JSON.stringify(next) === stored.current) return
    const t = setTimeout(async () => {
      const e = await updateUsualWeek(next)
      setErr(e)
      if (!e) { stored.current = JSON.stringify(next); setSaved(true) }
    }, SAVE_MS)
    return () => clearTimeout(t)
  }, [week])
  // the stored week can arrive after the first render (the account is read from this
  // browser, or from a log-in, a moment after the page draws) or change in another
  // tab; take it whenever it differs from what was last saved here
  const incoming = JSON.stringify(account.usualWeek ?? null)
  useEffect(() => {
    if (incoming === stored.current) return
    stored.current = incoming
    setWeek(account.usualWeek ?? emptyWeek(localTimeZone()))
  }, [incoming]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!saved) return
    const t = setTimeout(() => setSaved(false), 1600)
    return () => clearTimeout(t)
  }, [saved])
  useEffect(() => {
    if (!cleared) return
    const t = setTimeout(() => setCleared(null), 6000)
    return () => clearTimeout(t)
  }, [cleared])

  function paint(cells: { wd: number; r0: number; r1: number }[], erase: boolean) {
    placed.current = true
    setWeek((w) => {
      const free = Object.fromEntries(w.days.map((d, i) => [String(i), d]))
      const ranges = cells.map(({ wd, r0, r1 }) => ({ day: String(wd), s: START + r0 * STEP, e: START + (r1 + 1) * STEP }))
      const out = paintRanges(free, {}, ranges, erase ? 'erase' : 'free').free
      return { ...w, days: w.days.map((_, i) => out[String(i)] ?? []) }
    })
  }
  function commit(d: Drag) {
    const c0 = Math.min(d.a.c, d.b.c), c1 = Math.max(d.a.c, d.b.c)
    const r0 = Math.min(d.a.r, d.b.r), r1 = Math.max(d.a.r, d.b.r)
    paint(COLS.slice(c0, c1 + 1).map((wd) => ({ wd, r0, r1 })), d.erase)
  }
  function begin(pt: Pt) {
    const d = { a: pt, b: pt, erase: on(week.days[COLS[pt.c]], pt.r) }
    dragRef.current = d; setDrag(d)
  }

  // the drag is followed on the window, and which cell is under the pointer is asked
  // of the page, so a drag that leaves the grid or scrolls it never paints the wrong row
  useEffect(() => {
    if (!drag) return
    const move = (e: PointerEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-uw]')
      const d = dragRef.current
      if (!el || !d) return
      const [c, r] = el.dataset.uw!.split(':').map(Number)
      if (c === d.b.c && r === d.b.r) return
      const next = { ...d, b: { c, r } }
      dragRef.current = next; setDrag(next)
    }
    const up = () => {
      const d = dragRef.current
      dragRef.current = null; setDrag(null)
      if (d) commit(d)
    }
    // once a finger is painting, the page must not scroll under it
    const stop = (e: TouchEvent) => { if (dragRef.current) e.preventDefault() }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    window.addEventListener('touchmove', stop, { passive: false })
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      window.removeEventListener('touchmove', stop)
    }
  }, [!!drag]) // eslint-disable-line react-hooks/exhaustive-deps

  function cancelHold() {
    if (hold.current?.timer) clearTimeout(hold.current.timer)
    hold.current = null
  }
  function onDown(e: React.PointerEvent, pt: Pt) {
    if (e.pointerType === 'touch') {
      cancelHold()
      const h: NonNullable<typeof hold.current> = { timer: null, pt, x: e.clientX, y: e.clientY }
      h.timer = setTimeout(() => {
        if (hold.current !== h) return
        h.timer = null
        try { navigator.vibrate?.(8) } catch { /* not every phone hums */ }
        begin(pt)
      }, HOLD_MS)
      hold.current = h
      return
    }
    e.preventDefault()
    begin(pt)
  }
  function onMove(e: React.PointerEvent) {
    const h = hold.current
    if (h?.timer && (Math.abs(e.clientX - h.x) > SLOP || Math.abs(e.clientY - h.y) > SLOP)) cancelHold() // a swipe: let it scroll
  }
  function onUp(e: React.PointerEvent) {
    const h = hold.current
    if (e.pointerType !== 'touch' || !h) return
    // a quick, still tap turns the one cell over
    if (h.timer) paint([{ wd: COLS[h.pt.c], r0: h.pt.r, r1: h.pt.r }], on(week.days[COLS[h.pt.c]], h.pt.r))
    cancelHold()
  }
  function toggleDay(wd: number) {
    const full = Array.from({ length: ROWS }, (_, r) => r).every((r) => on(week.days[wd], r))
    paint([{ wd, r0: 0, r1: ROWS - 1 }], full)
  }
  function toggleWhole(wd: number) {
    setWeek((w) => ({ ...w, wholeDays: w.wholeDays.map((v, i) => (i === wd ? !v : v)) }))
  }
  // clears the view on screen; Undo puts the whole week back as it was
  function clear() {
    setCleared(week)
    setWeek((w) => (view === 'hours' ? { ...w, days: emptyWeek(w.tz).days } : { ...w, wholeDays: emptyWeek(w.tz).wholeDays }))
  }
  function switchTo(v: View) {
    // the hours grid opens again on your earliest time
    if (v === 'hours') placed.current = false
    setView(v)
  }

  const here = localTimeZone()
  const moved = view === 'hours' && here !== week.tz && hasHours(week)
  const anyHere = view === 'hours' ? hasHours(week) : hasWholeDays(week)

  return (
    <div className="rounded-2xl border border-border bg-s1 p-5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <SegmentedControl
          label="Show"
          value={view}
          onChange={(v) => switchTo(v as View)}
          options={[{ v: 'hours', l: 'Hours' }, { v: 'days', l: 'Whole days' }]}
        />
        <div className="flex items-center gap-3">
          {saved && <span className="flex items-center gap-1 text-[12px] font-medium text-teal-text" role="status"><Check size={13} /> Saved</span>}
          {view === 'hours' && <span className="flex items-center gap-1.5 text-[12.5px] text-dim">Times in <TimezonePill tz={week.tz} /></span>}
        </div>
      </div>
      <p className="mt-3 text-[13.5px] leading-[1.5] text-dim">
        {view === 'hours'
          ? 'Paint the times you are usually free. Plans that ask for times fill from these.'
          : 'Pick the days you can usually give a whole day to. Plans that ask for days fill from these only.'}
      </p>
      {moved && (
        <p className="mt-2.5 text-[12.5px] text-dim">
          Your week is in {week.tz.split('/').pop()!.replace(/_/g, ' ')} time.{' '}
          <button type="button" onClick={() => setWeek((w) => moveWeekToZone(w, here))} className="font-semibold text-accent-text underline underline-offset-2">
            Use {here.split('/').pop()!.replace(/_/g, ' ')} time
          </button>
        </p>
      )}

      {view === 'hours' ? (
      <div ref={scroller} className="scroll-slim relative mt-4 max-h-[440px] overflow-y-auto rounded-xl border border-grid-edge" style={{ overscrollBehavior: 'contain' }}>
        <div
          ref={grid}
          role="grid"
          aria-label="My usual week"
          className="grid select-none"
          style={{ gridTemplateColumns: '52px repeat(7, minmax(0, 1fr))', WebkitTouchCallout: 'none' }}
          onContextMenu={(e) => e.preventDefault()}
        >
          <div className="sticky left-0 top-0 z-20 border-b border-r border-grid-edge bg-s0" />
          {COLS.map((wd, c) => {
            const weekend = wd === 0 || wd === 6
            return (
              <button
                key={wd}
                type="button"
                onClick={() => toggleDay(wd)}
                role="columnheader"
                aria-label={`Fill or clear ${DOW_LONG[wd]}`}
                title="Click to fill the whole day"
                className={`sticky top-0 z-10 border-b border-grid-edge bg-s0 py-2 text-center text-[12px] font-semibold ${c < 6 ? 'border-r' : ''} ${weekend ? 'text-faint' : 'text-text'}`}
              >
                <span className="sm:hidden">{DOW[wd][0]}</span><span className="hidden sm:inline">{DOW[wd]}</span>
              </button>
            )
          })}
          {Array.from({ length: ROWS }, (_, r) => {
            const min = START + r * STEP
            const hour = min % 60 === 0
            const line = hour ? 'border-grid-line/50' : 'border-grid-line/20'
            return (
              <div key={r} role="row" className="contents">
                {/* the rail reads like a day calendar's: each time sits ON the line that
                    opens its row, with a tick either side, so the day's two ends, 12 AM
                    at the top and at the bottom, are the two lines it never names */}
                <div className={`sticky left-0 z-[5] h-6 border-b border-r border-grid-edge bg-s0 font-medium leading-none ${line}`}>
                  {r > 0 && (
                    <span className="pointer-events-none absolute inset-x-0 top-[-0.5px] flex -translate-y-1/2 items-center gap-[3px]">
                      <span className="h-px w-[3px] flex-none bg-grid-edge" />
                      <span className={`flex items-baseline gap-[2px] whitespace-nowrap ${hour ? 'text-[11px] text-dim' : 'text-[10.5px] text-faint'}`}>
                        <span>{clockMain(min, h24)}</span>
                        {!h24 && <span className="text-[8.5px] font-semibold tracking-[.04em] text-faint">{min < 720 ? 'AM' : 'PM'}</span>}
                      </span>
                      <span className="h-px flex-1 bg-grid-edge" />
                    </span>
                  )}
                </div>
                {COLS.map((wd, c) => {
                  const list = week.days[wd]
                  const shown = (rr: number) => (drag && inRect(drag, c, rr) ? !drag.erase : on(list, rr))
                  const mark = shown(r)
                  const you = 'var(--you-text)'
                  const edges = mark ? [
                    `inset 1.5px 0 0 ${you}`, `inset -1.5px 0 0 ${you}`,
                    ...(r === 0 || !shown(r - 1) ? [`inset 0 1.5px 0 ${you}`] : []),
                    ...(r === ROWS - 1 || !shown(r + 1) ? [`inset 0 -1.5px 0 ${you}`] : []),
                  ].join(', ') : undefined
                  return (
                    <button
                      key={wd}
                      type="button"
                      role="gridcell"
                      data-uw={`${c}:${r}`}
                      aria-selected={mark}
                      aria-label={`${DOW_LONG[wd]} ${clock(min, h24)}`}
                      tabIndex={r === 0 && c === 0 ? 0 : -1}
                      onPointerDown={(e) => onDown(e, { c, r })}
                      onPointerMove={onMove}
                      onPointerUp={onUp}
                      // the keyboard's Enter and Space; a mouse or a finger has already painted
                      onClick={(e) => { if (e.detail === 0) paint([{ wd, r0: r, r1: r }], on(list, r)) }}
                      onKeyDown={(e) => {
                        const to = e.key === 'ArrowDown' ? [c, r + 1] : e.key === 'ArrowUp' ? [c, r - 1] : e.key === 'ArrowRight' ? [c + 1, r] : e.key === 'ArrowLeft' ? [c - 1, r] : null
                        if (!to) return
                        e.preventDefault()
                        grid.current?.querySelector<HTMLElement>(`[data-uw="${to[0]}:${to[1]}"]`)?.focus()
                      }}
                      className={`h-6 border-b focus-visible:-outline-offset-2 ${line} ${c < 6 ? 'border-r border-r-grid-line/20' : ''}`}
                      style={{
                        background: mark ? 'linear-gradient(var(--you-some), var(--you-some)), var(--s1)' : 'var(--s2)',
                        boxShadow: edges,
                      }}
                    />
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
      ) : (
        <div className="mt-4 grid grid-cols-7 overflow-hidden rounded-xl border border-grid-edge" role="group" aria-label="Whole days">
          {COLS.map((wd, c) => {
            const mark = week.wholeDays[wd]
            const weekend = wd === 0 || wd === 6
            return (
              <button
                key={wd}
                type="button"
                onClick={() => toggleWhole(wd)}
                aria-pressed={mark}
                aria-label={DOW_LONG[wd]}
                className={`flex h-24 flex-col items-center justify-between py-2.5 focus-visible:-outline-offset-2 sm:h-28 ${c < 6 ? 'border-r border-grid-edge' : ''}`}
                style={{
                  background: mark ? 'linear-gradient(var(--you-some), var(--you-some)), var(--s1)' : 'var(--s2)',
                  boxShadow: mark ? 'inset 0 0 0 1.5px var(--you-text)' : undefined,
                }}
              >
                <span className={`text-[12px] font-semibold ${weekend && !mark ? 'text-faint' : 'text-text'}`}>
                  <span className="sm:hidden">{DOW[wd][0]}</span><span className="hidden sm:inline">{DOW[wd]}</span>
                </span>
                <span className={`grid h-5 w-5 place-items-center rounded-[6px] border ${mark ? 'border-accent bg-accent text-on-accent' : 'border-border2 text-transparent'}`}>
                  <Check size={13} />
                </span>
              </button>
            )
          })}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        {anyHere && (
          <button type="button" onClick={clear} className="flex h-11 items-center gap-1.5 rounded-full border border-border2 bg-s1 px-3.5 text-[13px] font-semibold text-dim hover:bg-s2 hover:text-text sm:h-9">
            <Eraser size={14} /> Clear
          </button>
        )}
        {cleared && (
          <span className="text-[12.5px] text-dim" role="status">
            Cleared.{' '}
            <button type="button" onClick={() => { setWeek(cleared); setCleared(null) }} className="font-semibold text-accent-text underline underline-offset-2">Undo</button>
          </span>
        )}
        {err && <p role="alert" className="text-[12.5px] font-medium text-brick-text">{err}</p>}
      </div>
    </div>
  )
}
