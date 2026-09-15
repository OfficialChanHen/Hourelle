'use client'

/* ── the whole-day grid: a calendar, not a timetable ──
   A day poll asks which dates work, so it is drawn the way dates are read: weekday
   columns, one row per week, and the months running on continuously so a stretch of
   days in a row is never cut in half by a month heading. The month is named on the
   cell where it turns, which is the only place the number alone is ambiguous.

   Only the weeks the poll touches are drawn. A date the poll does not ask about is
   left blank rather than given a number nobody can answer: hatched where it sits
   between two days that are on offer (there it is holding them apart), plain where
   it is only squaring off the first or last week.

   A cell is one tap, and holding and sweeping flips every day the pointer crosses,
   once each, on if it was off and off if it was on. A weekday header takes that weekday
   across the whole poll, and the left rail takes a week. The materials are the time
   grid's: the same green ramp, the same clay over it for your own marks, the same
   ochre frame for the winning stretch, the same corner count and capped pile. */

import { useEffect, useMemo, useRef } from 'react'
import { Check } from 'lucide-react'
import { AvatarRow } from '@/components/ui/AvatarRow'
import type { GridDay, Participant } from '@/lib/events'
import { clayFor, DOW7, heat, pileFit, PILE_AV, PILE_FONT, PILE_OVER } from './grid-lib'

const MON3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
// spelled out where the label is read rather than glanced at: a tooltip, a screen reader
const DOW_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const parseKey = (k: string) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d) }
const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// a blank squares the week off ('edge') or sits inside the poll's span ('gap')
type Slot =
  | { kind: 'day'; day: GridDay; num: number; month: string | null }
  | { kind: 'gap' | 'edge'; key: string }
type Week = { key: string; label: string; slots: Slot[]; keys: string[] }

/* the poll's own weeks, Sunday first. Weeks with nothing to answer are dropped, so a
   sparse poll (weekends only, hand-picked dates) stays as short as its answers are. */
export function buildWeeks(days: GridDay[]): Week[] {
  if (!days.length) return []
  const byKey = new Map(days.map((d) => [d.key, d]))
  const first = parseKey(days[0].key)
  const last = parseKey(days[days.length - 1].key)
  if (Number.isNaN(first.getTime()) || Number.isNaN(last.getTime())) return []
  const cur = new Date(first)
  cur.setDate(cur.getDate() - cur.getDay()) // back to the Sunday that opens the first row
  const out: Week[] = []
  let prevMonth = parseKey(days[0].key).getMonth() // marked where the month turns, not on the first day
  while (cur <= last && out.length < 53) {
    const slots: Slot[] = []
    const keys: string[] = []
    let label = ''
    for (let i = 0; i < 7; i++) {
      const key = isoOf(cur)
      const day = byKey.get(key)
      if (day) {
        const month = cur.getMonth() !== prevMonth ? MON3[cur.getMonth()] : null
        prevMonth = cur.getMonth()
        slots.push({ kind: 'day', day, num: cur.getDate(), month })
        keys.push(key)
        if (!label) label = day.date
      } else {
        slots.push({ kind: cur > first && cur < last ? 'gap' : 'edge', key })
      }
      cur.setDate(cur.getDate() + 1)
    }
    if (keys.length) out.push({ key: keys[0], label, slots, keys })
  }
  return out
}

