'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, ChevronDown, X, Check, Bell, Info, SlidersHorizontal, Trash2 } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { AvatarRow } from '@/components/ui/AvatarRow'
import { TimezonePill, tzAbbr } from '@/components/ui/TimezonePill'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Popover } from '@/components/ui/Popover'
import { CellDetail, ClearTimes, EdgeHandle, EdgeNudge, FilterAvatars, IconBtn, ImportFromCalendar, ImportPreview, MissingPopover, PresetFills, Segment } from './availability/parts'
import { cellBands, clayFor, fmtDur, heat, mergeSlivers, padToWeeks, peakOf, subtract, type Band, type GDay } from './availability/grid-lib'
import {
  patchEvent, availIvOf, fullAvailIvOf, intervalsToGrid, normalizeIv, bestBlock, bestWindow, byYouFirst, fmtMinute, gridStartMinOf, longestRun, stepOf, sortByAttendance, type BestMode,
  type AppEvent, type Participant, type Iv, type AvailIntervals, type GridDay,
} from '@/lib/events'
import { buildImportPreview, mockBusyUtc, ISO_DAY, localZoneShiftMin, localTimeZone, type DayImport } from '@/lib/calendar-import'

type Mode = 'view' | 'edit'
type Edge = 'top' | 'bottom'
type Sel = { day: string; s: number; e: number; edge: Edge }

type Drag =
  | { kind: 'paint'; day: string; anchorClientY: number; anchorScrollTop: number; anchorMin: number; block: Iv | null }
  | {
      kind: 'resize'; day: string; edge: Edge; fixedMin: number
      anchorClientY: number; anchorScrollTop: number; anchorMin: number; origS: number; origE: number
      block: Iv | null; del: boolean
    }

const CELL = 50 // px per grid row — must match the h-[50px] cell height below
const MIN_LEN = 5 // smallest block, in minutes
const OVERSCAN = 6 // rows rendered beyond the viewport each side, so scrolling doesn't flash blank

