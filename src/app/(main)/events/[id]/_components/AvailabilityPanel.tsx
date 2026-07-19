'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, ChevronDown, CalendarPlus, X, GripHorizontal, Check, Eraser, Bell, SlidersHorizontal, Minus, Plus, Search, Trash2 } from 'lucide-react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { Avatar } from '@/components/ui/Avatar'
import { AvatarRow } from '@/components/ui/AvatarRow'
import { TimezonePill, tzAbbr } from '@/components/ui/TimezonePill'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Popover } from '@/components/ui/Popover'
import {
  patchEvent, availIvOf, intervalsToGrid, normalizeIv, bestWindow, fmtMinute, gridStartMinOf, stepOf, dayLabel, type BestMode,
  type AppEvent, type Participant, type Iv, type AvailIntervals, type GridDay,
} from '@/lib/events'
import { buildImportPreview, mockBusyUtc, ISO_DAY, localZoneShiftMin, localTimeZone, type DayImport } from '@/lib/calendar-import'

type Mode = 'view' | 'edit'
type Edge = 'top' | 'bottom'
type Sel = { day: string; s: number; e: number; edge: Edge }
type Band = { s: number; e: number; ids: string[] } // constant-crowd segment inside one cell

type Drag =
  | { kind: 'paint'; day: string; anchorClientY: number; anchorScrollTop: number; anchorMin: number; block: Iv | null }
  | {
      kind: 'resize'; day: string; edge: Edge; fixedMin: number
      anchorClientY: number; anchorScrollTop: number; anchorMin: number; origS: number; origE: number
      block: Iv | null; del: boolean
    }

const CELL = 50 // px per grid row — must match the h-[50px] cell height below
const MIN_LEN = 5 // smallest block, in minutes
const AVATAR_CAP = 6 // most avatars drawn in one grid cell before collapsing to "+N"
const OVERSCAN = 6 // rows rendered beyond the viewport each side, so scrolling doesn't flash blank

function heat(n: number, total: number) {
  if (n === 0) return 'var(--s2)'
  const r = n / Math.max(total, 1)
  return r <= 0.25 ? 'var(--heat-low)' : r <= 0.5 ? 'var(--heat-mid)' : r < 1 ? 'var(--heat-high)' : 'var(--heat-full)'
}
function clayFor(n: number) {
  return n <= 2 ? 'var(--you-only)' : n <= 4 ? 'var(--you-some)' : 'var(--you-many)'
}
function subtract(iv: Iv, a: number, b: number): Iv[] {
  return [{ s: iv.s, e: Math.min(iv.e, a) }, { s: Math.max(iv.s, b), e: iv.e }].filter((x) => x.e > x.s)
}
// split a cell window at every point the crowd changes
function cellBands(byPid: Record<string, Iv[]>, w0: number, w1: number): Band[] {
  const cuts = new Set([w0, w1])
  for (const ivs of Object.values(byPid)) for (const iv of ivs) {
    if (iv.s > w0 && iv.s < w1) cuts.add(iv.s)
    if (iv.e > w0 && iv.e < w1) cuts.add(iv.e)
  }
  const xs = [...cuts].sort((a, b) => a - b)
  const out: Band[] = []
  for (let i = 0; i < xs.length - 1; i++) {
    const s = xs[i], e = xs[i + 1]
    out.push({ s, e, ids: Object.keys(byPid).filter((id) => byPid[id].some((iv) => iv.s <= s && iv.e >= e)) })
  }
  return out
}
// absorb slivers too thin to read into their taller neighbor (paint only — tooltips stay exact).
// `keep` boundaries are never merged across, so the heat edge stays put where a frame is drawn.
function mergeSlivers(bands: Band[], minDur: number, keep?: number[]): Band[] {
  const locked = new Set(keep ?? [])
  const out = bands.map((b) => ({ ...b }))
  let again = true
  while (again && out.length > 1) {
    again = false
    for (let i = 0; i < out.length; i++) {
      if (out[i].e - out[i].s >= minDur) continue
      const prev = locked.has(out[i].s) ? undefined : out[i - 1]
      const next = locked.has(out[i].e) ? undefined : out[i + 1]
      const into = !prev ? next : !next ? prev : (prev.e - prev.s >= next.e - next.s ? prev : next)
      if (into) { into.s = Math.min(into.s, out[i].s); into.e = Math.max(into.e, out[i].e); out.splice(i, 1); again = true; break }
    }
  }
  return out
}
function peakOf(bands: Band[]): Band {
  return bands.reduce((m, b) => (b.ids.length > m.ids.length ? b : m))
}

