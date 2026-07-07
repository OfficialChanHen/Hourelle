'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, ChevronDown, CalendarPlus, MessageCircle, X, Send, GripHorizontal, Check, Eraser, TriangleAlert, Bell, Clock } from 'lucide-react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { Avatar } from '@/components/ui/Avatar'
import { AvatarRow } from '@/components/ui/AvatarRow'
import { TimezonePill } from '@/components/ui/TimezonePill'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import {
  patchEvent, availIvOf, intervalsToGrid, normalizeIv, bestWindow, fmtMinute, gridStartMinOf, stepOf,
  type AppEvent, type Participant, type ChatMessage, type Iv, type AvailIntervals,
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
  return r <= 0.25 ? '#EBF1EB' : r <= 0.5 ? '#CFE0D2' : r < 1 ? '#9DBBA4' : '#2E4A3C'
}
function clayFor(n: number) {
  return n <= 2 ? '#F3EAD9' : n <= 4 ? '#EAD9BE' : '#DCC8A2'
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
// absorb slivers too thin to read into their taller neighbor (paint only — tooltips stay exact)
function mergeSlivers(bands: Band[], minDur: number): Band[] {
  const out = bands.map((b) => ({ ...b }))
  let again = true
  while (again && out.length > 1) {
    again = false
    for (let i = 0; i < out.length; i++) {
      if (out[i].e - out[i].s >= minDur) continue
      const prev = out[i - 1], next = out[i + 1]
      const into = !prev ? next : !next ? prev : (prev.e - prev.s >= next.e - next.s ? prev : next)
      if (into) { into.s = Math.min(into.s, out[i].s); into.e = Math.max(into.e, out[i].e); out.splice(i, 1); again = true; break }
    }
  }
  return out
}
function peakOf(bands: Band[]): Band {
  return bands.reduce((m, b) => (b.ids.length > m.ids.length ? b : m))
}

export function AvailabilityPanel({ event }: { event: AppEvent }) {
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
  // chat lives here (not in ChatPanel) so it survives closing/reopening the panel
  const [messages, setMessages] = useState<ChatMessage[]>(event.messages)

  const youAny = event.days.some((d) => (mine[d.key]?.length ?? 0) > 0)
  const otherIds = new Set<string>()
  for (const d of event.days) for (const [id, ivs] of Object.entries(others[d.key] ?? {})) if (ivs.length) otherIds.add(id)
  const responded = otherIds.size + (youAny ? 1 : 0)

  const [mode, setMode] = useState<Mode>(responded === 0 ? 'edit' : 'view')
  const [h24, setH24] = useState(false)
  const [myTime, setMyTime] = useState(false) // show times in the viewer's local zone
  const [durationMin, setDurationMin] = useState(event.durationMin ?? 60)
  const [detail, setDetail] = useState<{ day: string; ti: number; cx: number; cyTop: number; cyBottom: number; below: boolean } | null>(null) // view-mode cell breakdown
  const [showMissing, setShowMissing] = useState(false)
  const [nudged, setNudged] = useState<Set<string>>(new Set())
  const [chatOpen, setChatOpen] = useState(true)
  const [sel, setSel] = useState<Sel | null>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [page, setPage] = useState(0)
  // row virtualization: only the visible slice of time rows is mounted.
  // starts at 0 to match the un-scrolled DOM; the mount effect jumps to ~8 AM
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportH, setViewportH] = useState(460)
  // provider picked → preview of what would be imported (null data = unavailable for this event)
  const [importing, setImporting] = useState<{ provider: string; data: Record<string, DayImport> | null } | null>(null)

  const WEEK = 7
  const pageCount = Math.max(1, Math.ceil(event.days.length / WEEK))
  const weekDays = event.days.slice(page * WEEK, page * WEEK + WEEK)
  const goWeek = (dir: -1 | 1) => { setPage((p) => Math.max(0, Math.min(pageCount - 1, p + dir))); setSel(null) }

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
    const ro = new ResizeObserver(() => setViewportH(el.clientHeight))
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
  // quick-fill: add a clock-time block to every visible day at once
  function fillPreset(startClock: number, endClock: number) {
    const s = Math.max(0, Math.min(gridMax, startClock - gridStartMin))
    const e = Math.max(0, Math.min(gridMax, endClock - gridStartMin))
    if (e <= s) return
    setMine((pm) => {
      const next = { ...pm }
      for (const d of weekDays) next[d.key] = normalizeIv([...(pm[d.key] ?? []), { s, e }])
      persist(next)
      return next
    })
    setSel(null)
  }
  function nudge(id: string) {
    setNudged((prev) => new Set(prev).add(id)) // stub: real build sends a reminder email
  }
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
  function combinedFor(day: string, liveMine?: Iv[]): Record<string, Iv[]> {
    const m = liveMine ?? mine[day] ?? []
    return m.length ? { ...(others[day] ?? {}), JM: m } : { ...(others[day] ?? {}) }
  }

  // ── coordinate + snapping helpers ──
  const snap5 = (m: number) => Math.max(0, Math.min(gridMax, Math.round(m / 5) * 5))
  const rowStart = (m: number) => Math.max(0, Math.min(gridMax - step, Math.floor(m / step) * step))

  function onCellDown(e: React.PointerEvent, day: string, ti: number) {
    if (mode !== 'edit') return
    e.preventDefault()
    const r = e.currentTarget.getBoundingClientRect()
    const gridMin = Math.max(0, Math.min(gridMax, ti * step + ((e.clientY - r.top) / r.height) * step))
    const hit = (mine[day] ?? []).find((iv) => gridMin >= iv.s && gridMin <= iv.e)
    if (hit) { setSel({ day, s: hit.s, e: hit.e, edge: 'bottom' }); return } // click a block → select, never toggle off
    const a = rowStart(gridMin)
    const d: Drag = { kind: 'paint', day, anchorClientY: e.clientY, anchorScrollTop: scroller.current?.scrollTop ?? 0, anchorMin: gridMin, block: { s: a, e: a + step } }
    dragRef.current = d; setDrag(d); setSel(null)
  }
  function onHandleDown(e: React.PointerEvent, edge: Edge) {
    e.preventDefault(); e.stopPropagation()
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

  // keyboard: arrow-nudge the active edge by the minute, Esc to deselect, Del to remove
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
        const delta = ev.key === 'ArrowUp' ? -1 : 1
        let ns = s.s, ne = s.e
        if (s.edge === 'top') ns = Math.max(0, Math.min(s.e - MIN_LEN, s.s + delta))
        else ne = Math.min(gridMax, Math.max(s.s + MIN_LEN, s.e + delta))
        if (ns === s.s && ne === s.e) return
        const base = (mineRef.current[s.day] ?? []).filter((iv) => !(iv.s === s.s && iv.e === s.e))
        const norm = commitDay(s.day, [...base, { s: ns, e: ne }])
        selectMerged(s.day, norm, (ns + ne) / 2, s.edge)
      }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [sel]) // eslint-disable-line react-hooks/exhaustive-deps

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
    const allFull = weekDays.every((d) => (mine[d.key] ?? []).some((iv) => iv.s <= w0 && iv.e >= w1))
    for (const d of weekDays) {
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

  function clearAllMine() {
    const next = Object.fromEntries(event.days.map((d) => [d.key, [] as Iv[]]))
    setMine(next); persist(next)
    setSel(null)
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

  function sendMessage(text: string) {
    setMessages((prev) => { const next = [...prev, { id: 'JM', name: 'You', time: 'now', text, you: true }]; if (!event.demo) patchEvent(event.id, { messages: next }); return next })
  }

  // Scalability: cell rendering must not be O(cells × people). Build each day's combined
  // intervals ONCE per render (not once per cell), so the grid scales with days, not
  // days × rows × participants — the difference between fine and janky at 100+ people.
  const combinedByDay = useMemo<AvailIntervals>(
    () => Object.fromEntries(event.days.map((d) => [d.key, combinedFor(d.key)])),
    [mine, others], // eslint-disable-line react-hooks/exhaustive-deps
  )
  // live per-day intervals while editing (folds in the current drag); only the dragged day changes
  const editIvsByDay = useMemo<Record<string, Iv[]>>(
    () => (mode === 'edit' ? Object.fromEntries(weekDays.map((d) => [d.key, renderIvsFor(d.key)])) : {}),
    [mode, mine, drag, page], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const editCombinedByDay = useMemo<Record<string, Record<string, Iv[]>>>(
    () => (mode === 'edit' ? Object.fromEntries(weekDays.map((d) => [d.key, combinedFor(d.key, editIvsByDay[d.key])])) : {}),
    [mode, editIvsByDay, others, page], // eslint-disable-line react-hooks/exhaustive-deps
  )

  // best window (live interval sweep — most people simultaneously free, longest such stretch)
  const bw = useMemo(() => bestWindow(combinedByDay, event.days, durationMin), [combinedByDay, durationMin]) // eslint-disable-line react-hooks/exhaustive-deps

  // who still hasn't marked any availability (to nudge)
  const respondedIds = new Set(otherIds); if (youAny) respondedIds.add('JM')
  const missing = event.participants.filter((p) => !respondedIds.has(p.id) && p.rsvp !== 'not_going')
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

  return (
    <div className="relative flex flex-col rounded-2xl border border-border bg-s1 lg:h-[calc(100dvh-300px)] lg:max-h-[820px] lg:min-h-[480px] lg:flex-row">
      <div ref={colRef} className="relative flex min-w-0 flex-1 flex-col p-4">
        {/* toolbar */}
        <div className="flex flex-wrap items-center gap-[9px] border-b border-border pb-[13px]">
          <SegmentedControl size="sm" value={mode} onChange={(v) => { setMode(v as Mode); setSel(null); setDetail(null) }} options={[{ v: 'view', l: 'View' }, { v: 'edit', l: 'Edit mine' }]} />
          <span className="h-5 w-px bg-border" />
          <div className="flex items-center gap-[3px]">
            <IconBtn onClick={() => goWeek(-1)} disabled={page === 0}><ChevronLeft size={15} /></IconBtn>
            <span className="px-1 text-center text-[12px] font-semibold leading-tight">
              {rangeLabel}
              {pageCount > 1 && <span className="ml-1 font-medium text-faint">· Week {page + 1}/{pageCount}</span>}
            </span>
            <IconBtn onClick={() => goWeek(1)} disabled={page >= pageCount - 1}><ChevronRight size={15} /></IconBtn>
          </div>
          {canConvert ? (
            <button onClick={() => setMyTime((m) => !m)} title="Toggle timezone" className="flex h-7 items-center gap-1.5 rounded-lg border border-border bg-s1 px-[10px] text-[11px] hover:border-border2">
              Times in <TimezonePill tz={myTime ? localTz : event.timezone} /> {myTime && <span className="text-faint">(yours)</span>}
            </button>
          ) : (
            <span className="flex items-center gap-1.5 text-[11px] text-dim">Times in <TimezonePill tz={event.timezone} /></span>
          )}
          <ImportFromCalendar onPick={startImport} />
          {youAny && <ClearTimes onClear={clearAllMine} />}
          <div className="flex-1" />
          <DurationPicker value={durationMin} onChange={changeDuration} />
          <Segment value={h24 ? '24' : '12'} onChange={(v) => setH24(v === '24')} options={[{ v: '12', l: '12h' }, { v: '24', l: '24h' }]} compact />
          {!chatOpen && (
            // side-panel reopen — on stacked layouts the bottom bar below takes over
            <button onClick={() => setChatOpen(true)} className="hidden h-7 items-center gap-1.5 rounded-lg border border-border bg-s1 px-[11px] text-[11.5px] font-semibold hover:border-border2 lg:flex">
              <MessageCircle size={13} /> Discussion
              {messages.length > 0 && <span className="flex h-[15px] items-center rounded-[10px] bg-accent px-[5px] text-[9px] text-on-accent">{messages.length}</span>}
            </button>
          )}
        </div>

        {/* participants + edit hint */}
        <div className="flex flex-wrap items-center gap-2.5 py-[11px]">
          <span className="text-[11px] text-dim">Participants</span>
          <AvatarRow people={event.participants.map((p) => ({ initials: p.initials, name: p.name, color: p.color }))} size={22} max={8} overlap={5} />
          {/* responded count opens the who's-missing / nudge popover */}
          <div className="relative">
            <button
              onClick={() => missing.length && setShowMissing((s) => !s)}
              className={`ml-1.5 flex items-center gap-1 text-[11px] ${missing.length ? 'text-accent-text hover:underline' : 'text-dim'}`}
            >
              {responded} of {total} responded{missing.length > 0 && <ChevronDown size={12} className={showMissing ? 'rotate-180' : ''} />}
            </button>
            {showMissing && missing.length > 0 && (
              <MissingPopover missing={missing} nudged={nudged} onNudge={nudge} onNudgeAll={nudgeAll} onClose={() => setShowMissing(false)} />
            )}
          </div>
          {mode === 'edit' && <PresetFills onFill={fillPreset} />}
          {mode === 'edit' && (
            <span className="text-[11px] text-faint">· Drag to block out time, or arrow keys to nudge a selected block by the minute.</span>
          )}
          {/* heat legend — quiet, reads left to right like the ramp */}
          <span className="ml-auto flex items-center gap-1 text-[10px] text-faint">
            {mode === 'edit' && (
              <>
                <span className="h-[11px] w-[11px] rounded-[3px]" style={{ background: '#EAD9BE', border: '1.5px solid #7A531F' }} />
                <span className="mr-1.5">You</span>
              </>
            )}
            <span>No one</span>
            {['var(--s2)', '#EBF1EB', '#CFE0D2', '#9DBBA4', '#2E4A3C'].map((c) => (
              <span key={c} className="h-[11px] w-[11px] rounded-[3px] border border-border" style={{ background: c }} />
            ))}
            <span>Everyone</span>
          </span>
        </div>

        {/* grid */}
        <div ref={scroller} onScroll={onGridScroll} className="scroll-slim max-h-[58dvh] flex-1 overflow-auto rounded-[10px] border border-border lg:max-h-none">
          <div className="grid min-w-[520px]" style={{ gridTemplateColumns: `54px repeat(${weekDays.length}, minmax(72px, 1fr))` }}>
            {/* header row */}
            <div className="sticky top-0 z-[25] border-b border-r border-border bg-s0" />
            {weekDays.map((d) => {
              const dayFull = mode === 'edit' && mine[d.key]?.length === 1 && mine[d.key][0].s === 0 && mine[d.key][0].e === gridMax
              return (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => toggleDay(d.key)}
                  className="sticky top-0 z-20 border-b border-r border-border px-1.5 py-2 text-center"
                  style={{ background: d.best ? 'var(--teal-bg)' : 'var(--s0)', borderBottomColor: d.best ? 'var(--teal-border)' : 'var(--border)', cursor: mode === 'edit' ? 'pointer' : 'default' }}
                  title={mode === 'edit' ? 'Click to fill the whole day' : undefined}
                >
                  <div className="text-[10px] text-dim">{d.dow}</div>
                  <div className="text-[12.5px] font-semibold" style={{ color: d.best ? 'var(--teal-text)' : 'var(--text)' }}>{d.date}</div>
                  {mode === 'edit' && (
                    <span className={`mx-auto mt-[3px] grid h-4 w-4 place-items-center rounded-[5px] border ${dayFull ? 'border-accent bg-accent text-on-accent' : 'border-border2 text-transparent'}`}>
                      <Check size={10} />
                    </span>
                  )}
                  {d.best && mode === 'view' && <span className="mt-[3px] inline-block rounded-[5px] border border-teal-border bg-teal-bg px-[5px] py-px text-[8.5px] font-semibold text-teal-text">Best day</span>}
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
              const rowFull = weekDays.every((d) => (mine[d.key] ?? []).some((iv) => iv.s <= w0 && iv.e >= w1))
              return (
              <div key={ti} className="contents">
                <button
                  type="button"
                  onClick={() => toggleTime(ti)}
                  className="flex items-center justify-center gap-1 border-b border-r border-border bg-s0 p-1 text-[10.5px] font-medium text-dim"
                  style={{ cursor: mode === 'edit' ? 'pointer' : 'default' }}
                  title={mode === 'edit' ? 'Click to fill this time across the week' : undefined}
                >
                  {mode === 'edit' && (
                    <span className={`grid h-3.5 w-3.5 flex-none place-items-center rounded-[4px] border ${rowFull ? 'border-accent bg-accent text-on-accent' : 'border-border2 text-transparent'}`}>
                      <Check size={9} />
                    </span>
                  )}
                  <span className="flex flex-col items-center leading-[1.15]">
                    <span>{labelMain}</span>
                    {labelSub && <span className="text-[8.5px] font-semibold tracking-[.04em] text-faint">{labelSub}</span>}
                  </span>
                </button>
                {weekDays.map((d) => {
                  if (mode === 'view') {
                    const bands = cellBands(combinedByDay[d.key] ?? {}, w0, w1)
                    const peak = peakOf(bands)
                    const n = peak.ids.length
                    const paint = mergeSlivers(bands, minBandDur)
                    const title = bands.length === 1
                      ? (n ? `${n} of ${total} free` : 'No one free')
                      : bands.map((b) => `${fmt(gridStartMin + b.s)} – ${fmt(gridStartMin + b.e)}: ${b.ids.length} free`).join('\n')
                    const open = detail?.day === d.key && detail?.ti === ti
                    return (
                      <div
                        key={d.key}
                        onClick={(e) => openDetail(e, d.key, ti)}
                        className="relative min-h-[50px] cursor-pointer border-b border-r border-border"
                        style={{ boxShadow: (open ? true : d.best) ? `inset 0 0 0 ${open ? 1.5 : 1}px ${open ? 'var(--accent)' : 'var(--teal-border)'}` : undefined }}
                        title={title}
                      >
                        {paint.map((b, k) => (
                          <div
                            key={k}
                            className="pointer-events-none absolute inset-x-0"
                            style={{
                              top: `${((b.s - w0) / step) * 100}%`,
                              height: `${((b.e - b.s) / step) * 100}%`,
                              background: heat(b.ids.length, total),
                              borderTop: b.s > w0 ? '1px dashed var(--border2)' : undefined,
                            }}
                          />
                        ))}
                        {/* cap the pile so a 100-person cell renders ~6 avatars + "+N", not 100 nodes */}
                        <div className="relative z-[1] flex flex-wrap content-start gap-0.5 p-[5px]">
                          {peak.ids.slice(0, AVATAR_CAP).map((id) => { const a = avatarOf(id); return <Avatar key={id} initials={a.initials} color={a.color} size={15} font={7.5} title={a.name} /> })}
                          {n > AVATAR_CAP && <span className="grid h-[15px] min-w-[15px] place-items-center rounded-full bg-s3 px-[3px] text-[7.5px] font-bold text-dim" title={`${n} free`}>+{n - AVATAR_CAP}</span>}
                        </div>
                        {n > 0 && <span className="pointer-events-none absolute bottom-[3px] right-1 z-[1] text-[8.5px] font-bold" style={{ color: n >= total ? '#F4F1EA' : '#46604F' }}>{n}/{total}</span>}
                      </div>
                    )
                  }
                  // edit mode — others' context tinted at their peak concurrency; my blocks in clay above
                  const oBands = cellBands(others[d.key] ?? {}, w0, w1)
                  const oCount = peakOf(oBands).ids.length
                  const clay = clayFor(oCount)
                  const ivs = editIvsByDay[d.key] ?? []
                  const cnt = peakOf(cellBands(editCombinedByDay[d.key] ?? {}, w0, w1)).ids.length
                  const isTopEdge = !!sel && !dragDel && sel.day === d.key && topCell === ti
                  const isBotEdge = !!sel && !dragDel && sel.day === d.key && botCell === ti
                  return (
                    <div key={d.key} className="relative h-[50px] select-none border-b border-r border-border" style={{ background: heat(oCount, total), boxShadow: d.best ? 'inset 1px 0 0 0 var(--teal-border), inset -1px 0 0 0 var(--teal-border)' : undefined }}>
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
                      {cnt > 0 && <span className="pointer-events-none absolute bottom-[2px] right-1 z-[2] text-[8px] font-bold" style={{ color: cnt >= total ? '#F4F1EA' : '#6E5523' }}>{cnt}/{total}</span>}
                      {/* full-cell hit zone: empty → paint, over a block → select */}
                      <div className="absolute inset-0 z-[5] touch-none" onPointerDown={(e) => onCellDown(e, d.key, ti)} />
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
                            <X size={10} />
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
          const bands = cellBands(combinedByDay[detail.day] ?? {}, detail.ti * step, (detail.ti + 1) * step)
          const W = 222, half = W / 2 + 6
          const colW = colRef.current?.clientWidth ?? 400
          const left = Math.max(half, Math.min(colW - half, detail.cx))
          return (
            <CellDetail
              bands={bands}
              total={total}
              fmt={fmt}
              gridStartMin={gridStartMin}
              avatarOf={avatarOf}
              style={{ left, top: detail.below ? detail.cyBottom + 6 : detail.cyTop - 6, transform: detail.below ? 'translateX(-50%)' : 'translate(-50%, -100%)' }}
              onClose={() => setDetail(null)}
            />
          )
        })()}

        {/* best-window footer */}
        <div className="mt-0.5 flex flex-wrap items-center gap-2.5 border-t border-border px-0.5 pt-3">
          {bw ? (
            <>
              <span className="text-[11px] text-dim">Best {fmtDur(durationMin)} slot</span>
              <span className="text-[12.5px] font-semibold">{bw.dayLabel} · {fmt(gridStartMin + bw.s)} – {fmt(gridStartMin + bw.e)}</span>
              <TimezonePill tz={myTime && canConvert ? localTz : event.timezone} />
              <span className="text-[11px] font-semibold text-teal-text">{bw.count} of {total} free</span>
              <div className="ml-auto"><AvatarRow people={bw.ids.map(avatarOf)} size={20} max={8} overlap={5} /></div>
            </>
          ) : responded > 0 ? (
            <span className="text-[11px] text-dim">No block long enough for a <span className="font-semibold text-text">{fmtDur(durationMin)}</span> event yet. Try a shorter length, or wait for more responses.</span>
          ) : (
            <span className="text-[11px] text-dim">No availability yet. Add yours in <span className="font-semibold text-text">Edit mine</span> to start finding the best time.</span>
          )}
        </div>
      </div>

      {chatOpen && <ChatPanel members={total} messages={messages} onSend={sendMessage} onClose={() => setChatOpen(false)} avatarOf={avatarOf} />}
      {!chatOpen && (
        // stacked layout: reopen the chat right where it appears, at the bottom
        <button
          onClick={() => setChatOpen(true)}
          className="flex items-center justify-center gap-1.5 rounded-b-2xl border-t border-border bg-s0 py-3 text-[12px] font-semibold hover:bg-s2 lg:hidden"
        >
          <MessageCircle size={14} className="text-accent-text" /> Open discussion
          {messages.length > 0 && <span className="flex h-[16px] items-center rounded-[10px] bg-accent px-[6px] text-[9.5px] text-on-accent">{messages.length}</span>}
        </button>
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
          <div className="text-[10.5px] font-semibold uppercase tracking-[.13em] text-faint">Import preview</div>
          <div className="mt-1 flex items-center gap-2 text-[14px] font-semibold">{provider} <TimezonePill tz={tz} /></div>
        </div>

        {data ? (
          <>
            <div className="scroll-slim min-h-0 flex-1 overflow-auto px-5 py-3">
              <p className="mb-2.5 text-[11.5px] leading-[1.5] text-dim">
                We found {totalBusy} busy {totalBusy === 1 ? 'block' : 'blocks'} on your calendar. They came in as exact moments and are shown here in event time, so they line up even if your calendar uses a different timezone. Applying only adds the times below — nothing you&apos;ve already marked is changed or removed.
              </p>
              {days.filter((d) => data[d.key]).map((d) => {
                const di = data[d.key]
                const added = addedFor(d.key)
                return (
                  <div key={d.key} className="flex gap-3 border-t border-border py-2 text-[11.5px] first:border-t-0">
                    <span className="w-[76px] flex-none font-semibold text-dim">{d.dow} {d.date}</span>
                    <span className="min-w-0 flex-1 leading-[1.55]">
                      {di.free.length === 0
                        ? <span className="font-semibold text-brick-text">Busy the whole day</span>
                        : added.length === 0
                          ? <span className="text-faint">Already covered by your times</span>
                          : added.map((iv, i) => (
                              <span key={i} className="mr-1.5 inline-block whitespace-nowrap rounded-[6px] border border-teal-border bg-teal-bg px-1.5 py-px text-[10.5px] font-semibold text-teal-text">
                                {fmt(gridStartMin + iv.s)} – {fmt(gridStartMin + iv.e)}
                              </span>
                            ))}
                      {di.busy.length > 0 && <span className="text-[10.5px] text-faint">· {di.busy.length} busy</span>}
                    </span>
                  </div>
                )
              })}
              <p className="mt-2.5 text-[10.5px] leading-[1.5] text-faint">Simulated calendar for now. Provider sign-in arrives with calendar sync.</p>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3.5">
              {!anyAdded && <span className="mr-auto text-[11px] text-faint">Nothing new to add — you&apos;ve already covered these times.</span>}
              <button onClick={onClose} className="flex h-9 items-center rounded-[9px] border border-border2 bg-s1 px-3.5 text-[12px] font-semibold hover:bg-s2">{anyAdded ? 'Cancel' : 'Close'}</button>
              {anyAdded && <button onClick={onApply} className="flex h-9 items-center gap-1.5 rounded-[9px] bg-accent px-3.5 text-[12px] font-semibold text-on-accent"><Check size={13} /> Add these times</button>}
            </div>
          </>
        ) : (
          <>
            <p className="px-5 py-4 text-[12px] leading-[1.55] text-dim">Calendar import isn&apos;t available for this sample event. Create an event of your own to try it.</p>
            <div className="flex items-center justify-end border-t border-border px-5 py-3.5">
              <button onClick={onClose} className="flex h-9 items-center rounded-[9px] border border-border2 bg-s1 px-3.5 text-[12px] font-semibold hover:bg-s2">Close</button>
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
        className={`flex h-7 items-center gap-1.5 rounded-lg border bg-s1 px-[11px] text-[11.5px] font-medium hover:border-border2 ${open ? 'border-border2' : 'border-border'}`}
      >
        <CalendarPlus size={13} /> Import from calendar <ChevronDown size={12} className={`text-faint transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-[248px] rounded-[10px] border border-border bg-s1 p-1 shadow-soft">
          <p className="px-2.5 pb-1.5 pt-2 text-[10.5px] leading-[1.45] text-faint">
            Connect a calendar and your free times fill in automatically. Busy times import as exact moments, so they stay correct even if your calendar uses a different timezone than this event. You review everything before it&apos;s saved.
          </p>
          {(['Google Calendar', 'Outlook'] as const).map((name) => (
            <button key={name} type="button" onClick={() => { setOpen(false); onPick(name) }} className="flex w-full items-center gap-2 rounded-[7px] px-2.5 py-2 text-left text-[12px] font-medium hover:bg-s2">
              <CalendarPlus size={13} className="text-accent-text" /> {name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── clear all my times, with a warning before anything is committed ── */
function ClearTimes({ onClear }: { onClear: () => void }) {
  const [open, setOpen] = useState(false)
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
        className={`flex h-7 items-center gap-1.5 rounded-lg border bg-s1 px-[11px] text-[11.5px] font-medium text-dim hover:border-border2 hover:text-brick-text ${open ? 'border-border2' : 'border-border'}`}
      >
        <Eraser size={13} /> Clear my times
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-[236px] rounded-[10px] border border-brick-border bg-s1 p-3 shadow-soft">
          <div className="flex items-start gap-2">
            <TriangleAlert size={14} className="mt-px flex-none text-brick-text" />
            <p className="text-[11.5px] leading-[1.5] text-text">
              Clear everything you&apos;ve marked on this event? There is no undo.
            </p>
          </div>
          <div className="mt-2.5 flex items-center justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="flex h-8 items-center rounded-[8px] border border-border2 bg-s1 px-3 text-[11.5px] font-semibold hover:bg-s2">
              Cancel
            </button>
            <button type="button" onClick={() => { setOpen(false); onClear() }} className="flex h-8 items-center gap-1.5 rounded-[8px] px-3 text-[11.5px] font-semibold text-white" style={{ background: 'var(--brick)' }}>
              <Eraser size={12} /> Yes, clear it
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── add-to-calendar export (Google / Outlook compose links) ──
   Not rendered right now on purpose: this returns at the confirmation stage,
   once a time is locked, as the "add the confirmed event to your calendar" action. */
function plusDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d + 1)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

function AddToCalendar({ event, bw, gridStartMin }: { event: AppEvent; bw: ReturnType<typeof bestWindow>; gridStartMin: number }) {
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('pointerdown', onDown); window.removeEventListener('keydown', onKey) }
  }, [open])

  // a timed entry needs a real date + a best window; otherwise export the full date range as all-day
  const timed = bw && /^\d{4}-\d{2}-\d{2}$/.test(bw.dayKey) ? bw : null
  const canExport = !!timed || /^\d{4}-\d{2}-\d{2}$/.test(event.startDate)
  const location = event.location.mode === 'remote'
    ? (event.location.meetingLink || event.location.platform)
    : event.location.places.map((p) => p.name).join(', ')

  function links(): { google: string; outlook: string } {
    const g = new URLSearchParams({ action: 'TEMPLATE', text: event.title, details: event.description, location, ctz: event.timezone })
    const o = new URLSearchParams({ path: '/calendar/action/compose', rru: 'addevent', subject: event.title, body: event.description, location })
    if (timed) {
      const hm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}${String(min % 60).padStart(2, '0')}00`
      const hmc = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}:00`
      const d = timed.dayKey.replace(/-/g, '')
      g.set('dates', `${d}T${hm(gridStartMin + timed.s)}/${d}T${hm(gridStartMin + timed.e)}`)
      o.set('startdt', `${timed.dayKey}T${hmc(gridStartMin + timed.s)}`)
      o.set('enddt', `${timed.dayKey}T${hmc(gridStartMin + timed.e)}`)
    } else {
      const end = plusDay(event.endDate || event.startDate) // end date is exclusive for all-day entries
      g.set('dates', `${event.startDate.replace(/-/g, '')}/${end.replace(/-/g, '')}`)
      o.set('startdt', event.startDate)
      o.set('enddt', end)
      o.set('allday', 'true')
    }
    return {
      google: `https://calendar.google.com/calendar/render?${g}`,
      outlook: `https://outlook.live.com/calendar/0/deeplink/compose?${o}`,
    }
  }
  function exportTo(kind: 'google' | 'outlook') {
    window.open(links()[kind], '_blank', 'noopener')
    setOpen(false)
  }

  if (!canExport) return null
  return (
    <div ref={wrap} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`flex h-7 items-center gap-1.5 rounded-lg border bg-s1 px-[11px] text-[11.5px] font-medium hover:border-border2 ${open ? 'border-border2' : 'border-border'}`}
      >
        <CalendarPlus size={13} /> Add to calendar <ChevronDown size={12} className={`text-faint transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-[228px] rounded-[10px] border border-border bg-s1 p-1 shadow-soft">
          <p className="px-2.5 pb-1.5 pt-2 text-[10.5px] leading-[1.45] text-faint">
            {timed
              ? <>Adds the best time so far: {bw!.dayLabel}, {fmtMinute(gridStartMin + timed.s)} – {fmtMinute(gridStartMin + timed.e)} ({event.timezone.split('/').pop()?.replace(/_/g, ' ')} time).</>
              : <>No best time yet, so this adds the whole date window as an all-day entry.</>}
          </p>
          <button type="button" onClick={() => exportTo('google')} className="flex w-full items-center gap-2 rounded-[7px] px-2.5 py-2 text-left text-[12px] font-medium hover:bg-s2">
            <CalendarPlus size={13} className="text-accent-text" /> Google Calendar
          </button>
          <button type="button" onClick={() => exportTo('outlook')} className="flex w-full items-center gap-2 rounded-[7px] px-2.5 py-2 text-left text-[12px] font-medium hover:bg-s2">
            <CalendarPlus size={13} className="text-accent-text" /> Outlook
          </button>
        </div>
      )}
    </div>
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
        className="absolute left-1/2 whitespace-nowrap rounded-full border bg-s1 px-1.5 py-px text-[9px] font-semibold tabular-nums shadow-soft"
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
        <GripHorizontal size={11} />
      </button>
    </div>
  )
}

/* ── how long the event needs — drives the best-window search ── */
function fmtDur(m: number) { return m < 60 ? `${m}m` : m % 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m / 60}h` }
function DurationPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('pointerdown', onDown); window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('pointerdown', onDown); window.removeEventListener('keydown', onKey) }
  }, [open])
  const OPTS = [30, 60, 90, 120, 180, 240]
  const isCommon = OPTS.includes(value)
  function applyCustom(raw: string) {
    const n = Math.round(Number(raw))
    if (Number.isFinite(n) && n >= 15) { onChange(Math.min(720, n)); setOpen(false) }
  }
  return (
    <div ref={wrap} className="relative">
      <button onClick={() => setOpen((o) => !o)} title="How long the event needs" className="flex h-7 items-center gap-1.5 rounded-lg border border-border bg-s1 px-[10px] text-[11px] hover:border-border2">
        <Clock size={12} className="text-dim" /> Need {fmtDur(value)} <ChevronDown size={12} className={`text-faint ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-[136px] rounded-[10px] border border-border bg-s1 p-1 shadow-soft">
          <div className="px-2 pb-1 pt-1.5 text-[9.5px] font-semibold uppercase tracking-[.1em] text-faint">Event length</div>
          {OPTS.map((m) => (
            <button key={m} onClick={() => { onChange(m); setOpen(false) }} className={`flex w-full items-center justify-between rounded-[7px] px-2 py-1.5 text-[11.5px] ${m === value ? 'bg-accent font-semibold text-on-accent' : 'hover:bg-s2'}`}>
              {fmtDur(m)} {m === value && <Check size={12} />}
            </button>
          ))}
          <div className="mt-1 border-t border-border px-1.5 pb-1 pt-2">
            <div className="mb-1 flex items-center justify-between text-[9.5px] font-semibold uppercase tracking-[.1em] text-faint">
              Custom {!isCommon && <span className="rounded-[4px] bg-accent px-1 py-px text-[8.5px] normal-case tracking-normal text-on-accent">{fmtDur(value)}</span>}
            </div>
            <div className="flex items-center gap-1">
              <input
                type="number" min={15} max={720} step={15}
                defaultValue={isCommon ? '' : value}
                placeholder="mins"
                onKeyDown={(e) => { if (e.key === 'Enter') applyCustom((e.target as HTMLInputElement).value) }}
                onBlur={(e) => e.target.value && applyCustom(e.target.value)}
                className="h-7 w-full rounded-[7px] border border-border bg-s2 px-2 text-[11.5px] outline-none focus:border-accent-border"
              />
              <span className="text-[10px] text-faint">min</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── quick-fill presets (edit mode): fill a standard block across every visible day ── */
function PresetFills({ onFill }: { onFill: (startClock: number, endClock: number) => void }) {
  const P = [{ l: 'Morning', s: 8 * 60, e: 12 * 60 }, { l: 'Afternoon', s: 12 * 60, e: 17 * 60 }, { l: 'Evening', s: 17 * 60, e: 21 * 60 }]
  return (
    <span className="flex items-center gap-1 text-[10.5px] text-faint">
      Quick fill:
      {P.map((p) => (
        <button key={p.l} onClick={() => onFill(p.s, p.e)} className="rounded-full border border-border bg-s1 px-2 py-0.5 text-[10.5px] font-medium text-dim hover:border-border2 hover:text-text">{p.l}</button>
      ))}
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
    <div ref={wrap} className="absolute left-0 top-full z-30 mt-1 w-[244px] rounded-[10px] border border-border bg-s1 p-2 shadow-soft">
      <div className="flex items-center justify-between px-1 pb-1.5">
        <span className="text-[10.5px] font-semibold uppercase tracking-[.1em] text-faint">Waiting on {missing.length}</span>
        <button onClick={onNudgeAll} disabled={allNudged} className="flex items-center gap-1 text-[10.5px] font-semibold text-accent-text disabled:text-faint"><Bell size={11} /> Nudge all</button>
      </div>
      <div className="scroll-slim flex max-h-[220px] flex-col gap-0.5 overflow-auto">
        {missing.map((p) => {
          const done = nudged.has(p.id)
          return (
            <div key={p.id} className="flex items-center gap-2 rounded-[7px] px-1 py-1">
              <Avatar initials={p.initials} color={p.color} size={22} font={9} />
              <span className="min-w-0 flex-1 truncate text-[12px] font-medium">{p.name}</span>
              <button onClick={() => onNudge(p.id)} disabled={done} className={`flex h-6 items-center gap-1 rounded-[6px] px-2 text-[10.5px] font-semibold ${done ? 'text-teal-text' : 'border border-border2 hover:bg-s2'}`}>
                {done ? <><Check size={11} /> Nudged</> : <><Bell size={11} /> Nudge</>}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── view-mode cell breakdown: who's free in each subsection of the block ── */
function CellDetail({ bands, total, fmt, gridStartMin, avatarOf, style, onClose }: {
  bands: Band[]; total: number; fmt: (m: number) => string; gridStartMin: number
  avatarOf: (id: string) => { initials: string; name: string; color: Participant['color'] }; style: React.CSSProperties; onClose: () => void
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
        <span className="text-[10px] font-semibold uppercase tracking-[.1em] text-faint">Who&apos;s free</span>
        <button onClick={onClose} aria-label="Close" className="text-faint hover:text-text"><X size={12} /></button>
      </div>
      <div className="flex max-h-[240px] flex-col gap-2 overflow-auto scroll-slim">
        {bands.map((b, i) => (
          <div key={i} className="border-t border-border pt-1.5 first:border-t-0 first:pt-0">
            <div className="mb-1 flex items-center justify-between text-[10.5px]">
              <span className="font-semibold">{fmt(gridStartMin + b.s)} – {fmt(gridStartMin + b.e)}</span>
              <span className="text-dim">{b.ids.length}/{total}</span>
            </div>
            {b.ids.length === 0 ? (
              <span className="text-[10.5px] text-faint">No one free</span>
            ) : (
              <div className="flex flex-wrap gap-1">
                {b.ids.slice(0, 12).map((id) => { const a = avatarOf(id); return (
                  <span key={id} className="flex items-center gap-1 rounded-full bg-s2 py-0.5 pl-0.5 pr-1.5"><Avatar initials={a.initials} color={a.color} size={16} font={7.5} /><span className="text-[10px]">{a.name}</span></span>
                ) })}
                {b.ids.length > 12 && <span className="self-center text-[10px] text-faint">+{b.ids.length - 12}</span>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── inline chat side panel (controlled by parent) ── */
function ChatPanel({ members, messages, onSend, onClose, avatarOf }: { members: number; messages: ChatMessage[]; onSend: (t: string) => void; onClose: () => void; avatarOf: (id: string) => { initials: string; name: string; color: Participant['color'] } }) {
  const panel = useRef<HTMLDivElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState('')

  useGSAP(() => { gsap.fromTo(panel.current, { x: 18, opacity: 0 }, { x: 0, opacity: 1, duration: 0.4, ease: 'power3.out' }) }, { scope: panel })
  useEffect(() => { if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight }, [messages.length])

  function send() {
    const text = draft.trim()
    if (!text) return
    onSend(text)
    setDraft('')
  }

  return (
    <div ref={panel} className="flex h-[340px] w-full flex-none flex-col overflow-hidden rounded-b-2xl border-t border-border bg-s0 lg:h-auto lg:w-[300px] lg:rounded-b-none lg:rounded-r-2xl lg:border-l lg:border-t-0">
      <div className="flex items-center justify-between border-b border-border px-3.5 py-[13px]">
        <div className="flex items-center gap-1.5 text-[12.5px] font-semibold">
          <MessageCircle size={14} className="text-accent-text" />
          Event discussion
          <span className="rounded-[10px] border border-accent-border bg-accent-bg px-1.5 py-px text-[9.5px] font-semibold text-accent-text">{members} members</span>
        </div>
        <button onClick={onClose} aria-label="Close chat" className="grid h-[26px] w-[26px] place-items-center rounded-lg text-dim hover:text-text"><X size={15} /></button>
      </div>

      <div ref={scroller} className="scroll-slim flex flex-1 flex-col gap-3.5 overflow-auto p-3.5">
        {messages.length === 0 ? (
          <div className="m-auto max-w-[210px] text-center">
            <MessageCircle size={22} className="mx-auto mb-2 text-faint" />
            <p className="text-[12px] font-semibold">No messages yet</p>
            <p className="mt-1 text-[11px] leading-[1.5] text-dim">Say hi or ask a question. Everyone invited can chat here.</p>
          </div>
        ) : (
          messages.map((m, i) => {
            const a = avatarOf(m.id)
            return (
              <div key={i} className={`flex flex-col gap-1.5 ${m.you ? 'items-end' : 'items-start'}`}>
                <div className="flex items-center gap-1.5 text-[10px] text-dim">
                  {!m.you && <Avatar initials={a.initials} color={a.color} size={16} font={7.5} />}
                  <span className="font-semibold text-text">{m.name}</span>
                  <span>{m.time}</span>
                </div>
                <div className="max-w-[86%] rounded-[13px] border px-[11px] py-2 text-[11.5px] leading-[1.45]" style={m.you ? { background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' } : { background: 'var(--s2)', color: 'var(--text)', borderColor: 'var(--border)' }}>
                  {m.text}
                </div>
              </div>
            )
          })
        )}
      </div>

      <div className="flex items-center gap-2 border-t border-border p-[11px]">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="Add a comment…" className="h-[34px] flex-1 rounded-[9px] border border-border bg-s1 px-[11px] text-[12px] outline-none placeholder:text-faint focus:border-accent-border" />
        <button onClick={send} aria-label="Send" className="grid h-[34px] w-[34px] place-items-center rounded-[9px] bg-accent text-on-accent"><Send size={14} /></button>
      </div>
    </div>
  )
}

/* ── small controls ── */
function Segment({ value, onChange, options, compact }: { value: string; onChange: (v: string) => void; options: { v: string; l: string }[]; compact?: boolean }) {
  return (
    <div className="flex rounded-[9px] bg-s2 p-0.5">
      {options.map((o) => (
        <button key={o.v} onClick={() => onChange(o.v)} className={`flex h-7 items-center rounded-[7px] font-semibold transition-colors ${compact ? 'px-2.5 text-[11px]' : 'px-3 text-[11.5px]'} ${value === o.v ? 'bg-s0 text-text shadow-soft' : 'text-dim hover:text-text'}`}>
          {o.l}
        </button>
      ))}
    </div>
  )
}
function IconBtn({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
  return <button type="button" onClick={onClick} disabled={disabled} className="grid h-7 w-7 place-items-center rounded-[7px] border border-border bg-s1 text-dim enabled:hover:text-text disabled:opacity-40">{children}</button>
}