export function DayCalendar({
  days, mode, editable, marked, freeIds, otherIds, total, bestKeys, bestLabel,
  avatarOf, byRoster, narrow, cellW, openKey, onToggleDays, onFlipDay, onDragEnd, onOpenDetail,
}: {
  days: GridDay[]
  mode: 'view' | 'edit'
  editable: boolean
  marked: (key: string) => boolean // this day is in your own answer
  freeIds: Record<string, string[]> // who counts toward the heat, per day
  otherIds: Record<string, string[]> // edit mode: everyone but you, the context tint
  total: number
  bestKeys: Set<string> | null
  bestLabel: string
  avatarOf: (id: string) => { initials: string; name: string; color: Participant['color'] }
  byRoster: (ids: string[]) => string[]
  narrow: boolean
  cellW: number // resolved width of one day column, for sizing the pile
  openKey: string | null // the day whose breakdown popover is open
  onToggleDays: (keys: string[]) => void
  onFlipDay: (key: string) => void // one day, on the spot, without saving yet
  onDragEnd: () => void // the sweep is over: save it
  onOpenDetail: (e: React.MouseEvent, key: string) => void
}) {
  const weeks = useMemo(() => buildWeeks(days), [days])
  const allKeys = useMemo(() => days.map((d) => d.key), [days])
  // the chip naming the winning stretch belongs on its first day, and only there
  const bestFirst = useMemo(() => (bestKeys ? allKeys.find((k) => bestKeys.has(k)) ?? null : null), [bestKeys, allKeys])
  // a weekday column is only offered when the poll actually asks about that weekday
  const dowKeys = useMemo(() => {
    const out: string[][] = [[], [], [], [], [], [], []]
    for (const k of allKeys) out[parseKey(k).getDay()].push(k)
    return out
  }, [allKeys])

  const edit = mode === 'edit' && editable
  const allOn = (keys: string[]) => keys.length > 0 && keys.every(marked)
  // the same pile rule the timetable uses, including its nought on a small screen
  const avatarCap = narrow ? 0 : 4


  /* ── press and sweep ──
     The mouse flips the day it lands on and then every day it crosses. A finger has to
     rest for a beat first, because the same gesture is how the page is scrolled: a quick
     swipe scrolls, a held one paints, and a still tap flips the one day under it. Each
     day flips once per sweep, so wandering back over one does not thrash it. */
  const HOLD_MS = 160
  const SLOP = 8
  const gridRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ visited: Set<string>; painting: boolean; key: string; x: number; y: number; touch: boolean } | null>(null)
  const holdRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cancelHold = () => { if (holdRef.current) { clearTimeout(holdRef.current); holdRef.current = null } }

  // the window listeners are bound once, so they reach the current callbacks through refs
  const flipRef = useRef(onFlipDay)
  const endRef = useRef(onDragEnd)
  useEffect(() => { flipRef.current = onFlipDay; endRef.current = onDragEnd })

  useEffect(() => {
    // the cell under a point, by the key stamped on it — works for a finger, which never
    // fires enter/leave on anything but the element the touch began in
    function keyAt(x: number, y: number) {
      const el = document.elementFromPoint(x, y)
      return el?.closest<HTMLElement>('[data-daykey]')?.dataset.daykey ?? null
    }
    function move(ev: PointerEvent) {
      const d = dragRef.current
      if (!d) return
      if (!d.painting) {
        // still deciding what this gesture is: a finger that wanders is scrolling
        if (d.touch && (Math.abs(ev.clientX - d.x) > SLOP || Math.abs(ev.clientY - d.y) > SLOP)) { cancelHold(); dragRef.current = null }
        return
      }
      const key = keyAt(ev.clientX, ev.clientY)
      if (!key || d.visited.has(key)) return
      d.visited.add(key)
      flipRef.current(key)
    }
    function up(ev: PointerEvent) {
      const d = dragRef.current
      if (!d) return
      cancelHold()
      dragRef.current = null
      // a finger that rested but never painted, and did not wander, is a plain tap
      if (d.touch && !d.painting && Math.abs(ev.clientX - d.x) <= SLOP && Math.abs(ev.clientY - d.y) <= SLOP) flipRef.current(d.key)
      endRef.current()
    }
    function cancel() { cancelHold(); dragRef.current = null; endRef.current() }
    // a painting finger must not also scroll the sheet out from under itself
    function touchMove(ev: TouchEvent) {
      if (dragRef.current?.painting && ev.cancelable) ev.preventDefault()
    }
    const el = gridRef.current
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cancel)
    el?.addEventListener('touchmove', touchMove, { passive: false })
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cancel)
      el?.removeEventListener('touchmove', touchMove)
      cancelHold()
    }
  }, [])

  function onCellDown(e: React.PointerEvent, key: string) {
    if (!edit) return
    const touch = e.pointerType === 'touch'
    dragRef.current = { visited: new Set(), painting: false, key, x: e.clientX, y: e.clientY, touch }
    if (touch) {
      cancelHold()
      holdRef.current = setTimeout(() => {
        holdRef.current = null
        const d = dragRef.current
        if (!d || d.key !== key) return
        d.painting = true
        d.visited.add(key)
        try { navigator.vibrate?.(8) } catch { /* not every phone hums */ }
        flipRef.current(key)
      }, HOLD_MS)
      return
    }
    e.preventDefault()
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    dragRef.current.painting = true
    dragRef.current.visited.add(key)
    onFlipDay(key)
  }

  const boxCls = (on: boolean) =>
    `mx-auto grid h-4 w-4 place-items-center rounded-[5px] border ${on ? 'border-accent bg-accent text-on-accent' : 'border-border2 text-transparent'}`

  return (
    <div
      ref={gridRef}
      className="grid min-w-0"
      style={{ gridTemplateColumns: `${narrow ? 44 : 60}px repeat(7, minmax(0, 1fr))`, ...(edit ? { touchAction: 'pan-y' } : null) }}
      onContextMenu={(e) => { if (edit) e.preventDefault() }} // a held finger must not open the long-press menu
    >
      {/* corner, then the weekday headers — each one a handle on that weekday across
          the whole poll, which is the shortcut the drag used to be */}
      <div className="sticky left-0 top-0 z-[30] border-b border-r border-grid-edge bg-s0" />
      {DOW7.map((l, d) => {
        const keys = dowKeys[d]
        const on = allOn(keys)
        const live = edit && keys.length > 0
        const full = DOW_FULL[d]
        const title = !keys.length
          ? `No ${full}s in this poll`
          : on ? `Turn every ${full} off` : `Mark every ${full}`
        return (
          <button
            key={l}
            type="button"
            disabled={!live}
            onClick={() => onToggleDays(keys)}
            title={live ? title : undefined}
            aria-label={`${full}s`}
            aria-pressed={live ? on : undefined}
            className={`sticky top-0 z-20 border-b border-r border-grid-edge bg-s0 px-1 py-2 text-center ${keys.length ? 'text-dim' : 'text-faint/60'} ${live ? 'hover:bg-s2 hover:text-text' : 'cursor-default'}`}
          >
            <span className="block text-[11px] font-semibold uppercase tracking-[.06em]">
              <span className="sm:hidden">{l[0]}</span><span className="hidden sm:inline">{l}</span>
            </span>
            {live && <span className={`mt-[3px] ${boxCls(on)}`}><Check size={11} /></span>}
          </button>
        )
      })}

      {weeks.map((w, wi) => {
        const rowOn = allOn(w.keys)
        const isDay = (slot: Slot | undefined) => !!slot && slot.kind === 'day'
        return (
          <div key={w.key} className="contents">
            {/* the left rail: the row's first date, and in edit mode the handle on the week */}
            <button
              type="button"
              disabled={!edit}
              onClick={() => onToggleDays(w.keys)}
              title={edit ? (rowOn ? 'Turn this week off' : 'Mark this whole week') : undefined}
              aria-label={`Week of ${w.label}`}
              aria-pressed={edit ? rowOn : undefined}
              className={`sticky left-0 z-[15] flex flex-col items-center justify-center gap-[3px] border-b border-r border-grid-edge bg-s0 px-1 py-1 ${edit ? 'hover:bg-s2' : 'cursor-default'}`}
            >
              {edit && <span className={boxCls(rowOn)}><Check size={11} /></span>}
              {/* the month never drops off the rail: side by side where there is width
                  for it, stacked over the date where there is not */}
              <span className={`flex items-baseline font-medium text-faint ${narrow ? 'flex-col items-center gap-0 text-[9.5px] leading-[1.2]' : 'gap-[3px] text-[11px]'}`}>
                <span>{w.label.split(' ')[0]}</span>
                <span className="tabular-nums">{w.label.split(' ')[1]}</span>
              </span>
            </button>

            {w.slots.map((slot, i) => {
              if (slot.kind !== 'day') {
                return (
                  <div
                    key={slot.key}
                    className="min-h-[52px] border-b border-r sm:min-h-[62px]"
                    style={{
                      background: slot.kind === 'gap'
                        ? 'repeating-linear-gradient(-45deg, var(--s0) 0 5px, var(--s2) 5px 6px)'
                        : 'var(--s0)',
                      // this line is the neighbouring day's own edge when a day is what
                      // it separates, so there it carries the grid's full color
                      borderRightColor: isDay(w.slots[i + 1]) ? 'var(--grid-line)' : 'var(--border)',
                      borderBottomColor: isDay(weeks[wi + 1]?.slots[i]) ? 'var(--grid-line)' : 'var(--border)',
                    }}
                    title={slot.kind === 'gap' ? 'Not one of the days on offer' : undefined}
                  />
                )
              }
              const key = slot.day.key
              const mineOn = marked(key)
              const ids = freeIds[key] ?? []
              const n = ids.length
              const oCount = (otherIds[key] ?? []).length
              const cnt = edit ? oCount + (mineOn ? 1 : 0) : n
              // in edit mode the crowd is context under your own clay, exactly as in the
              // time grid; in view mode the cell is the crowd
              const bg = edit ? heat(oCount, total) : heat(n, total)
              // the winning stretch is one ochre frame across its days: the borders
              // between two days of the same run are dropped so the run reads as a shape
              const inBest = !!bestKeys?.has(key)
              const joined = (j: number) => {
                const s = w.slots[j]
                return !!s && s.kind === 'day' && !!bestKeys?.has(s.day.key)
              }
              const open = openKey === key
              // a cell at full heat is the one dark ground in the grid: everything written
              // on it flips to the cream the count already uses, number and month alike
              const onFull = !(edit && mineOn) && (edit ? oCount : n) >= total && total > 0
              const ink = edit && mineOn ? 'var(--you-text)' : onFull ? 'var(--heat-count-full)' : 'var(--text)'
              // one line per boundary, drawn by the cell above and to the left of it: this
              // cell owns its right and bottom, and the header, the rail or the blank beside
              // it owns the other two. Every one of the four is the full grid color.
              const edges = 'border-b border-r border-grid-line'
              const title = edit
                ? mineOn ? `${slot.day.dow}, ${slot.day.date}: you can make it` : `${slot.day.dow}, ${slot.day.date}: mark that you can make it`
                : `${slot.day.dow}, ${slot.day.date}: ${n} of ${total} free`
              return (
                <button
                  key={key}
                  type="button"
                  data-daykey={key}
                  onPointerDown={(e) => onCellDown(e, key)}
                  onClick={(e) => { if (!edit) onOpenDetail(e, key) }}
                  aria-pressed={edit ? mineOn : undefined}
                  aria-label={title}
                  title={title}
                  className={`relative min-h-[52px] select-none text-left sm:min-h-[62px] ${edges}`}
                  style={{ background: bg, boxShadow: open ? 'inset 0 0 0 1.5px var(--accent)' : undefined }}
                >
                  {/* your own day, clay over the crowd's green — the time grid's own mark */}
                  {edit && mineOn && (
                    <span
                      className="pointer-events-none absolute inset-0"
                      style={{ background: clayFor(oCount), boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.35)', border: '1.5px solid #7A531F' }}
                    />
                  )}
                  {inBest && (
                    <span
                      className="pointer-events-none absolute inset-0 z-[2]"
                      style={{
                        borderTop: '2.5px solid var(--ochre)',
                        borderBottom: '2.5px solid var(--ochre)',
                        borderLeft: joined(i - 1) ? undefined : '2.5px solid var(--ochre)',
                        borderRight: joined(i + 1) ? undefined : '2.5px solid var(--ochre)',
                      }}
                    />
                  )}
                  {/* the same edges redrawn over the fills, so a saturated cell or your own
                      clay can't wash them out — landing exactly on the lines beneath, not beside */}
                  <span className={`pointer-events-none absolute z-[1] ${edges}`} style={{ inset: '0 -1px -1px 0' }} />

                  {/* the date sits at the same height in every cell. The month's name rides
                      above it on the day the month turns, on a line that is held open
                      whether or not it is used — otherwise a first-of-the-month number
                      drops a row and lands on the pile below it. */}
                  <span className="pointer-events-none absolute left-[5px] top-[3px] z-[2] flex flex-col leading-none">
                    <span
                      className="h-[10px] text-[9px] font-semibold uppercase leading-[10px] tracking-[.08em]"
                      style={{ color: onFull || (edit && mineOn) ? ink : 'var(--faint)', opacity: 0.75 }}
                    >
                      {slot.month ?? ''}
                    </span>
                    <span className="text-[13.5px] font-semibold tabular-nums" style={{ color: ink }}>{slot.num}</span>
                  </span>

                  {/* the chip naming the winning stretch rides the top right of its first day */}
                  {key === bestFirst && !narrow && (
                    <span className="absolute right-[4px] top-[4px] z-[2] whitespace-nowrap rounded-[5px] border border-ochre-border bg-ochre-bg px-[5px] py-px text-[9.5px] font-semibold text-ochre-text">
                      {bestLabel}
                    </span>
                  )}

                  {/* the pile stays capped: a hundred-person cell draws a few and a chip */}
                  {!edit && n > 0 && (() => {
                    const { shown, chip } = pileFit(n, avatarCap, cellW, total)
                    if (!shown) return null
                    return (
                      <span className="pointer-events-none absolute bottom-[3px] left-[4px] z-[2]">
                        <AvatarRow
                          people={byRoster(ids).slice(0, shown).map(avatarOf)}
                          size={PILE_AV} overlap={PILE_OVER} font={PILE_FONT} max={shown}
                          more={chip ? `+${chip}` : ''}
                        />
                      </span>
                    )
                  })()}
                  {cnt > 0 && (
                    <span
                      className="pointer-events-none absolute bottom-[3px] right-1 z-[2] text-[9.5px] font-bold"
                      style={{ color: edit && mineOn ? 'var(--you-text)' : onFull ? 'var(--heat-count-full)' : 'var(--heat-count)' }}
                    >
                      {cnt}/{total}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