// a grid day, possibly a filler outside the event's date window (rendered greyed out, inert)
type GDay = GridDay & { pad?: boolean }
const DOW7 = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
// events spanning more than one calendar week pad out to full Sun–Sat weeks, so
// weekday columns line up across pages and the grid width never shifts between
// them. Events that fit inside one calendar week stay compact — no dead columns.
function padToWeeks(days: GridDay[]): GDay[] {
  if (days.length < 2 || !ISO_DAY.test(days[0].key) || !ISO_DAY.test(days[days.length - 1].key)) return days
  const parse = (k: string) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d) }
  const sundayOf = (d: Date) => { const x = new Date(d); x.setDate(x.getDate() - x.getDay()); return x }
  const first = sundayOf(parse(days[0].key))
  const lastSunday = sundayOf(parse(days[days.length - 1].key))
  if (first.getTime() === lastSunday.getTime()) return days // fits one calendar week — compact
  const byKey = new Map<string, GridDay>(days.map((d) => [d.key, d]))
  const out: GDay[] = []
  const cur = new Date(first)
  const end = new Date(lastSunday); end.setDate(end.getDate() + 6)
  while (cur <= end && out.length < 6 * 7) { // events cap at 21 days, so ≤5 weeks in practice
    const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`
    out.push(byKey.get(key) ?? { key, dow: DOW7[cur.getDay()], date: dayLabel(cur), pad: true })
    cur.setDate(cur.getDate() + 1)
  }
  return out
}

export function AvailabilityPanel({ event, locked = false, initialFilter = null, focusBest = 0 }: { event: AppEvent; locked?: boolean; initialFilter?: string | null; focusBest?: number }) {
  const total = event.participants.length
  const pById = new Map(event.participants.map((p) => [p.id, p]))
  const avatarOf = (id: string) => {
    const p = pById.get(id)
    return { initials: p?.initials ?? id, name: p?.name ?? id, color: p?.color ?? ('gray' as Participant['color']) }
  }

  const step = stepOf(event.granularity)
  const rows = event.times.length
  const gridMax = rows * step
  const gridStartMin = gridStartMinOf(event)
  const pxPerMin = CELL / step

  // others: everyone but you, minute-interval ranges per participant (read-only context)
  const [others] = useState<AvailIntervals>(() => {
    const src = availIvOf(event)
    return Object.fromEntries(event.days.map((d) => {
      const byPid = { ...(src[d.key] ?? {}) }
      delete byPid.JM
      return [d.key, byPid]
    }))
  })
  // mine: minute-interval ranges per day (5-min precision, mergeable)
  const [mine, setMine] = useState<Record<string, Iv[]>>(() => {
    const src = availIvOf(event)
    return Object.fromEntries(event.days.map((d) => [d.key, normalizeIv(src[d.key]?.JM ?? [])]))
  })

  const youAny = event.days.some((d) => (mine[d.key]?.length ?? 0) > 0)
  const otherIds = new Set<string>()
  for (const d of event.days) for (const [id, ivs] of Object.entries(others[d.key] ?? {})) if (ivs.length) otherIds.add(id)
  const responded = otherIds.size + (youAny ? 1 : 0)

  // once the plan is locked the grid is reference only; otherwise open in edit
  // until you've marked something — the page's one ask of a new participant.
  // Arriving with a person to focus (clicked from another tab) always opens in view.
  const [mode, setMode] = useState<Mode>(locked || initialFilter ? 'view' : !youAny ? 'edit' : 'view')
  // person filter — view mode reads the heat map against just the selected people
  const [filter, setFilter] = useState<Set<string>>(() => new Set(initialFilter ? [initialFilter] : []))
  const [h24, setH24] = useState(false)
  const [myTime, setMyTime] = useState(false) // show times in the viewer's local zone
  const [durationMin, setDurationMin] = useState(event.durationMin ?? 60)
  const [bestMode, setBestMode] = useState<BestMode>(event.bestMode ?? 'full')
  const [detail, setDetail] = useState<{ day: string; ti: number; cx: number; cyTop: number; cyBottom: number; below: boolean } | null>(null) // view-mode cell breakdown
  const [showMissing, setShowMissing] = useState(false)
  const [nudged, setNudged] = useState<Set<string>>(new Set())
  const [sel, setSel] = useState<Sel | null>(null)
  const [nudgeStep, setNudgeStep] = useState(5) // minutes the − / + buttons move an edge
  const [drag, setDrag] = useState<Drag | null>(null)
  const [page, setPage] = useState(0)
  // row virtualization: only the visible slice of time rows is mounted.
  // starts at 0 to match the un-scrolled DOM; the mount effect jumps to ~8 AM
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportH, setViewportH] = useState(460)
  const [viewportW, setViewportW] = useState(0)
  // provider picked → preview of what would be imported (null data = unavailable for this event)
  const [importing, setImporting] = useState<{ provider: string; data: Record<string, DayImport> | null } | null>(null)

  const WEEK = 7
  const paddedDays = useMemo<GDay[]>(() => padToWeeks(event.days), [event.days])
  const pageCount = Math.max(1, Math.ceil(paddedDays.length / WEEK))
  const weekDays = paddedDays.slice(page * WEEK, page * WEEK + WEEK)
  const goWeek = (dir: -1 | 1) => { setPage((p) => Math.max(0, Math.min(pageCount - 1, p + dir))); setSel(null) }

  // when out-of-bounds filler leads the week, the first real day draws its own left
  // border (the filler's grayed edge is too weak to frame it); with no leading filler
  // the time column's right border already does the job — never both, no doubles
  const firstRealIdx = weekDays.findIndex((d) => !d.pad)
  const leftEdgeIdx = firstRealIdx > 0 ? firstRealIdx : -1

  // the avatar pile follows the column width: 17px avatars + 2px gaps in a 5px-padded
  // cell, at most two rows, and the bottom-right corner stays free for the "n/N" count —
  // on narrow screens the pile shrinks instead of spilling into the cells below
  const colW = Math.max(72, ((viewportW || 0) - 54) / WEEK)
  const pileRow = Math.max(1, Math.floor((colW - 12) / 19))
  const pileMax = Math.min(AVATAR_CAP + 1, pileRow * 2 - 1)

  // timezone conversion: shift is 0 unless "my time" is on and the local zone differs
  const day0 = event.days[0]?.key ?? ''
  const rawShift = (() => { try { return ISO_DAY.test(day0) ? localZoneShiftMin(event.timezone, day0, gridStartMin) : 0 } catch { return 0 } })()
  const canConvert = rawShift !== 0
  const shift = myTime && canConvert ? rawShift : 0
  const localTz = localTimeZone()
  const fmt = (min: number) => fmtMinute(min + shift, h24)

  const mineRef = useRef(mine); useEffect(() => { mineRef.current = mine }, [mine])
  const selRef = useRef(sel); useEffect(() => { selRef.current = sel }, [sel])
  const dragRef = useRef<Drag | null>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const colRef = useRef<HTMLDivElement>(null) // left column — cell popover anchors here, outside the scroller
  const lastYRef = useRef(0) // latest pointer Y, for the auto-scroll loop
  const tapRef = useRef<{ day: string; ti: number; x: number; y: number } | null>(null) // touch: distinguish tap-to-mark from a scroll
  const rafRef = useRef(0)
  const scrollRaf = useRef(0)

  // all-day grids open scrolled to ~8 AM — the whole day stays reachable, mornings-first.
  // Also track the viewport height so virtualization knows how many rows to draw.
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const target = (8 * 60 - gridStartMin) * pxPerMin
    if (target > 0) { el.scrollTop = target; setScrollTop(target) }
    setViewportH(el.clientHeight)
    setViewportW(el.clientWidth)
    const ro = new ResizeObserver(() => { setViewportH(el.clientHeight); setViewportW(el.clientWidth) })
    ro.observe(el)
    return () => ro.disconnect()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // scroll → recompute the visible row window (rAF-throttled; also fires during drag auto-scroll)
  function onGridScroll() {
    setDetail(null) // a cell popover would detach from its cell on scroll
    if (scrollRaf.current) return
    scrollRaf.current = requestAnimationFrame(() => {
      scrollRaf.current = 0
      if (scroller.current) setScrollTop(scroller.current.scrollTop)
    })
  }
  useEffect(() => () => { if (scrollRaf.current) cancelAnimationFrame(scrollRaf.current) }, [])

  function persist(m: Record<string, Iv[]>) {
    if (event.demo) return
    const availIv: AvailIntervals = {}
    for (const d of event.days) {
      availIv[d.key] = { ...(others[d.key] ?? {}) }
      if (m[d.key]?.length) availIv[d.key].JM = m[d.key]
      else delete availIv[d.key].JM
    }
    patchEvent(event.id, { availIv, avail: intervalsToGrid(availIv, event.days, rows, step) })
  }
  function changeDuration(v: number) {
    setDurationMin(v)
    if (!event.demo) patchEvent(event.id, { durationMin: v })
  }
  function changeBestMode(v: BestMode) {
    setBestMode(v)
    if (!event.demo) patchEvent(event.id, { bestMode: v })
  }
  // quick-fill: add a clock-time block to every visible day at once
  function fillPreset(startClock: number, endClock: number) {
    const s = Math.max(0, Math.min(gridMax, startClock - gridStartMin))
    const e = Math.max(0, Math.min(gridMax, endClock - gridStartMin))
    if (e <= s) return
    setMine((pm) => {
      const next = { ...pm }
      for (const d of weekDays) if (!d.pad) next[d.key] = normalizeIv([...(pm[d.key] ?? []), { s, e }])
      persist(next)
      return next
    })
    setSel(null)
  }
  // one tap for "I'm free whenever": every time slot on every event day
  function fillAllDays() {
    const next = Object.fromEntries(event.days.map((d) => [d.key, [{ s: 0, e: gridMax }] as Iv[]]))
    setMine(next)
    persist(next)
    setSel(null)
  }
  function nudge(id: string) {
    setNudged((prev) => new Set(prev).add(id)) // stub: real build sends a reminder email
  }
  // toggle a person in the filter; from edit mode this jumps to view, where the filter reads
  function toggleFilter(pid: string) {
    setFilter((prev) => {
      const next = new Set(prev)
      if (next.has(pid)) next.delete(pid)
      else next.add(pid)
      return next
    })
    setDetail(null)
    if (mode === 'edit') { setMode('view'); setSel(null) }
  }
  function clearFilter() { setFilter(new Set()); setDetail(null) }
  function nudgeAll() { setNudged(new Set(missing.map((p) => p.id))) }

  // open the view-mode breakdown, anchored to the clicked cell but rendered outside the
  // scroller so overflow can't clip it
  function openDetail(e: React.MouseEvent, day: string, ti: number) {
    const col = colRef.current, sc = scroller.current
    if (!col) return
    const cr = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const pr = col.getBoundingClientRect()
    const below = sc ? cr.top - sc.getBoundingClientRect().top < sc.clientHeight * 0.5 : true
    setDetail({ day, ti, cx: cr.left - pr.left + cr.width / 2, cyTop: cr.top - pr.top, cyBottom: cr.bottom - pr.top, below })
  }

  // set a day's intervals, normalized + persisted; returns the merged result for re-selection
  function commitDay(day: string, ivs: Iv[]): Iv[] {
    const norm = normalizeIv(ivs)
    setMine((pm) => { const next = { ...pm, [day]: norm }; persist(next); return next })
    return norm
  }
  function selectMerged(day: string, ivs: Iv[], probe: number, edge: Edge) {
    const merged = ivs.find((iv) => probe >= iv.s && probe <= iv.e)
    if (merged) setSel({ day, s: merged.s, e: merged.e, edge })
  }

  // everyone's intervals for a day (mine folded in as 'JM'), with the live drag applied
  function combinedFor(day: string, liveMine?: Iv[], source: AvailIntervals = others): Record<string, Iv[]> {
    const m = liveMine ?? mine[day] ?? []
    return m.length ? { ...(source[day] ?? {}), JM: m } : { ...(source[day] ?? {}) }
  }

  // ── coordinate + snapping helpers ──
  const snap5 = (m: number) => Math.max(0, Math.min(gridMax, Math.round(m / 5) * 5))
  const rowStart = (m: number) => Math.max(0, Math.min(gridMax - step, Math.floor(m / step) * step))

  function onCellDown(e: React.PointerEvent, day: string, ti: number) {
    if (mode !== 'edit') return
    // Touch: don't hijack the gesture. Remember where it started and let the browser
    // scroll the grid vertically; a stationary release is treated as a tap-to-mark (see
    // onCellTap). Drag-to-paint stays a mouse/pen affordance.
    if (e.pointerType === 'touch') { tapRef.current = { day, ti, x: e.clientX, y: e.clientY }; return }
    e.preventDefault()
    // grid editing is driven by a window key listener, not element focus — drop any lingering
    // focus on a toolbar button so arrow-key nudging doesn't paint a stray focus ring on it
    if (document.activeElement instanceof HTMLElement && document.activeElement.tagName === 'BUTTON') document.activeElement.blur()
    const r = e.currentTarget.getBoundingClientRect()
    const gridMin = Math.max(0, Math.min(gridMax, ti * step + ((e.clientY - r.top) / r.height) * step))
    const hit = (mine[day] ?? []).find((iv) => gridMin >= iv.s && gridMin <= iv.e)
    if (hit) { setSel({ day, s: hit.s, e: hit.e, edge: 'bottom' }); return } // click a block → select, never toggle off
    const a = rowStart(gridMin)
    const d: Drag = { kind: 'paint', day, anchorClientY: e.clientY, anchorScrollTop: scroller.current?.scrollTop ?? 0, anchorMin: gridMin, block: { s: a, e: a + step } }
    dragRef.current = d; setDrag(d); setSel(null)
  }
  // touch release: a real tap (little movement) marks or selects the slot; a moved touch was a scroll
  function onCellTap(e: React.PointerEvent, day: string, ti: number) {
    if (mode !== 'edit' || e.pointerType !== 'touch') return
    const t = tapRef.current; tapRef.current = null
    if (!t || t.day !== day || t.ti !== ti) return
    if (Math.abs(e.clientY - t.y) > 8 || Math.abs(e.clientX - t.x) > 8) return // was a scroll, not a tap
    const mid = ti * step + step / 2
    const hit = (mine[day] ?? []).find((iv) => mid >= iv.s && mid <= iv.e)
    if (hit) { setSel({ day, s: hit.s, e: hit.e, edge: 'bottom' }); return } // tap a block → select (edit/remove via the bar)
    const a = rowStart(mid)
    const norm = commitDay(day, [...(mine[day] ?? []), { s: a, e: a + step }]) // tap empty → fill this slot
    selectMerged(day, norm, a + step / 2, 'bottom')
  }
  function onHandleDown(e: React.PointerEvent, edge: Edge) {
    e.preventDefault(); e.stopPropagation()
    if (document.activeElement instanceof HTMLElement && document.activeElement.tagName === 'BUTTON') document.activeElement.blur()
    const s = selRef.current; if (!s) return
    const d: Drag = {
      kind: 'resize', day: s.day, edge,
      fixedMin: edge === 'top' ? s.e : s.s,
      anchorClientY: e.clientY, anchorScrollTop: scroller.current?.scrollTop ?? 0, anchorMin: edge === 'top' ? s.s : s.e,
      origS: s.s, origE: s.e, block: { s: s.s, e: s.e }, del: false,
    }
    dragRef.current = d; setDrag(d)
  }

  // window-level drag tracking (raw pointer Y → grid minutes, so handles cross cells cleanly).
  // Scroll offset joins the pointer delta so the mapping stays correct while the grid
  // auto-scrolls under a stationary pointer near the container's edge.
  useEffect(() => {
    function updateDrag(clientY: number) {
      const d = dragRef.current; if (!d) return
      const scrollDelta = (scroller.current?.scrollTop ?? 0) - d.anchorScrollTop
      const cur = Math.max(0, Math.min(gridMax, d.anchorMin + (clientY - d.anchorClientY + scrollDelta) / pxPerMin))
      if (d.kind === 'paint') {
        const a = rowStart(d.anchorMin), c = rowStart(cur)
        const nd: Drag = { ...d, block: { s: Math.min(a, c), e: Math.max(a, c) + step } }
        dragRef.current = nd; setDrag(nd)
      } else {
        const m = snap5(cur)
        let block: Iv | null = null, del = false
        if (d.edge === 'bottom') { if (m <= d.fixedMin) del = true; else block = { s: d.fixedMin, e: m } }
        else { if (m >= d.fixedMin) del = true; else block = { s: m, e: d.fixedMin } }
        const nd: Drag = { ...d, block, del }
        dragRef.current = nd; setDrag(nd)
        if (block) setSel({ day: d.day, s: block.s, e: block.e, edge: d.edge })
      }
    }
    // edge auto-scroll: dragging near/past the top or bottom scrolls the grid,
    // clamped by the scroller itself at the first and last time slots
    function tick() {
      const d = dragRef.current, el = scroller.current
      if (!d || !el) { rafRef.current = 0; return }
      const r = el.getBoundingClientRect()
      const headerH = (el.querySelector('.sticky') as HTMLElement | null)?.offsetHeight ?? 56
      const EDGE = 30, MAX_SPEED = 16
      const y = lastYRef.current
      let dy = 0
      if (y < r.top + headerH + EDGE) dy = -Math.min(MAX_SPEED, (r.top + headerH + EDGE - y) / 3)
      else if (y > r.bottom - EDGE) dy = Math.min(MAX_SPEED, (y - (r.bottom - EDGE)) / 3)
      if (dy) {
        const before = el.scrollTop
        el.scrollTop = before + dy
        if (el.scrollTop !== before) updateDrag(y) // grid moved under the pointer — remap
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    function move(ev: PointerEvent) {
      if (!dragRef.current) return
      lastYRef.current = ev.clientY
      updateDrag(ev.clientY)
      if (!rafRef.current) rafRef.current = requestAnimationFrame(tick)
    }
    function up() {
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = 0 }
      const d = dragRef.current; if (!d) return
      dragRef.current = null
      if (d.kind === 'paint') {
        if (d.block) {
          const norm = commitDay(d.day, [...(mineRef.current[d.day] ?? []), d.block])
          selectMerged(d.day, norm, (d.block.s + d.block.e) / 2, 'bottom')
        }
      } else {
        const base = (mineRef.current[d.day] ?? []).filter((iv) => !(iv.s === d.origS && iv.e === d.origE))
        if (d.del || !d.block) { commitDay(d.day, base); setSel(null) } // dragged to zero → remove
        else {
          const norm = commitDay(d.day, [...base, d.block])
          selectMerged(d.day, norm, (d.block.s + d.block.e) / 2, d.edge)
        }
      }
      setDrag(null)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = 0 }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // move one edge of the selected block by `delta` minutes (keyboard arrows on desktop = ±1,
  // the on-screen − / + buttons on touch = ±5). Keeps the block at least MIN_LEN long.
  function nudgeEdge(edge: Edge, delta: number) {
    const s = selRef.current; if (!s) return
    let ns = s.s, ne = s.e
    if (edge === 'top') ns = Math.max(0, Math.min(s.e - MIN_LEN, s.s + delta))
    else ne = Math.min(gridMax, Math.max(s.s + MIN_LEN, s.e + delta))
    if (ns === s.s && ne === s.e) return
    const base = (mineRef.current[s.day] ?? []).filter((iv) => !(iv.s === s.s && iv.e === s.e))
    const norm = commitDay(s.day, [...base, { s: ns, e: ne }])
    selectMerged(s.day, norm, (ns + ne) / 2, edge)
  }

  // keyboard: arrow-nudge the active edge by the chosen increment, Esc to deselect, Del to remove
  useEffect(() => {
    if (!sel) return
    function key(ev: KeyboardEvent) {
      const s = selRef.current; if (!s) return
      if (ev.key === 'Escape') { setSel(null); return }
      if (ev.key === 'Delete' || ev.key === 'Backspace') {
        ev.preventDefault()
        commitDay(s.day, (mineRef.current[s.day] ?? []).filter((iv) => !(iv.s === s.s && iv.e === s.e)))
        setSel(null); return
      }
      if (ev.key === 'ArrowUp' || ev.key === 'ArrowDown') {
        ev.preventDefault()
        nudgeEdge(s.edge, ev.key === 'ArrowUp' ? -nudgeStep : nudgeStep)
      }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [sel, nudgeStep]) // eslint-disable-line react-hooks/exhaustive-deps

  function deleteSel() {
    const s = selRef.current; if (!s) return
    commitDay(s.day, (mineRef.current[s.day] ?? []).filter((iv) => !(iv.s === s.s && iv.e === s.e)))
    setSel(null)
  }

  function toggleDay(day: string) {
    if (mode !== 'edit') return
    const full = mine[day]?.length === 1 && mine[day][0].s === 0 && mine[day][0].e === gridMax
    commitDay(day, full ? [] : [{ s: 0, e: gridMax }])
    setSel(null)
  }
  function toggleTime(ti: number) {
    if (mode !== 'edit') return
    const w0 = ti * step, w1 = (ti + 1) * step
    const real = weekDays.filter((d) => !d.pad) // filler days aren't part of the event
    const allFull = real.every((d) => (mine[d.key] ?? []).some((iv) => iv.s <= w0 && iv.e >= w1))
    for (const d of real) {
      const base = mine[d.key] ?? []
      commitDay(d.key, allFull ? base.flatMap((iv) => subtract(iv, w0, w1)) : [...base, { s: w0, e: w1 }])
    }
    setSel(null)
  }

  // intervals to draw for a day, folding in the live drag so shrink/grow/merge shows immediately
  function renderIvsFor(day: string): Iv[] {
    const d = drag
    if (d && d.day === day) {
      if (d.kind === 'paint') return [...(mine[day] ?? []), ...(d.block ? [d.block] : [])]
      return [...(mine[day] ?? []).filter((iv) => !(iv.s === d.origS && iv.e === d.origE)), ...(d.block ? [d.block] : [])]
    }
    return mine[day] ?? []
  }

  // clearing is instant with an undo window instead of a scary confirm — the old
  // times sit in state until the toast expires
  const [undoTimes, setUndoTimes] = useState<Record<string, Iv[]> | null>(null)
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (undoTimer.current) clearTimeout(undoTimer.current) }, [])
  function clearAllMine() {
    const snapshot = mine
    const next = Object.fromEntries(event.days.map((d) => [d.key, [] as Iv[]]))
    setMine(next); persist(next)
    setSel(null)
    setUndoTimes(snapshot)
    if (undoTimer.current) clearTimeout(undoTimer.current)
    undoTimer.current = setTimeout(() => setUndoTimes(null), 8000)
  }
  function undoClear() {
    if (!undoTimes) return
    setMine(undoTimes); persist(undoTimes)
    setUndoTimes(null)
    if (undoTimer.current) clearTimeout(undoTimer.current)
  }

  // calendar import: fetch busy as UTC instants, convert to event-tz grid minutes, preview, apply
  function startImport(provider: string) {
    if (!event.days.every((d) => ISO_DAY.test(d.key))) { setImporting({ provider, data: null }); return }
    setImporting({ provider, data: buildImportPreview(mockBusyUtc(event.days), event.days, gridStartMin, gridMax, event.timezone) })
  }
  function applyImport() {
    if (!importing?.data) return
    const next = { ...mineRef.current }
    // merge, never remove: imported free times join whatever is already marked
    for (const [day, di] of Object.entries(importing.data)) next[day] = normalizeIv([...(next[day] ?? []), ...di.free])
    setMine(next); persist(next)
    setSel(null); setImporting(null); setMode('edit')
  }

  // Scalability: cell rendering must not be O(cells × people). Build each day's combined
  // intervals ONCE per render (not once per cell), so the grid scales with days, not
  // days × rows × participants — the difference between fine and janky at 100+ people.
  const combinedByDay = useMemo<AvailIntervals>(
    () => Object.fromEntries(event.days.map((d) => [d.key, combinedFor(d.key)])),
    [mine, others], // eslint-disable-line react-hooks/exhaustive-deps
  )
  // the person filter reaches edit mode too: others' context heat narrows to the selected
  // people while your own painted blocks always stay in the foreground
  const filterOnEarly = filter.size > 0
  const othersFiltered = useMemo<AvailIntervals>(() => {
    if (!filterOnEarly) return others
    return Object.fromEntries(Object.entries(others).map(([k, byPid]) => [
      k,
      Object.fromEntries(Object.entries(byPid).filter(([id]) => filter.has(id))),
    ]))
  }, [others, filter, filterOnEarly])
  // in edit mode the denominator is the selected people plus you (you always show)
  const editTotal = filterOnEarly ? filter.size + (filter.has('JM') ? 0 : 1) : total

  // live per-day intervals while editing (folds in the current drag); only the dragged day changes
  const editIvsByDay = useMemo<Record<string, Iv[]>>(
    () => (mode === 'edit' ? Object.fromEntries(weekDays.map((d) => [d.key, renderIvsFor(d.key)])) : {}),
    [mode, mine, drag, page], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const editCombinedByDay = useMemo<Record<string, Record<string, Iv[]>>>(
    () => (mode === 'edit' ? Object.fromEntries(weekDays.map((d) => [d.key, combinedFor(d.key, editIvsByDay[d.key], othersFiltered)])) : {}),
    [mode, editIvsByDay, othersFiltered, page], // eslint-disable-line react-hooks/exhaustive-deps
  )

  // view mode reads through the person filter: heat, counts, popovers, and the best window
  // all recompute against just the selected people (an empty filter means everyone)
  const filterOn = filter.size > 0
  const viewCombinedByDay = useMemo<AvailIntervals>(() => {
    if (!filterOn) return combinedByDay
    return Object.fromEntries(Object.entries(combinedByDay).map(([k, byPid]) => [
      k,
      Object.fromEntries(Object.entries(byPid).filter(([id]) => filter.has(id))),
    ]))
  }, [combinedByDay, filter, filterOn])
  const viewTotal = filterOn ? filter.size : total

  // best window (live interval sweep — most people simultaneously free, longest such stretch)
  const bw = useMemo(() => bestWindow(viewCombinedByDay, event.days, durationMin, bestMode), [viewCombinedByDay, durationMin, bestMode]) // eslint-disable-line react-hooks/exhaustive-deps

  // who still hasn't marked any availability (to nudge)
  const respondedIds = new Set(otherIds); if (youAny) respondedIds.add('JM')
  const missing = event.participants.filter((p) => !respondedIds.has(p.id) && p.rsvp !== 'not_going')
  // filtered-in people with nothing marked — an empty grid needs to say why
  const unmarked = filterOn
    ? [...filter].filter((id) => !respondedIds.has(id)).map((id) => pById.get(id)).filter((p): p is Participant => !!p)
    : []
  const unmarkedNudgees = unmarked.filter((p) => !p.you)
  const rangeLabel = weekDays.length ? (weekDays.length > 1 ? `${weekDays[0].date} – ${weekDays[weekDays.length - 1].date}` : weekDays[0].date) : ''

  // virtualization window: mount only the visible rows (+ overscan), pad the rest with spacers
  const firstRow = Math.max(0, Math.floor(scrollTop / CELL) - OVERSCAN)
  const lastRow = Math.min(rows, Math.ceil((scrollTop + viewportH) / CELL) + OVERSCAN)
  const topPad = firstRow * CELL
  const botPad = Math.max(0, (rows - lastRow) * CELL)

  // handle placement for the current selection
  const dragDel = drag?.kind === 'resize' && drag.del
  const topCell = sel ? Math.max(0, Math.min(rows - 1, Math.floor(sel.s / step))) : -1
  const topPct = sel ? ((sel.s - topCell * step) / step) * 100 : 0
  const botCell = sel ? Math.max(0, Math.min(rows - 1, Math.ceil(sel.e / step) - 1)) : -1
  const botPct = sel ? ((sel.e - botCell * step) / step) * 100 : 0
  // keep the chip on-screen: tuck it inward when its handle hugs the grid's top/bottom edge
  const topSide: 'above' | 'below' = sel && sel.s * pxPerMin < 22 ? 'below' : 'above'
  const botSide: 'above' | 'below' = sel && rows * CELL - sel.e * pxPerMin < 22 ? 'above' : 'below'

  const minBandDur = 7 / pxPerMin // paint bands thinner than ~7px get absorbed

  // a best-window link elsewhere (hero, attendance) jumps here: right week, view
  // mode so the frame shows, grid scrolled so the window sits mid-viewport
  useEffect(() => {
    if (!focusBest || !bw) return
    const el = scroller.current
    if (!el) return
    const idx = paddedDays.findIndex((d) => d.key === bw.dayKey)
    if (idx >= 0) setPage(Math.floor(idx / WEEK))
    setMode('view')
    const target = Math.max(0, ((bw.s + bw.e) / 2) * pxPerMin - el.clientHeight / 2)
    el.scrollTop = target
    setScrollTop(target)
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [focusBest]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative flex flex-col rounded-2xl border border-border bg-s1 lg:h-[calc(100dvh-300px)] lg:max-h-[820px] lg:min-h-[480px] lg:flex-row">
      <div ref={colRef} className="relative flex min-w-0 flex-1 flex-col p-4">
        {/* toolbar — first row pairs the mode toggle with Settings (always right-aligned);
            the week nav and time controls flow on their own row below */}
        <div className="border-b border-border pb-[13px]">
          {!locked && (
            <div className="mb-2.5 flex items-center justify-between gap-[9px]">
              <SegmentedControl size="sm" value={mode} onChange={(v) => { setMode(v as Mode); setSel(null); setDetail(null) }} options={[{ v: 'view', l: 'View' }, { v: 'edit', l: 'Edit mine' }]} />
              <Popover
                align="end"
                width={264}
                trigger={(open) => (
                  <span className={`flex h-7 items-center gap-1.5 rounded-lg border px-[10px] text-[12.5px] font-medium ${open ? 'border-accent bg-accent-bg text-accent-text' : 'border-border bg-s1 hover:border-border2'}`}>
                    <SlidersHorizontal size={13} /> Settings
                  </span>
                )}
              >
                {() => (
                  <div className="flex flex-col gap-3">
                    <div>
                      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[.12em] text-faint">Event length</div>
                      <div className="flex flex-wrap gap-1.5">
                        {[30, 60, 90, 120, 180, 240].map((m) => (
                          <button key={m} onClick={() => changeDuration(m)} className={`rounded-[7px] border px-2 py-1 text-[12.5px] font-medium ${m === durationMin ? 'border-accent bg-accent text-on-accent' : 'border-border2 bg-s1 hover:bg-s2'}`}>{fmtDur(m)}</button>
                        ))}
                      </div>
                      <div className="mt-2 flex items-center gap-1.5">
                        <span className="text-[12px] text-faint">Custom</span>
                        <input
                          type="number" min={15} max={720} step={15} value={durationMin}
                          onChange={(e) => { const n = parseInt(e.target.value, 10); if (!Number.isNaN(n)) changeDuration(Math.min(720, Math.max(15, n))) }}
                          className="h-7 w-16 rounded-[7px] border border-border bg-s1 px-2 text-[13px] tabular-nums outline-none focus:border-accent-border"
                          aria-label="Custom event length in minutes"
                        />
                        <span className="text-[12px] text-faint">min</span>
                      </div>
                    </div>
                    <div className="border-t border-border pt-2.5">
                      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[.12em] text-faint">Best time favors</div>
                      <Segment compact value={bestMode} onChange={(v) => changeBestMode(v as BestMode)} options={[{ v: 'full', l: 'Everyone stays' }, { v: 'crowd', l: 'Biggest crowd' }]} />
                      <p className="mt-1.5 text-[12px] leading-[1.5] text-faint">
                        {bestMode === 'full'
                          ? 'Picks the time the most people can attend start to finish.'
                          : 'Picks the time with the most people around overall, even if some come and go.'}
                      </p>
                    </div>
                    <div className="border-t border-border pt-2.5">
                      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[.12em] text-faint">Time format</div>
                      <Segment value={h24 ? '24' : '12'} onChange={(v) => setH24(v === '24')} options={[{ v: '12', l: '12-hour' }, { v: '24', l: '24-hour' }]} />
                    </div>
                  </div>
                )}
              </Popover>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-[9px]">
          <div className="flex items-center gap-[3px]">
            <IconBtn onClick={() => goWeek(-1)} disabled={page === 0}><ChevronLeft size={17} /></IconBtn>
            <span className="px-1 text-center text-[13.5px] font-semibold leading-tight">
              {rangeLabel}
              {pageCount > 1 && <span className="ml-1 font-medium text-faint">· Week {page + 1}/{pageCount}</span>}
            </span>
            <IconBtn onClick={() => goWeek(1)} disabled={page >= pageCount - 1}><ChevronRight size={17} /></IconBtn>
          </div>
          {canConvert ? (
            // a two-sided toggle, so it reads as "event zone vs your zone" at a glance
            <div className="flex h-7 items-center overflow-hidden rounded-lg border border-border bg-s1 text-[12px] font-medium" role="group" aria-label="Show times in">
              <button
                type="button" onClick={() => setMyTime(false)} aria-pressed={!myTime}
                title={`Event time (${tzAbbr(event.timezone)})`}
                className={`flex h-full items-center px-2 ${!myTime ? 'bg-accent font-semibold text-on-accent' : 'text-dim hover:text-text'}`}
              >
                {/* baseline-align the label and the smaller mono abbr so they sit on one line */}
                <span className="flex items-baseline gap-1">Event <span className="font-mono text-[10.5px]">{tzAbbr(event.timezone)}</span></span>
              </button>
              <button
                type="button" onClick={() => setMyTime(true)} aria-pressed={myTime}
                title={`Your time (${tzAbbr(localTz)})`}
                className={`flex h-full items-center px-2 ${myTime ? 'bg-accent font-semibold text-on-accent' : 'text-dim hover:text-text'}`}
              >
                <span className="flex items-baseline gap-1">Yours <span className="font-mono text-[10.5px]">{tzAbbr(localTz)}</span></span>
              </button>
            </div>
          ) : (
            <span className="flex items-center gap-1.5 text-[12.5px] text-dim">Times in <TimezonePill tz={event.timezone} /></span>
          )}
          {!locked && <ImportFromCalendar onPick={startImport} />}
          {!locked && youAny && <ClearTimes onClear={clearAllMine} />}
          </div>
        </div>

        {/* participants + edit hint */}
        <div className="flex flex-wrap items-center gap-2.5 py-[11px]">
          <span className="text-[12.5px] text-dim">Participants</span>
          <FilterAvatars participants={event.participants} filter={filter} onToggle={toggleFilter} />
          {filterOn && (
            <button onClick={clearFilter} title="Show everyone again" className="flex items-center gap-1 rounded-full border border-accent-border bg-accent-bg px-2 py-0.5 text-[11.5px] font-semibold text-accent-text">
              Showing {filter.size} {filter.size === 1 ? 'person' : 'people'} <X size={11} />
            </button>
          )}
          {/* responded count opens the who's-missing / nudge popover */}
          <div className="relative">
            <button
              onClick={() => missing.length && setShowMissing((s) => !s)}
              // keep this pointerdown from reaching the popover's outside-click listener —
              // it would close the popover first and the click would instantly reopen it
              onPointerDown={(e) => e.stopPropagation()}
              className={`ml-1.5 flex items-center gap-1 text-[12.5px] ${missing.length ? 'text-accent-text hover:underline' : 'text-dim'}`}
            >
              {responded} of {total} responded{missing.length > 0 && <ChevronDown size={13} className={showMissing ? 'rotate-180' : ''} />}
            </button>
            {showMissing && missing.length > 0 && (
              <MissingPopover missing={missing} nudged={nudged} onNudge={nudge} onNudgeAll={nudgeAll} onClose={() => setShowMissing(false)} />
            )}
          </div>
          {mode === 'edit' && <PresetFills onFill={fillPreset} onFillAll={fillAllDays} />}
          {/* first-time hint only — it earns its place until you've marked something */}
          {mode === 'edit' && !sel && !youAny && (
            <span className="text-[12.5px] text-faint">Drag across the times you&apos;re free. The checkmarks fill a whole day or row at once.</span>
          )}
          {locked && <span className="text-[12.5px] text-faint">Planning is locked. The grid stays for reference.</span>}
          {/* heat legend in view mode; editing only needs the You swatch */}
          <span className="ml-auto flex items-center gap-1 text-[11px] text-faint">
            {mode === 'edit' ? (
              <>
                <span className="h-[11px] w-[11px] rounded-[3px]" style={{ background: 'var(--you-some)', border: '1.5px solid var(--you-text)' }} />
                <span>You</span>
              </>
            ) : (
              <>
                <span>No one</span>
                {['var(--s2)', 'var(--heat-low)', 'var(--heat-mid)', 'var(--heat-high)', 'var(--heat-full)'].map((c) => (
                  <span key={c} className="h-[11px] w-[11px] rounded-[3px] border border-border" style={{ background: c }} />
                ))}
                <span>{filterOn ? 'All selected' : 'Everyone'}</span>
              </>
            )}
          </span>
        </div>

        {/* filtered-in people with no times yet — say so instead of showing a silently empty grid */}
        {mode === 'view' && unmarked.length > 0 && (() => {
          const names = unmarked.map((p) => (p.you ? 'You' : p.name.split(' ')[0]))
          const label = names.length === 1 ? names[0] : names.length === 2 ? `${names[0]} and ${names[1]}` : `${names.slice(0, 2).join(', ')}, and ${names.length - 2} more`
          const verb = names.length === 1 && names[0] !== 'You' ? "hasn't" : "haven't"
          const allNudged = unmarkedNudgees.every((p) => nudged.has(p.id))
          return (
            <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-[10px] border border-border bg-s0 px-3 py-2">
              <span className="text-[13px] text-dim">{label} {verb} marked any times yet.</span>
              {unmarkedNudgees.length > 0 && (
                <button
                  onClick={() => unmarkedNudgees.forEach((p) => nudge(p.id))}
                  disabled={allNudged}
                  className={`flex items-center gap-1 text-[12.5px] font-semibold ${allNudged ? 'text-teal-text' : 'text-accent-text hover:underline'}`}
                >
                  {allNudged ? <><Check size={12} /> Nudged</> : <><Bell size={12} /> {unmarkedNudgees.length === 1 ? `Nudge ${unmarkedNudgees[0].name.split(' ')[0]}` : 'Nudge them'}</>}
                </button>
              )}
              {unmarked.some((p) => p.you) && !locked && (
                <button onClick={() => { setMode('edit'); setSel(null) }} className="flex items-center gap-1 text-[12.5px] font-semibold text-accent-text hover:underline">
                  Add yours
                </button>
              )}
            </div>
          )
        })()}

        {/* selected-block editor — precise edge control that works by touch (no arrow keys on mobile) */}
        {mode === 'edit' && sel && (
          <div className="mb-2 flex items-stretch justify-between gap-3 rounded-[10px] border border-accent-border bg-accent-bg/50 px-3 py-2.5">
            {/* left: header, increment toggle, and the two edges stacked (side-by-side on wider screens) */}
            <div className="flex min-w-0 flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[12px] font-semibold text-accent-text">Selected</span>
                <div className="inline-flex overflow-hidden rounded-full border border-border2 bg-s1 text-[11px] font-semibold">
                  {[5, 1].map((s) => (
                    <button key={s} type="button" onClick={() => setNudgeStep(s)} className={`px-2.5 py-1 ${nudgeStep === s ? 'bg-accent text-on-accent' : 'text-dim hover:bg-s2'}`} aria-pressed={nudgeStep === s}>{s} min</button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
                <EdgeNudge label="Start" value={fmt(gridStartMin + sel.s)} onLess={() => nudgeEdge('top', -nudgeStep)} onMore={() => nudgeEdge('top', nudgeStep)} />
                <EdgeNudge label="End" value={fmt(gridStartMin + sel.e)} onLess={() => nudgeEdge('bottom', -nudgeStep)} onMore={() => nudgeEdge('bottom', nudgeStep)} />
              </div>
            </div>
            {/* right: Remove / Done pinned bottom-right */}
            <div className="flex flex-none flex-col items-end justify-end gap-1.5">
              <button onClick={deleteSel} className="flex h-8 items-center gap-1.5 rounded-[8px] border border-brick-border bg-s1 px-2.5 text-[12.5px] font-semibold text-brick-text hover:bg-brick-bg">
                <Trash2 size={14} /> Remove
              </button>
              <button onClick={() => setSel(null)} className="flex h-8 items-center rounded-[8px] border border-border2 bg-s1 px-2.5 text-[12.5px] font-semibold hover:bg-s2">Done</button>
            </div>
          </div>
        )}

        {/* grid */}
        <div ref={scroller} onScroll={onGridScroll} className="scroll-slim max-h-[58dvh] flex-1 overflow-auto rounded-[10px] border border-border lg:max-h-none">
          {/* width tracks the day count: a single day must fit the screen without a
              horizontal scroll, and shouldn't stretch into one huge column either */}
          <div
            className="grid"
            style={{
              gridTemplateColumns: `54px repeat(${weekDays.length}, minmax(72px, 1fr))`,
              minWidth: 54 + weekDays.length * 72,
              maxWidth: 54 + weekDays.length * 280,
            }}
          >
            {/* header row — the corner cell stays pinned through both scroll directions */}
            <div className="sticky left-0 top-0 z-[30] border-b border-r border-grid-edge bg-s0"/>
            {weekDays.map((d, di) => {
              // filler day outside the event's window — labeled but inert
              if (d.pad) {
                return (
                  <div key={d.key} className="sticky top-0 z-20 border-b border-r border-border bg-s0 px-1.5 py-2 text-center">
                    <div className="text-[11px] text-faint">{d.dow}</div>
                    <div className="text-[14px] font-semibold text-faint">{d.date}</div>
                  </div>
                )
              }
              const dayFull = mode === 'edit' && mine[d.key]?.length === 1 && mine[d.key][0].s === 0 && mine[d.key][0].e === gridMax
              const isBestDay = d.best || (mode === 'view' && bw?.dayKey === d.key)
              return (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => toggleDay(d.key)}
                  className={`sticky top-0 z-20 border-b border-r border-grid-edge px-1.5 py-2 text-center ${di === leftEdgeIdx ? 'border-l border-l-grid-edge' : ''}`}
                  style={{ background: isBestDay ? 'var(--best-head)' : 'var(--s0)', cursor: mode === 'edit' ? 'pointer' : 'default' }}
                  title={mode === 'edit' ? 'Click to fill the whole day' : undefined}
                >
                  <div className="text-[11px] text-dim">{d.dow}</div>
                  <div className="text-[14px] font-semibold" style={{ color: isBestDay ? 'var(--ochre-text)' : 'var(--text)' }}>{d.date}</div>
                  {mode === 'edit' && (
                    <span className={`mx-auto mt-[3px] grid h-4 w-4 place-items-center rounded-[5px] border ${dayFull ? 'border-accent bg-accent text-on-accent' : 'border-border2 text-transparent'}`}>
                      <Check size={11} />
                    </span>
                  )}
                  {isBestDay && mode === 'view' && <span className="mt-[3px] inline-block rounded-[5px] border border-ochre-border bg-ochre-bg px-[5px] py-px text-[9.5px] font-semibold text-ochre-text">Best day</span>}
                </button>
              )
            })}

            {/* body rows — only the visible slice is mounted; spacers hold the scroll height */}
            {topPad > 0 && <div style={{ gridColumn: '1 / -1', height: topPad }} />}
            {event.times.slice(firstRow, lastRow).map((_, k) => {
              const ti = firstRow + k
              const rowMin = gridStartMin + ti * step + shift
              const rowH = ((Math.floor(rowMin / 60) % 24) + 24) % 24
              const rowMm = String(((rowMin % 60) + 60) % 60).padStart(2, '0')
              const labelMain = h24 ? `${String(rowH).padStart(2, '0')}:${rowMm}` : `${rowH % 12 === 0 ? 12 : rowH % 12}:${rowMm}`
              const labelSub = h24 ? null : rowH < 12 ? 'AM' : 'PM'
              const w0 = ti * step, w1 = (ti + 1) * step
              const rowFull = weekDays.every((d) => d.pad || (mine[d.key] ?? []).some((iv) => iv.s <= w0 && iv.e >= w1))
              return (
              <div key={ti} className="contents">
                <button
                  type="button"
                  onClick={() => toggleTime(ti)}
                  // sticky-left so the time labels follow horizontal scroll, the same way
                  // the day header row follows vertical scroll
                  className="sticky left-0 z-[15] flex items-center justify-center gap-1 border-b border-r border-grid-edge bg-s0 p-1 text-[12px] font-medium text-dim"
                  style={{ cursor: mode === 'edit' ? 'pointer' : 'default' }}
                  title={mode === 'edit' ? 'Click to fill this time across the week' : undefined}
                >
                  {mode === 'edit' && (
                    <span className={`grid h-3.5 w-3.5 flex-none place-items-center rounded-[4px] border ${rowFull ? 'border-accent bg-accent text-on-accent' : 'border-border2 text-transparent'}`}>
                      <Check size={10} />
                    </span>
                  )}
                  <span className="flex flex-col items-center leading-[1.15]">
                    <span>{labelMain}</span>
                    {labelSub && <span className="text-[9.5px] font-semibold tracking-[.04em] text-faint">{labelSub}</span>}
                  </span>
                </button>
                {weekDays.map((d, di) => {
                  // out-of-window cell: hatched, no data, no interactions
                  if (d.pad) {
                    return (
                      <div
                        key={d.key}
                        className="min-h-[50px] border-b border-r border-border"
                        style={{ background: 'repeating-linear-gradient(-45deg, var(--s0) 0 5px, var(--s2) 5px 6px)' }}
                        title="Outside this event's dates"
                      />
                    )
                  }
                  if (mode === 'view') {
                    const bands = cellBands(viewCombinedByDay[d.key] ?? {}, w0, w1)
                    const peak = peakOf(bands)
                    const n = peak.ids.length
                    // the heat must change color exactly at the best-window frame lines, so its
                    // edges are protected from the sliver merge in the cells they run through
                    const paint = mergeSlivers(bands, minBandDur, bw && d.key === bw.dayKey ? [bw.s, bw.e] : undefined)
                    const title = bands.length === 1
                      ? (n ? `${n} of ${viewTotal} free` : 'No one free')
                      : bands.map((b) => `${fmt(gridStartMin + b.s)} – ${fmt(gridStartMin + b.e)}: ${b.ids.length} free`).join('\n')
                    const open = detail?.day === d.key && detail?.ti === ti
                    // the best window is one continuous ochre frame over its cells — a color the
                    // grid never uses for lines or heat, so it can't be mistaken for either
                    const inBest = !!bw && d.key === bw.dayKey && w0 < bw.e && w1 > bw.s
                    return (
                      <div
                        key={d.key}
                        onClick={(e) => openDetail(e, d.key, ti)}
                        className={`relative min-h-[50px] cursor-pointer border-b border-r border-grid-line ${di === leftEdgeIdx ? 'border-l border-l-grid-line' : ''}`}
                        style={{ boxShadow: open ? 'inset 0 0 0 1.5px var(--accent)' : d.best ? 'inset 0 0 0 1px var(--ochre-border)' : undefined }}
                        title={title}
                      >
                        {inBest && (() => {
                          // frame hugs the window's true minutes, not the cell edges — a 10:30
                          // start draws the top line halfway down the 10:00 cell
                          const bs = Math.max(bw!.s, w0), be = Math.min(bw!.e, w1)
                          const edge = '2.5px solid var(--ochre)'
                          return (
                            <div
                              className="pointer-events-none absolute inset-x-0 z-[2]"
                              style={{
                                top: `${((bs - w0) / step) * 100}%`,
                                height: `${((be - bs) / step) * 100}%`,
                                borderLeft: edge,
                                borderRight: edge,
                                borderTop: bs === bw!.s ? edge : undefined,
                                borderBottom: be === bw!.e ? edge : undefined,
                              }}
                            />
                          )
                        })()}
                        {paint.map((b, k) => (
                          <div
                            key={k}
                            className="pointer-events-none absolute inset-x-0"
                            style={{
                              top: `${((b.s - w0) / step) * 100}%`,
                              height: `${((b.e - b.s) / step) * 100}%`,
                              background: heat(b.ids.length, viewTotal),
                              borderTop: b.s > w0 ? '1px dashed var(--grid-dash)' : undefined,
                            }}
                          />
                        ))}
                        {/* slot line redrawn above the heat fills so saturated cells can't wash it out */}
                        <div className="pointer-events-none absolute z-[1] border-b border-r border-grid-line" style={{ inset: '0 -1px -1px 0' }} />
                        {/* cap the pile so a 100-person cell renders ~6 avatars + "+N", not 100 nodes */}
                        <div className="relative z-[1] flex flex-wrap content-start gap-0.5 p-[5px]">
                          {(() => {
                            const shown = n <= pileMax ? Math.min(n, AVATAR_CAP) : pileMax - 1
                            return (
                              <>
                                {peak.ids.slice(0, shown).map((id) => { const a = avatarOf(id); return <Avatar key={id} initials={a.initials} color={a.color} size={17} font={8.5} title={a.name} /> })}
                                {n > shown && <span className="grid h-[15px] min-w-[15px] place-items-center rounded-full bg-s3 px-[3px] text-[8.5px] font-bold text-dim" title={`${n} free`}>+{n - shown}</span>}
                              </>
                            )
                          })()}
                        </div>
                        {n > 0 && <span className="pointer-events-none absolute bottom-[3px] right-1 z-[1] text-[9.5px] font-bold" style={{ color: n >= viewTotal ? '#F4F1EA' : '#46604F' }}>{n}/{viewTotal}</span>}
                      </div>
                    )
                  }
                  // edit mode — others' context tinted at their peak concurrency; my blocks in clay above
                  const oBands = cellBands(othersFiltered[d.key] ?? {}, w0, w1)
                  const oCount = peakOf(oBands).ids.length
                  const clay = clayFor(oCount)
                  const ivs = editIvsByDay[d.key] ?? []
                  const cnt = peakOf(cellBands(editCombinedByDay[d.key] ?? {}, w0, w1)).ids.length
                  const isTopEdge = !!sel && !dragDel && sel.day === d.key && topCell === ti
                  const isBotEdge = !!sel && !dragDel && sel.day === d.key && botCell === ti
                  return (
                    <div key={d.key} className={`relative h-[50px] select-none border-b border-r border-grid-line ${di === leftEdgeIdx ? 'border-l border-l-grid-line' : ''}`} style={{ background: heat(oCount, editTotal), boxShadow: d.best ? 'inset 1px 0 0 0 var(--ochre-border), inset -1px 0 0 0 var(--ochre-border)' : undefined }}>
                      {ivs.map((iv, k) => {
                        const cs = Math.max(iv.s, w0), ce = Math.min(iv.e, w1)
                        if (ce <= cs) return null
                        // solid outline only at the block's true start/end + both sides, so a
                        // multi-cell block reads as one crisp shape over the green heat
                        const line = '1.5px solid #7A531F'
                        return (
                          <div
                            key={k}
                            className="pointer-events-none absolute inset-x-0"
                            style={{
                              top: `${((cs - w0) / step) * 100}%`,
                              height: `${((ce - cs) / step) * 100}%`,
                              background: clay,
                              boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.35)',
                              borderLeft: line,
                              borderRight: line,
                              borderTop: cs === iv.s ? line : undefined,
                              borderBottom: ce === iv.e ? line : undefined,
                            }}
                          />
                        )
                      })}
                      {/* slot line redrawn above the heat fills so saturated cells can't wash it out */}
                      <div className="pointer-events-none absolute z-[1] border-b border-r border-grid-line" style={{ inset: '0 -1px -1px 0' }} />
                      {cnt > 0 && <span className="pointer-events-none absolute bottom-[2px] right-1 z-[2] text-[9px] font-bold" style={{ color: cnt >= editTotal ? '#F4F1EA' : '#6E5523' }}>{cnt}/{editTotal}</span>}
                      {/* full-cell hit zone: empty → paint, over a block → select */}
                      <div className="absolute inset-0 z-[5] touch-auto" onPointerDown={(e) => onCellDown(e, d.key, ti)} onPointerUp={(e) => onCellTap(e, d.key, ti)} onPointerCancel={() => { tapRef.current = null }} />
                      {/* time handles + delete for the selected block */}
                      {isTopEdge && (
                        <>
                          <EdgeHandle pct={topPct} label={fmt(gridStartMin + sel!.s)} active={sel!.edge === 'top'} side={topSide} onDown={(e) => onHandleDown(e, 'top')} />
                          <button
                            type="button"
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={deleteSel}
                            className="pointer-events-auto absolute right-0.5 z-[10] grid h-[15px] w-[15px] place-items-center rounded-full border bg-s1 text-brick shadow-soft"
                            // like the time chip, tuck fully inside the block when the edge hugs the grid top
                            style={{ top: `${topPct}%`, transform: topSide === 'below' ? 'translateY(3px)' : 'translateY(-50%)', borderColor: 'var(--border2)' }}
                            aria-label="Remove this block"
                          >
                            <X size={11} />
                          </button>
                        </>
                      )}
                      {isBotEdge && (
                        <EdgeHandle pct={botPct} label={fmt(gridStartMin + sel!.e)} active={sel!.edge === 'bottom'} side={botSide} onDown={(e) => onHandleDown(e, 'bottom')} />
                      )}
                    </div>
                  )
                })}
              </div>
              )
            })}
            {botPad > 0 && <div style={{ gridColumn: '1 / -1', height: botPad }} />}
          </div>
        </div>

        {/* view-mode cell breakdown — anchored to the cell but outside the scroller so nothing clips it */}
        {detail && (() => {
          const bands = cellBands(viewCombinedByDay[detail.day] ?? {}, detail.ti * step, (detail.ti + 1) * step)
          const W = 222, half = W / 2 + 6
          const colW = colRef.current?.clientWidth ?? 400
          const left = Math.max(half, Math.min(colW - half, detail.cx))
          return (
            <CellDetail
              bands={bands}
              total={viewTotal}
              fmt={fmt}
              gridStartMin={gridStartMin}
              avatarOf={avatarOf}
              onPerson={toggleFilter}
              filter={filter}
              style={{ left, top: detail.below ? detail.cyBottom + 6 : detail.cyTop - 6, transform: detail.below ? 'translateX(-50%)' : 'translate(-50%, -100%)' }}
              onClose={() => setDetail(null)}
            />
          )
        })()}

        {/* best-window footer — gone once locked; the confirmed plan owns the answer */}
        {!locked && <div className="mt-0.5 flex flex-wrap items-center gap-2.5 border-t border-border px-0.5 pt-3">
          {bw ? (
            <>
              <span className="text-[12.5px] text-dim">Best {fmtDur(durationMin)} slot{filterOn ? ' for your selection' : ''}</span>
              <span className="text-[14px] font-semibold text-ochre">{bw.dayLabel} · {fmt(gridStartMin + bw.s)} – {fmt(gridStartMin + bw.e)}</span>
              <TimezonePill tz={myTime && canConvert ? localTz : event.timezone} />
              {bestMode === 'crowd'
                // never round a partial attendee away: below one person on average,
                // count everyone who shows up at all instead
                ? Math.round(bw.avg) >= 1
                  ? <span className="text-[12.5px] font-semibold text-teal-text">around {Math.round(bw.avg)} of {viewTotal} there{bw.count > 0 && <span className="font-normal text-dim"> · {bw.count} the whole time</span>}</span>
                  : <span className="text-[12.5px] font-semibold text-teal-text">{bw.anyIds.length} of {viewTotal} there for part of it</span>
                : <span className="text-[12.5px] font-semibold text-teal-text">{bw.count} of {viewTotal} free</span>}
              <div className="ml-auto"><AvatarRow people={(bestMode === 'crowd' ? bw.anyIds : bw.ids).map(avatarOf)} size={22} max={8} overlap={5} /></div>
            </>
          ) : responded > 0 ? (
            <span className="text-[12.5px] text-dim">No block long enough for a <span className="font-semibold text-text">{fmtDur(durationMin)}</span> event yet. Try a shorter length, or wait for more responses.</span>
          ) : (
            <span className="text-[12.5px] text-dim">No availability yet. Add yours in <span className="font-semibold text-text">Edit mine</span> to start finding the best time.</span>
          )}
        </div>}
      </div>

      {/* undo toast — floats above the mobile tab bar, gone after 8s */}
      {undoTimes && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[84px] z-50 flex justify-center px-4 md:bottom-6">
          <div className="pointer-events-auto flex items-center gap-2.5 rounded-full border border-border bg-s1 py-1.5 pl-4 pr-1.5 text-[13px] shadow-soft">
            Your times were cleared
            <button type="button" onClick={undoClear} className="flex h-8 items-center rounded-full bg-accent px-3.5 text-[13px] font-semibold text-on-accent">
              Undo
            </button>
          </div>
        </div>
      )}

      {importing && (
        <ImportPreview
          provider={importing.provider}
          data={importing.data}
          mine={mine}
          days={event.days}
          tz={event.timezone}
          fmt={fmt}
          gridStartMin={gridStartMin}
          onApply={applyImport}
          onClose={() => setImporting(null)}
        />
      )}
    </div>
  )
}

/* ── clickable participant strip: tap a person to filter the grid to their free times.
   Capped at 8 avatars; the +N chip opens a scrollable picker for everyone else. ── */
const FILTER_CAP = 8
function FilterAvatars({ participants, filter, onToggle }: { participants: Participant[]; filter: Set<string>; onToggle: (id: string) => void }) {
  const shown = participants.slice(0, FILTER_CAP)
  const extra = participants.slice(FILTER_CAP)
  const active = filter.size > 0
  const extraOn = extra.filter((p) => filter.has(p.id)).length
  return (
    <span className="flex items-center">
      {shown.map((p, i) => {
        const on = filter.has(p.id)
        return (
          <button
            key={p.id} type="button" onClick={() => onToggle(p.id)}
            title={on ? `${p.name} · click to unfilter` : `${p.name} · see when they are free`}
            className={`relative rounded-full transition-opacity ${i > 0 ? '-ml-[5px]' : ''}`}
            style={{ boxShadow: on ? '0 0 0 1.5px var(--s1), 0 0 0 3.5px var(--accent)' : undefined, opacity: active && !on ? 0.35 : 1, zIndex: on ? 1 : undefined }}
          >
            <Avatar initials={p.initials} color={p.color} size={25} font={9.5} ring />
          </button>
        )
      })}
      {extra.length > 0 && (
        <Popover width={236} align="start" className="ml-1.5" trigger={(open) => (
          <span className={`grid h-[25px] min-w-[25px] place-items-center rounded-full border px-1.5 text-[10.5px] font-bold ${extraOn > 0 ? 'border-accent-border bg-accent-bg text-accent-text' : `border-border2 text-dim ${open ? 'bg-s2' : 'bg-s1'}`}`}>
            +{extra.length}
          </span>
        )}>
          {() => <FilterPickList extra={extra} filter={filter} onToggle={onToggle} />}
        </Popover>
      )}
    </span>
  )
}

/* the overflow picker: searchable once the list is long enough that scanning stops working */
function FilterPickList({ extra, filter, onToggle }: { extra: Participant[]; filter: Set<string>; onToggle: (id: string) => void }) {
  const [q, setQ] = useState('')
  const list = q.trim() ? extra.filter((p) => p.name.toLowerCase().includes(q.trim().toLowerCase())) : extra
  return (
    <div className="flex flex-col p-0.5">
      {extra.length > 8 && (
        <div className="mb-1 flex items-center gap-1.5 rounded-[8px] border border-border bg-s0 px-2 focus-within:border-border2">
          <Search size={12} className="flex-none text-faint" />
          <input
            autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a person"
            className="h-7 w-full min-w-0 bg-transparent text-[13px] outline-none placeholder:text-faint"
          />
        </div>
      )}
      <div className="scroll-slim flex max-h-[264px] flex-col overflow-auto">
        {list.map((p) => {
          const on = filter.has(p.id)
          return (
            <button key={p.id} type="button" onClick={() => onToggle(p.id)} className={`flex items-center gap-2 rounded-[7px] px-2 py-1.5 text-left text-[13px] font-medium hover:bg-s2 ${on ? 'bg-s2' : ''}`}>
              <Avatar initials={p.initials} color={p.color} size={22} font={9} />
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
              {on && <Check size={13} className="flex-none text-accent-text" />}
            </button>
          )
        })}
        {list.length === 0 && <span className="px-2 py-1.5 text-[12.5px] text-faint">No one matches.</span>}
      </div>
    </div>
  )
}

/* ── import preview: confirm what the calendar import will mark before it lands ── */
function ImportPreview({ provider, data, mine, days, tz, fmt, gridStartMin, onApply, onClose }: {
  provider: string
  data: Record<string, DayImport> | null
  mine: Record<string, Iv[]>
  days: AppEvent['days']
  tz: string
  fmt: (min: number) => string
  gridStartMin: number
  onApply: () => void
  onClose: () => void
}) {
  const card = useRef<HTMLDivElement>(null)
  useGSAP(() => { gsap.fromTo(card.current, { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.3, ease: 'power3.out' }) }, { scope: card })
  const totalBusy = data ? Object.values(data).reduce((n, d) => n + d.busy.length, 0) : 0

  // only what the import would ADD — everything already marked stays untouched
  const addedFor = (dayKey: string): Iv[] => {
    let added = data?.[dayKey]?.free ?? []
    for (const iv of mine[dayKey] ?? []) added = added.flatMap((a) => subtract(a, iv.s, iv.e))
    return added.filter((a) => a.e > a.s)
  }
  const anyAdded = !!data && days.some((d) => addedFor(d.key).length > 0)

  return (
    <div className="absolute inset-0 z-40 grid place-items-center bg-[rgba(0,0,0,.25)] p-4" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div ref={card} className="flex max-h-full w-full max-w-[460px] flex-col rounded-2xl border border-border bg-s1 shadow-soft">
        <div className="border-b border-border px-5 py-4">
          <div className="text-[12px] font-semibold uppercase tracking-[.13em] text-faint">Import preview</div>
          <div className="mt-1 flex items-center gap-2 text-[15.5px] font-semibold">{provider} <TimezonePill tz={tz} /></div>
        </div>

        {data ? (
          <>
            <div className="scroll-slim min-h-0 flex-1 overflow-auto px-5 py-3">
              <p className="mb-2.5 text-[13px] leading-[1.5] text-dim">
                We found {totalBusy} busy {totalBusy === 1 ? 'block' : 'blocks'} on your calendar. They came in as exact moments and are shown here in event time, so they line up even if your calendar uses a different timezone. Applying only adds the times below — nothing you&apos;ve already marked is changed or removed.
              </p>
              {days.filter((d) => data[d.key]).map((d) => {
                const di = data[d.key]
                const added = addedFor(d.key)
                return (
                  <div key={d.key} className="flex gap-3 border-t border-border py-2 text-[13px] first:border-t-0">
                    <span className="w-[76px] flex-none font-semibold text-dim">{d.dow} {d.date}</span>
                    <span className="min-w-0 flex-1 leading-[1.55]">
                      {di.free.length === 0
                        ? <span className="font-semibold text-brick-text">Busy the whole day</span>
                        : added.length === 0
                          ? <span className="text-faint">Already covered by your times</span>
                          : added.map((iv, i) => (
                              <span key={i} className="mr-1.5 inline-block whitespace-nowrap rounded-[6px] border border-teal-border bg-teal-bg px-1.5 py-px text-[12px] font-semibold text-teal-text">
                                {fmt(gridStartMin + iv.s)} – {fmt(gridStartMin + iv.e)}
                              </span>
                            ))}
                      {di.busy.length > 0 && <span className="text-[12px] text-faint">· {di.busy.length} busy</span>}
                    </span>
                  </div>
                )
              })}
              <p className="mt-2.5 text-[12px] leading-[1.5] text-faint">Simulated calendar for now. Provider sign-in arrives with calendar sync.</p>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3.5">
              {!anyAdded && <span className="mr-auto text-[12.5px] text-faint">Nothing new to add — you&apos;ve already covered these times.</span>}
              <button onClick={onClose} className="flex h-9 items-center rounded-[9px] border border-border2 bg-s1 px-3.5 text-[13.5px] font-semibold hover:bg-s2">{anyAdded ? 'Cancel' : 'Close'}</button>
              {anyAdded && <button onClick={onApply} className="flex h-9 items-center gap-1.5 rounded-[9px] bg-accent px-3.5 text-[13.5px] font-semibold text-on-accent"><Check size={15} /> Add these times</button>}
            </div>
          </>
        ) : (
          <>
            <p className="px-5 py-4 text-[13.5px] leading-[1.55] text-dim">Calendar import isn&apos;t available for this sample event. Create an event of your own to try it.</p>
            <div className="flex items-center justify-end border-t border-border px-5 py-3.5">
              <button onClick={onClose} className="flex h-9 items-center rounded-[9px] border border-border2 bg-s1 px-3.5 text-[13.5px] font-semibold hover:bg-s2">Close</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/* ── import from calendar (availability stage): connect a provider and auto-fill busy times ── */
function ImportFromCalendar({ onPick }: { onPick: (provider: string) => void }) {
  const [open, setOpen] = useState(false)
  const panelRef = useClampX(open)
  const wrap = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('pointerdown', onDown); window.removeEventListener('keydown', onKey) }
  }, [open])

  return (
    <div ref={wrap} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`flex h-7 items-center gap-1.5 rounded-lg border bg-s1 px-[11px] text-[13px] font-medium hover:border-border2 ${open ? 'border-border2' : 'border-border'}`}
      >
        <CalendarPlus size={15} /> <span className="sm:hidden">Import</span><span className="hidden sm:inline">Import from calendar</span> <ChevronDown size={13} className={`text-faint transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div ref={panelRef} className="absolute left-0 top-full z-[35] mt-1 w-[248px] max-w-[calc(100vw-16px)] rounded-[10px] border border-border bg-s1 p-1 shadow-soft">
          <p className="px-2.5 pb-1.5 pt-2 text-[12px] leading-[1.45] text-faint">
            Connect a calendar and your free times fill in automatically, with a review before anything is saved.
          </p>
          {(['Google Calendar', 'Outlook'] as const).map((name) => (
            <button key={name} type="button" onClick={() => { setOpen(false); onPick(name) }} className="flex w-full items-center gap-2 rounded-[7px] px-2.5 py-2 text-left text-[13.5px] font-medium hover:bg-s2">
              <CalendarPlus size={15} className="text-accent-text" /> {name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* nudge an anchored panel back inside the viewport — same trick as the shared Popover */
function useClampX(open: boolean) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!open || !el) return
    el.style.transform = ''
    const r = el.getBoundingClientRect()
    const pad = 8
    const dx = r.left < pad ? pad - r.left : r.right > window.innerWidth - pad ? window.innerWidth - pad - r.right : 0
    if (dx) el.style.transform = `translateX(${dx}px)`
  }, [open])
  return ref
}

/* ── clear all my times — instant, because the undo toast makes it reversible ── */
function ClearTimes({ onClear }: { onClear: () => void }) {
  return (
    <button
      type="button"
      onClick={onClear}
      className="flex h-7 items-center gap-1.5 rounded-lg border border-border bg-s1 px-[11px] text-[13px] font-medium text-dim hover:border-border2 hover:text-brick-text"
    >
      <Eraser size={15} /> <span className="sm:hidden">Clear</span><span className="hidden sm:inline">Clear my times</span>
    </button>
  )
}

function EdgeHandle({ pct, label, active, side, onDown }: { pct: number; label: string; active: boolean; side: 'above' | 'below'; onDown: (e: React.PointerEvent) => void }) {
  const color = active ? '#8A6A2E' : '#C2A468'
  return (
    <div className="pointer-events-none absolute inset-x-0 z-[9]" style={{ top: `${pct}%` }}>
      {/* boundary line */}
      <div className="absolute inset-x-0 top-0 -translate-y-1/2 border-t-2" style={{ borderColor: color }} />
      {/* timestamp, kept outside the block: start above the top handle, end below the bottom handle */}
      <span
        className="absolute left-1/2 whitespace-nowrap rounded-full border bg-s1 px-1.5 py-px text-[10px] font-semibold tabular-nums shadow-soft"
        style={{ top: 0, transform: `translate(-50%, ${side === 'above' ? 'calc(-50% - 15px)' : 'calc(-50% + 15px)'})`, borderColor: color, color: '#7A531F' }}
      >
        {label}
      </span>
      {/* grip, centered on the boundary and lifted above the boxes */}
      <button
        type="button"
        onPointerDown={onDown}
        className="pointer-events-auto absolute left-1/2 top-0 grid h-[15px] w-[26px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border bg-s1 shadow-soft"
        style={{ borderColor: color, color, touchAction: 'none' }}
        aria-label={`Adjust time, currently ${label}`}
      >
        <GripHorizontal size={12} />
      </button>
    </div>
  )
}

/* ── how long the event needs — drives the best-window search (set in the Settings popover) ── */
function fmtDur(m: number) { return m < 60 ? `${m}m` : m % 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m / 60}h` }

/* ── quick-fill presets (edit mode): fill a standard block across every visible day,
   or the whole event in one tap for the always-free ── */
function PresetFills({ onFill, onFillAll }: { onFill: (startClock: number, endClock: number) => void; onFillAll: () => void }) {
  const P = [{ l: 'Morning', s: 8 * 60, e: 12 * 60 }, { l: 'Afternoon', s: 12 * 60, e: 17 * 60 }, { l: 'Evening', s: 17 * 60, e: 21 * 60 }]
  return (
    <span className="flex flex-wrap items-center gap-1 text-[12px] text-faint">
      Quick fill:
      {P.map((p) => (
        <button key={p.l} onClick={() => onFill(p.s, p.e)} className="rounded-full border border-border bg-s1 px-2 py-0.5 text-[12px] font-medium text-dim hover:border-border2 hover:text-text">{p.l}</button>
      ))}
      <button onClick={onFillAll} title="Mark yourself free for every time on every day" className="rounded-full border border-accent-border bg-accent-bg px-2 py-0.5 text-[12px] font-semibold text-accent-text">
        Free for all of it
      </button>
    </span>
  )
}

/* ── who hasn't responded, with a (stub) nudge ── */
function MissingPopover({ missing, nudged, onNudge, onNudgeAll, onClose }: { missing: Participant[]; nudged: Set<string>; onNudge: (id: string) => void; onNudgeAll: () => void; onClose: () => void }) {
  const wrap = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onDown = (e: PointerEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) onClose() }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('pointerdown', onDown); window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('pointerdown', onDown); window.removeEventListener('keydown', onKey) }
  }, [onClose])
  const allNudged = missing.every((p) => nudged.has(p.id))
  return (
    <div ref={wrap} className="absolute left-0 top-full z-[35] mt-1 w-[244px] rounded-[10px] border border-border bg-s1 p-2 shadow-soft">
      <div className="flex items-center justify-between px-1 pb-1.5">
        <span className="text-[12px] font-semibold uppercase tracking-[.1em] text-faint">Waiting on {missing.length}</span>
        <button onClick={onNudgeAll} disabled={allNudged} className="flex items-center gap-1 text-[12px] font-semibold text-accent-text disabled:text-faint"><Bell size={12} /> Nudge all</button>
      </div>
      <div className="scroll-slim flex max-h-[220px] flex-col gap-0.5 overflow-auto">
        {missing.map((p) => {
          const done = nudged.has(p.id)
          return (
            <div key={p.id} className="flex items-center gap-2 rounded-[7px] px-1 py-1">
              <Avatar initials={p.initials} color={p.color} size={25} font={10} />
              <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{p.name}</span>
              <button onClick={() => onNudge(p.id)} disabled={done} className={`flex h-6 items-center gap-1 rounded-[6px] px-2 text-[12px] font-semibold ${done ? 'text-teal-text' : 'border border-border2 hover:bg-s2'}`}>
                {done ? <><Check size={12} /> Nudged</> : <><Bell size={12} /> Nudge</>}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── view-mode cell breakdown: who's free in each subsection of the block.
   Names are tap-to-filter, and the list scrolls so everyone free is reachable. ── */
function CellDetail({ bands, total, fmt, gridStartMin, avatarOf, onPerson, filter, style, onClose }: {
  bands: Band[]; total: number; fmt: (m: number) => string; gridStartMin: number
  avatarOf: (id: string) => { initials: string; name: string; color: Participant['color'] }
  onPerson: (id: string) => void; filter: Set<string>
  style: React.CSSProperties; onClose: () => void
}) {
  const wrap = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    const onDown = (e: PointerEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) onClose() }
    window.addEventListener('keydown', onKey); window.addEventListener('pointerdown', onDown)
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('pointerdown', onDown) }
  }, [onClose])
  return (
    <div
      ref={wrap}
      onClick={(e) => e.stopPropagation()}
      style={style}
      className="absolute z-40 w-[222px] rounded-[11px] border border-border2 bg-s1 p-2.5 shadow-soft"
    >
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[.1em] text-faint">Who&apos;s free</span>
        <button onClick={onClose} aria-label="Close" className="text-faint hover:text-text"><X size={13} /></button>
      </div>
      <div className="flex max-h-[240px] flex-col gap-2 overflow-auto scroll-slim">
        {bands.map((b, i) => (
          <div key={i} className="border-t border-border pt-1.5 first:border-t-0 first:pt-0">
            <div className="mb-1 flex items-center justify-between text-[12px]">
              <span className="font-semibold">{fmt(gridStartMin + b.s)} – {fmt(gridStartMin + b.e)}</span>
              <span className="text-dim">{b.ids.length}/{total}</span>
            </div>
            {b.ids.length === 0 ? (
              <span className="text-[12px] text-faint">No one free</span>
            ) : (
              <div className="flex flex-wrap gap-1">
                {b.ids.map((id) => { const a = avatarOf(id); const on = filter.has(id); return (
                  <button
                    key={id} type="button" onClick={() => onPerson(id)}
                    title={on ? `Stop filtering to ${a.name}` : `Filter the grid to ${a.name}`}
                    className={`flex items-center gap-1 rounded-full py-0.5 pl-0.5 pr-1.5 ${on ? 'bg-accent-bg text-accent-text' : 'bg-s2 hover:bg-s3'}`}
                  >
                    <Avatar initials={a.initials} color={a.color} size={18} font={8.5} />
                    <span className="text-[11px] font-medium">{a.name}</span>
                    {on && <Check size={11} className="text-accent-text" />}
                  </button>
                ) })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── small controls ── */
function Segment({ value, onChange, options, compact }: { value: string; onChange: (v: string) => void; options: { v: string; l: string }[]; compact?: boolean }) {
  return (
    <div className="inline-flex w-fit rounded-[9px] bg-s2 p-0.5">
      {options.map((o) => (
        <button key={o.v} onClick={() => onChange(o.v)} className={`flex h-7 items-center rounded-[7px] font-semibold transition-colors ${compact ? 'px-2.5 text-[12.5px]' : 'px-3 text-[13px]'} ${value === o.v ? 'bg-s0 text-text shadow-soft' : 'text-dim hover:text-text'}`}>
          {o.l}
        </button>
      ))}
    </div>
  )
}
// touch-friendly ± stepper for one edge of the selected block (works where arrow keys can't)
function EdgeNudge({ label, value, onLess, onMore }: { label: string; value: string; onLess: () => void; onMore: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-9 flex-none text-[12px] text-dim">{label}</span>
      <div className="flex items-center overflow-hidden rounded-[8px] border border-border2 bg-s1">
        <button type="button" onClick={onLess} className="grid h-8 w-8 place-items-center text-dim hover:bg-s2 active:bg-s3" aria-label={`Move ${label.toLowerCase()} earlier`}><Minus size={14} /></button>
        <span className="min-w-[54px] px-1 text-center text-[12.5px] font-semibold tabular-nums">{value}</span>
        <button type="button" onClick={onMore} className="grid h-8 w-8 place-items-center text-dim hover:bg-s2 active:bg-s3" aria-label={`Move ${label.toLowerCase()} later`}><Plus size={14} /></button>
      </div>
    </div>
  )
}
function IconBtn({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
  return <button type="button" onClick={onClick} disabled={disabled} className="grid h-7 w-7 place-items-center rounded-[7px] border border-border bg-s1 text-dim enabled:hover:text-text disabled:opacity-40">{children}</button>
}