export function AvailabilityPanel({ event, locked = false, initialFilter = null, focusBest = 0, onLockDays, onRunChange }: {
  event: AppEvent; locked?: boolean; initialFilter?: string[] | string | null; focusBest?: number
  // host-only shortcut on day polls: hand the footer's winning run straight to the confirm modal
  onLockDays?: (startKey: string, endKey: string) => void
  // reports the days-in-a-row dial, so the lock-in modal matches what's being answered
  onRunChange?: (n: number) => void
}) {
  const total = event.participants.length
  const pById = new Map(event.participants.map((p) => [p.id, p]))
  // canonical people order for every list and pile here: availability group
  // (whole time first), then first name, then last name
  const rosterSorted = useMemo(() => sortByAttendance(event), [event])
  const rosterIdx = useMemo(() => new Map(rosterSorted.map((p, i) => [p.id, i])), [rosterSorted])
  const byRoster = (ids: string[]) => [...ids].sort((a, b) => (rosterIdx.get(a) ?? 999) - (rosterIdx.get(b) ?? 999))
  // the filter strip and modal show no group titles, so availability ordering there
  // reads as random — plain first-then-last-name order instead
  const nameSorted = useMemo(() => [...event.participants].sort(byYouFirst), [event])
  const avatarOf = (id: string) => {
    const p = pById.get(id)
    return { initials: p?.initials ?? id, name: p?.name ?? id, color: p?.color ?? ('gray' as Participant['color']) }
  }

  const step = stepOf(event.granularity)
  const rows = event.times.length
  const gridMax = rows * step
  const gridStartMin = gridStartMinOf(event)
  const pxPerMin = CELL / step
  // a day poll asks "which days", not "which times": one all-day row, tap to mark,
  // and everything minute-shaped (handles, presets, clock settings) stays hidden
  const dayPoll = event.granularity === 'day'

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
  // declared "none of these days work" — an explicit empty reply, held locally so the
  // demo works in memory and persisted for real events
  const [unavail, setUnavail] = useState<Set<string>>(() => new Set(event.unavailableIds ?? []))
  const otherIds = new Set<string>()
  for (const d of event.days) for (const [id, ivs] of Object.entries(others[d.key] ?? {})) if (ivs.length) otherIds.add(id)
  const respondedIdSet = new Set(otherIds)
  if (youAny) respondedIdSet.add('JM')
  for (const id of unavail) respondedIdSet.add(id) // an explicit "none work" is a reply
  const responded = respondedIdSet.size

  // once the plan is locked the grid is reference only; otherwise open in edit
  // until you've marked something — the page's one ask of a new participant.
  // Arriving with a person to focus (clicked from another tab) always opens in view.
  const [mode, setMode] = useState<Mode>(locked || initialFilter ? 'view' : !youAny ? 'edit' : 'view')
  // person filter — view mode reads the heat map against just the selected people;
  // seeded with one person or a whole availability group from other tabs
  const [filter, setFilter] = useState<Set<string>>(() => new Set(Array.isArray(initialFilter) ? initialFilter : initialFilter ? [initialFilter] : []))
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

  // a real day whose left neighbor is filler draws its own left border — the filler's
  // grayed edge is too weak to frame it. Covers a leading filler AND gaps inside a
  // sparse poll; with a real neighbor (or the time column) the shared border does the job.
  const ownLeft = (di: number) => di > 0 && weekDays[di - 1].pad

  // avatar icons per cell stay scarce by design: at most 3 on wide screens, 2 on
  // phones — the "+N" chip and the n/N corner count carry the rest of the story
  const avatarCap = (viewportW || 999) < 600 ? 2 : 3
  // the pile still bows to the column width: 17px avatars + 2px gaps in a 5px-padded
  // cell, so narrow columns shrink the pile instead of spilling into cells below
  const colW = Math.max(72, ((viewportW || 0) - 54) / WEEK)
  const pileRow = Math.max(1, Math.floor((colW - 12) / 19))
  const pileMax = Math.min(avatarCap + 1, pileRow * 2 - 1)

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
    // marking any time takes back an earlier "none of these days work"
    if (Object.values(m).some((ivs) => ivs.length) && unavail.has('JM')) {
      setUnavail((prev) => { const next = new Set(prev); next.delete('JM'); return next })
      if (!event.demo) patchEvent(event.id, { unavailableIds: (event.unavailableIds ?? []).filter((id) => id !== 'JM') })
    }
    if (event.demo) return
    // start from every stored day, not just the current window — replies on days a
    // shrunken window dropped stay dormant and come back if the window re-grows
    const availIv: AvailIntervals = { ...fullAvailIvOf(event) }
    for (const d of event.days) {
      availIv[d.key] = { ...(others[d.key] ?? {}) }
      if (m[d.key]?.length) availIv[d.key].JM = m[d.key]
      else delete availIv[d.key].JM
    }
    patchEvent(event.id, { availIv, avail: { ...event.avail, ...intervalsToGrid(availIv, event.days, rows, step) } })
  }
  // your explicit empty reply: none of these days work — cleared by marking any time
  function toggleNoneWork() {
    setUnavail((prev) => {
      const next = new Set(prev)
      if (next.has('JM')) next.delete('JM')
      else next.add('JM')
      if (!event.demo) patchEvent(event.id, { unavailableIds: [...next] })
      return next
    })
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
  // start from the whole group, then tap people off — the fast path for "everyone except a few"
  function selectAllFilter() {
    setFilter(new Set(nameSorted.map((p) => p.id)))
    setDetail(null)
    if (mode === 'edit') { setMode('view'); setSel(null) }
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
    // day polls have no partial times and no handles: a day is on or off, one click each way
    if (dayPoll) {
      commitDay(day, (mine[day] ?? []).length ? [] : [{ s: 0, e: gridMax }])
      setSel(null)
      return
    }
    const r = e.currentTarget.getBoundingClientRect()
    const gridMin = Math.max(0, Math.min(gridMax, ti * step + ((e.clientY - r.top) / r.height) * step))
    const hit = (mine[day] ?? []).find((iv) => gridMin >= iv.s && gridMin <= iv.e)
    if (hit) { setSel({ day, s: hit.s, e: hit.e, edge: 'bottom' }); return } // click a block → select, never toggle off
    // a slot already holding a partial never floods to full — a click in its empty
    // stretch drops a 5-minute band right there instead (a second partial), and the
    // normalize pass coalesces it into anything it touches
    const w0 = ti * step, w1 = w0 + step
    const touching = (mine[day] ?? []).filter((iv) => iv.s < w1 && iv.e > w0)
    if (touching.length > 0) {
      const s = Math.max(0, Math.min(gridMax - MIN_LEN, snap5(gridMin - MIN_LEN / 2)))
      const norm = commitDay(day, [...(mine[day] ?? []), { s, e: s + MIN_LEN }])
      selectMerged(day, norm, s + MIN_LEN / 2, 'bottom')
      return
    }
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
    // day polls have no partial times and no handles: a day is on or off, one tap each way
    if (dayPoll) {
      commitDay(day, (mine[day] ?? []).length ? [] : [{ s: 0, e: gridMax }])
      setSel(null)
      return
    }
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const gridMin = Math.max(0, Math.min(gridMax, ti * step + ((e.clientY - r.top) / r.height) * step))
    const hit = (mine[day] ?? []).find((iv) => gridMin >= iv.s && gridMin <= iv.e)
    if (hit) { setSel({ day, s: hit.s, e: hit.e, edge: 'bottom' }); return } // tap a block → select (edit/remove via the bar)
    // same rule as the mouse: a slot with a partial takes a 5-minute band at the tap
    // spot (coalescing with anything it touches); only a truly empty slot fills whole
    const w0 = ti * step, w1 = w0 + step
    const touching = (mine[day] ?? []).filter((iv) => iv.s < w1 && iv.e > w0)
    if (touching.length > 0) {
      const s = Math.max(0, Math.min(gridMax - MIN_LEN, snap5(gridMin - MIN_LEN / 2)))
      const norm = commitDay(day, [...(mine[day] ?? []), { s, e: s + MIN_LEN }])
      selectMerged(day, norm, s + MIN_LEN / 2, 'bottom')
      return
    }
    const a = rowStart(ti * step + step / 2)
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
          // day polls have no sub-slot precision, so a mark never opens the handle chip
          if (!dayPoll) selectMerged(d.day, norm, (d.block.s + d.block.e) / 2, 'bottom')
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
  // while a person filter is on, the whole group's best window stays on the board
  // (dashed) so the selection's best time can be compared against everyone's
  const bwAll = useMemo(
    () => (filterOn ? bestWindow(combinedByDay, event.days, durationMin, bestMode) : null),
    [filterOn, combinedByDay, durationMin, bestMode], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const bwAllShown = bwAll && (!bw || bwAll.dayKey !== bw.dayKey || bwAll.s !== bw.s || bwAll.e !== bw.e) ? bwAll : null

  // one footer answer, one length control: "1 day" is the best single slot (or the best
  // single day on a day poll), anything longer is the best run of consecutive days.
  // The longest pickable run is the longest stretch of touching calendar days in the poll.
  const maxRun = useMemo(() => longestRun(event.days), [event.days])
  const [blockLen, setBlockLen] = useState(() => (dayPoll && maxRun >= 2 ? 2 : 1))
  // keep the lock-in modal in step with the dial
  useEffect(() => { onRunChange?.(blockLen) }, [blockLen]) // eslint-disable-line react-hooks/exhaustive-deps
  const block = useMemo(
    () => bestBlock(viewCombinedByDay, event.days, blockLen, bestMode),
    [viewCombinedByDay, blockLen, bestMode], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const blockDayLabel = (k: string) => {
    const d = event.days.find((x) => x.key === k)
    return d ? `${d.dow}, ${d.date}` : k
  }
  // the slot frame in the cells belongs to the "1 day" answer on a minute grid — a day
  // poll's cells never carry it (the header indicator is the whole story there), and a
  // longer dial hands the spotlight to the run of days
  const showSlotFrame = !dayPoll && blockLen === 1
  // with the dial on a run of days, the grid is answering in days — Settings follows
  // (clock-flavored options step aside until the dial comes back to 1 day)
  const daysAnswer = dayPoll || blockLen >= 2
  // when the plan locks while you're mid-edit, the grid drops to the read-only view —
  // otherwise it keeps an edit surface the lock just made meaningless
  useEffect(() => {
    if (locked) { setMode('view'); setSel(null) }
  }, [locked]) // eslint-disable-line react-hooks/exhaustive-deps

  // the winning stretch's days, for the header indicator (only when answering in days)
  const blockKeys = useMemo(() => {
    if (!block || blockLen < 2) return null
    const s = new Set<string>()
    const [y, m, dd] = block.startKey.split('-').map(Number)
    const cur = new Date(y, m - 1, dd)
    for (let i = 0; i < blockLen; i++) {
      s.add(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`)
      cur.setDate(cur.getDate() + 1)
    }
    return s
  }, [block, blockLen])

  // who still hasn't marked any availability (to nudge)
  const respondedIds = respondedIdSet
  const missing = rosterSorted.filter((p) => !respondedIds.has(p.id) && p.rsvp !== 'not_going')
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
    setBlockLen(1) // the jump targets the best single slot — keep the footer on the same answer
    const target = Math.max(0, ((bw.s + bw.e) / 2) * pxPerMin - el.clientHeight / 2)
    el.scrollTop = target
    setScrollTop(target)
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [focusBest]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    // a day poll is one short row, so the panel hugs its content instead of filling the viewport
    <div className={`relative flex flex-col rounded-2xl border border-border bg-s1 lg:flex-row ${dayPoll ? '' : 'lg:h-[calc(100dvh-300px)] lg:max-h-[820px] lg:min-h-[480px]'}`}>
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
                    {!daysAnswer && <div>
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
                    </div>}
                    <div className={daysAnswer ? '' : 'border-t border-border pt-2.5'}>
                      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[.12em] text-faint">{daysAnswer ? 'Best days favor' : 'Best time favors'}</div>
                      <Segment compact value={bestMode} onChange={(v) => changeBestMode(v as BestMode)} options={[{ v: 'full', l: 'Everyone stays' }, { v: 'crowd', l: 'Biggest crowd' }]} />
                      <p className="mt-1.5 text-[12px] leading-[1.5] text-faint">
                        {daysAnswer
                          ? bestMode === 'full'
                            ? 'Picks the days the most people can make from start to end.'
                            : 'Picks the days with the most people around overall.'
                          : bestMode === 'full'
                            ? 'Picks the time the most people can attend start to finish.'
                            : 'Picks the time with the most people around overall, even if some come and go.'}
                      </p>
                    </div>
                    {!daysAnswer && <div className="border-t border-border pt-2.5">
                      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[.12em] text-faint">Time format</div>
                      <Segment value={h24 ? '24' : '12'} onChange={(v) => setH24(v === '24')} options={[{ v: '12', l: '12-hour' }, { v: '24', l: '24-hour' }]} />
                    </div>}
                    {youAny && (
                      <div className="border-t border-border pt-2.5">
                        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[.12em] text-faint">Your times</div>
                        <ClearTimes onClear={clearAllMine} />
                      </div>
                    )}
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
          {dayPoll ? null : canConvert ? (
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
          {/* importing fills YOUR times, so it rides with edit mode — view stays lean */}
          {!locked && mode === 'edit' && <ImportFromCalendar onPick={startImport} />}
          </div>
        </div>

        {/* participants + edit hint */}
        <div className="flex flex-wrap items-center gap-2.5 py-[11px]">
          <span className="text-[12.5px] text-dim">Participants</span>
          <FilterAvatars participants={nameSorted} filter={filter} onToggle={toggleFilter} onClear={clearFilter} onSelectAll={selectAllFilter} />
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
          {mode === 'edit' && !dayPoll && <PresetFills onFill={fillPreset} onFillAll={fillAllDays} />}
          {/* the explicit empty reply: with nothing marked, "none of these days work"
              is one tap — and marking any time takes it back */}
          {mode === 'edit' && !locked && !youAny && (
            unavail.has('JM') ? (
              <span className="flex items-center gap-1.5 rounded-full border border-brick-border bg-brick-bg px-2.5 py-1 text-[11.5px] font-semibold text-brick-text">
                Marked as not free on any of these days
                <button type="button" onClick={toggleNoneWork} className="underline underline-offset-2">Undo</button>
              </span>
            ) : (
              <button type="button" onClick={toggleNoneWork} className="text-[12.5px] font-medium text-dim underline-offset-2 hover:text-brick-text hover:underline">
                None of these days work?
              </button>
            )
          )}
          {/* first-time hint only — it earns its place until you've marked something */}
          {mode === 'edit' && !sel && !youAny && (
            <span className="text-[12.5px] text-faint">
              {dayPoll ? 'Tap the days you can make it.' : 'Drag across the times you’re free. The checkmarks fill a whole day or row at once.'}
            </span>
          )}
          {locked && <span className="text-[12.5px] text-faint">Planning is locked. The grid stays for reference.</span>}
          {/* the legend is teaching UI — it waits behind a small info icon instead of
              sitting in the strip forever */}
          <span className="ml-auto">
            <Popover
              align="end"
              width={232}
              trigger={(open) => (
                <span aria-label="How to read the grid" title="How to read the grid" className={`grid h-6 w-6 place-items-center rounded-full ${open ? 'bg-s2 text-dim' : 'text-faint hover:bg-s2 hover:text-dim'}`}>
                  <Info size={14} />
                </span>
              )}
            >
              {() => (
                <div className="flex flex-col gap-2.5 p-0.5 text-[12px] leading-[1.5] text-dim">
                  <div className="flex items-center gap-1 text-[11px] text-faint">
                    <span>No one</span>
                    {['var(--s2)', 'var(--heat-low)', 'var(--heat-mid)', 'var(--heat-high)', 'var(--heat-full)'].map((c) => (
                      <span key={c} className="h-[11px] w-[11px] rounded-[3px] border border-border" style={{ background: c }} />
                    ))}
                    <span>{filterOn ? 'All selected' : 'Everyone'}</span>
                  </div>
                  <p>Darker cells mean more people are free then. The corner count is exact.</p>
                  <div className="flex items-center gap-1.5 border-t border-border pt-2">
                    <span className="h-[11px] w-[11px] flex-none rounded-[3px]" style={{ background: 'var(--you-some)', border: '1.5px solid var(--you-text)' }} />
                    <span>Your own marked times, in Edit mine.</span>
                  </div>
                </div>
              )}
            </Popover>
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
              // the header mirrors whatever the footer is answering: one best day, or the
              // winning run of days (a hairline across its headers ties the run together)
              const inBlock = mode === 'view' && !!blockKeys?.has(d.key)
              const blockFirst = inBlock && block?.startKey === d.key
              const singleBestKey = dayPoll ? (blockLen === 1 ? block?.startKey : undefined) : bw?.dayKey
              const isBestDay = !blockKeys && (d.best || (mode === 'view' && singleBestKey === d.key))
              return (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => toggleDay(d.key)}
                  className={`sticky top-0 z-20 border-b border-r border-grid-edge px-1.5 py-2 text-center ${ownLeft(di) ? 'border-l border-l-grid-edge' : ''}`}
                  style={{
                    background: isBestDay || inBlock ? 'var(--best-head)' : 'var(--s0)',
                    boxShadow: inBlock ? 'inset 0 2px 0 var(--ochre)' : undefined,
                    cursor: mode === 'edit' ? 'pointer' : 'default',
                  }}
                  title={mode === 'edit' ? 'Click to fill the whole day' : undefined}
                >
                  <div className="text-[11px] text-dim">{d.dow}</div>
                  <div className="text-[14px] font-semibold" style={{ color: isBestDay || inBlock ? 'var(--ochre-text)' : 'var(--text)' }}>{d.date}</div>
                  {mode === 'edit' && (
                    <span className={`mx-auto mt-[3px] grid h-4 w-4 place-items-center rounded-[5px] border ${dayFull ? 'border-accent bg-accent text-on-accent' : 'border-border2 text-transparent'}`}>
                      <Check size={11} />
                    </span>
                  )}
                  {mode === 'view' && (blockFirst
                    ? <span className="mt-[3px] inline-block whitespace-nowrap rounded-[5px] border border-ochre-border bg-ochre-bg px-[5px] py-px text-[9.5px] font-semibold text-ochre-text">Best {blockLen} days</span>
                    : isBestDay
                      ? <span className="mt-[3px] inline-block rounded-[5px] border border-ochre-border bg-ochre-bg px-[5px] py-px text-[9.5px] font-semibold text-ochre-text">Best day</span>
                      : null)}
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
                    <span>{dayPoll ? 'All day' : labelMain}</span>
                    {!dayPoll && labelSub && <span className="text-[9.5px] font-semibold tracking-[.04em] text-faint">{labelSub}</span>}
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
                    const protect = showSlotFrame
                      ? [
                          ...(bw && d.key === bw.dayKey ? [bw.s, bw.e] : []),
                          ...(bwAllShown && d.key === bwAllShown.dayKey ? [bwAllShown.s, bwAllShown.e] : []),
                        ]
                      : []
                    const paint = mergeSlivers(bands, minBandDur, protect.length ? protect : undefined)
                    const title = bands.length === 1
                      ? (n ? `${n} of ${viewTotal} free` : 'No one free')
                      : bands.map((b) => `${fmt(gridStartMin + b.s)} – ${fmt(gridStartMin + b.e)}: ${b.ids.length} free`).join('\n')
                    const open = detail?.day === d.key && detail?.ti === ti
                    // the best window is one continuous ochre frame over its cells — a color the
                    // grid never uses for lines or heat, so it can't be mistaken for either
                    const inBest = showSlotFrame && !!bw && d.key === bw.dayKey && w0 < bw.e && w1 > bw.s
                    return (
                      <div
                        key={d.key}
                        onClick={(e) => openDetail(e, d.key, ti)}
                        className={`relative min-h-[50px] cursor-pointer border-b border-r border-grid-line ${ownLeft(di) ? 'border-l border-l-grid-line' : ''}`}
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
                        {/* everyone's best window rides along as a dashed frame while a filter
                            is on — solid is the selection's best, dashed is the whole group's */}
                        {showSlotFrame && !!bwAllShown && d.key === bwAllShown.dayKey && w0 < bwAllShown.e && w1 > bwAllShown.s && (() => {
                          const bs = Math.max(bwAllShown.s, w0), be = Math.min(bwAllShown.e, w1)
                          const edge = '2px dashed var(--ochre)'
                          return (
                            <div
                              className="pointer-events-none absolute inset-x-0 z-[2] opacity-80"
                              style={{
                                top: `${((bs - w0) / step) * 100}%`,
                                height: `${((be - bs) / step) * 100}%`,
                                borderLeft: edge,
                                borderRight: edge,
                                borderTop: bs === bwAllShown.s ? edge : undefined,
                                borderBottom: be === bwAllShown.e ? edge : undefined,
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
                            const shown = n <= pileMax ? Math.min(n, avatarCap) : pileMax - 1
                            return (
                              <>
                                {byRoster(peak.ids).slice(0, shown).map((id) => { const a = avatarOf(id); return <Avatar key={id} initials={a.initials} color={a.color} size={17} font={8.5} title={a.name} /> })}
                                {n > shown && <span className="grid h-[15px] min-w-[15px] place-items-center rounded-full bg-s3 px-[3px] text-[8.5px] font-bold text-dim" title={`${n} free`}>+{n - shown}</span>}
                              </>
                            )
                          })()}
                        </div>
                        {n > 0 && <span className="pointer-events-none absolute bottom-[3px] right-1 z-[1] text-[9.5px] font-bold" style={{ color: n >= viewTotal ? 'var(--heat-count-full)' : 'var(--heat-count)' }}>{n}/{viewTotal}</span>}
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
                    <div key={d.key} className={`relative h-[50px] select-none border-b border-r border-grid-line ${ownLeft(di) ? 'border-l border-l-grid-line' : ''}`} style={{ background: heat(oCount, editTotal), boxShadow: d.best ? 'inset 1px 0 0 0 var(--ochre-border), inset -1px 0 0 0 var(--ochre-border)' : undefined }}>
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
                      {cnt > 0 && <span className="pointer-events-none absolute bottom-[2px] right-1 z-[2] text-[9px] font-bold" style={{ color: cnt >= editTotal ? 'var(--heat-count-full)' : 'var(--you-text)' }}>{cnt}/{editTotal}</span>}
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

        {/* best-answer footer — gone once a time exists (locked in, or fixed at creation
            while the place vote runs). One line, one length control: "1 day" answers with
            the best single slot (or day), longer answers with the best run of days. */}
        {!locked && !event.confirmed && <div className="mt-0.5 flex flex-wrap items-center gap-2.5 border-t border-border px-0.5 pt-3">
          {responded === 0 ? (
            <span className="text-[12.5px] text-dim">
              {dayPoll
                ? <>No days marked yet. Add yours in <span className="font-semibold text-text">Edit mine</span>.</>
                : <>No availability yet. Add yours in <span className="font-semibold text-text">Edit mine</span> to start finding the best time.</>}
            </span>
          ) : (
            <>
              {maxRun >= 2 ? (
                <>
                  <span className="text-[12.5px] text-dim">Best</span>
                  <select
                    value={blockLen}
                    onChange={(e) => setBlockLen(Number(e.target.value))}
                    aria-label="How many days in a row"
                    className="h-7 cursor-pointer rounded-[7px] border border-border bg-s1 px-1.5 text-[12.5px] font-medium outline-none focus:border-accent-border"
                  >
                    {Array.from({ length: maxRun }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n === 1 ? '1 day' : `${n} days`}</option>)}
                  </select>
                  {blockLen >= 2 && <span className="text-[12.5px] text-dim">in a row</span>}
                </>
              ) : (
                <span className="text-[12.5px] text-dim">{dayPoll ? 'Best day' : `Best ${fmtDur(durationMin)} slot`}</span>
              )}
              {filterOn && <span className="text-[12.5px] text-dim">for your selection</span>}
              {blockLen === 1 && !dayPoll ? (
                bw ? (
                  <>
                    <span className="text-[14px] font-semibold text-ochre">{bw.dayLabel} · {fmt(gridStartMin + bw.s)} – {fmt(gridStartMin + bw.e)}</span>
                    <TimezonePill tz={myTime && canConvert ? localTz : event.timezone} />
                    {bestMode === 'crowd'
                      // never round a partial attendee away: below one person on average,
                      // count everyone who shows up at all instead
                      ? Math.round(bw.avg) >= 1
                        ? <span className="text-[12.5px] font-semibold text-teal-text">around {Math.round(bw.avg)} of {viewTotal} there{bw.count > 0 && <span className="font-normal text-dim"> · {bw.count} the whole time</span>}</span>
                        : <span className="text-[12.5px] font-semibold text-teal-text">{bw.anyIds.length} of {viewTotal} there for part of it</span>
                      : <span className="text-[12.5px] font-semibold text-teal-text">{bw.count} of {viewTotal} free</span>}
                    <div className="ml-auto"><AvatarRow people={byRoster(bestMode === 'crowd' ? bw.anyIds : bw.ids).map(avatarOf)} size={22} max={8} overlap={5} /></div>
                    {bwAllShown && (
                      <span className="flex w-full items-center gap-1.5 text-[12.5px] text-dim">
                        <span className="inline-block h-0 w-[18px] border-t-2 border-dashed border-ochre" aria-hidden />
                        Everyone&apos;s best stays marked for comparison: <span className="font-semibold text-text">{bwAllShown.dayLabel} · {fmt(gridStartMin + bwAllShown.s)} – {fmt(gridStartMin + bwAllShown.e)}</span>
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-[12.5px] text-dim">No block long enough for a <span className="font-semibold text-text">{fmtDur(durationMin)}</span> event yet. Try a shorter length, or wait for more responses.</span>
                )
              ) : block ? (
                <>
                  <span className="text-[14px] font-semibold text-ochre">
                    {blockLen === 1 ? blockDayLabel(block.startKey) : <>{blockDayLabel(block.startKey)} – {blockDayLabel(block.endKey)}</>}
                  </span>
                  <span className="text-[12.5px] font-semibold text-teal-text">
                    {blockLen === 1
                      ? <>{block.count} of {viewTotal} free that day</>
                      : bestMode === 'crowd'
                        ? <>around {Math.round(block.avgPerDay)} of {viewTotal} there each day</>
                        : <>{block.count} of {viewTotal} free every day</>}
                  </span>
                  {dayPoll && onLockDays && (
                    <button
                      type="button"
                      onClick={() => onLockDays(block.startKey, block.endKey)}
                      className="text-[12.5px] font-semibold text-accent-text hover:underline"
                    >
                      {blockLen === 1 ? 'Lock this day' : 'Lock these days'}
                    </button>
                  )}
                  <span className="ml-auto"><AvatarRow people={byRoster(bestMode === 'crowd' ? block.anyIds : block.ids).map(avatarOf)} size={22} max={8} overlap={5} /></span>
                </>
              ) : (
                <span className="text-[12.5px] text-dim">No {blockLen} days in a row with replies yet.</span>
              )}
            </>
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

