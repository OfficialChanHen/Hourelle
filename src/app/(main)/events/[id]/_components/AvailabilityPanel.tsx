'use client'

/* ── the Availability tab: the grid ──
   The biggest single surface in the app, and the one everybody touches. It draws
   one column per day and one row per time slot, and does three separate jobs at
   once, which is why it is this size.

   1. SHOWING THE ROOM. Every answer is read as minute intervals, and a cell is
      painted from the bands inside it (see grid-lib's cellBands), so a block that
      ends at 8:20 draws a partly filled cell rather than a whole one. The heat
      ramp, the "best window" frame and the per-cell breakdown all read the same
      intervals, so nothing on screen can disagree with anything else.

   2. TAKING YOUR ANSWER. "Edit mine" turns the grid into a canvas. A sweep paints
      every cell it crosses to the state decided by the first one, so dragging back
      over the sweep takes it back; the path between two pointer samples is walked
      in half-cell steps, so a fast flick never skips a row. Afterwards the block's
      edges can be dragged, or nudged by the minute. On a touchscreen the gesture
      starts with a short hold, which is what separates painting from scrolling.
      A sweep repaints on every move but SAVES ONCE, at the end.

   3. STAYING CURRENT WITHOUT FIGHTING YOU. `mine` is local while you edit and
      follows the event's copy otherwise, so someone else's answer landing over the
      websocket updates the grid around you rather than under you. A write of this
      panel's own comes back as an echo moments later; `wroteRef` remembers recent
      signatures so an echo is recognised and ignored, and they expire so a genuine
      later correction is never mistaken for one.

   Two shapes share all of this. A time grid is what the above describes; a DAY POLL
   (granularity 'day') asks which whole days work instead, and renders through
   DayCalendar with everything minute-shaped hidden.

   Scale is a standing constraint. Rows are virtualized, weeks are paged rather than
   rendered all at once, per-day aggregates are computed once per render rather than
   per cell, and the avatars in a cell cap hard (none at all on a phone, where the
   count carries it). Nothing here is allowed to cost cells x people. */

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { ChevronLeft, ChevronRight, ChevronDown, ChevronsLeftRight, ChevronsRightLeft, X, Check, Bell, Info, SlidersHorizontal, Trash2, Zap } from 'lucide-react'

import { AvatarRow } from '@/components/ui/AvatarRow'
import { TimezonePill, tzAbbr } from '@/components/ui/TimezonePill'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Switch } from '@/components/ui/Switch'
import { DurationField } from '@/components/ui/DurationField'
import { Hint } from '@/components/ui/Hint'
import { Popover } from '@/components/ui/Popover'
import { CellDetail, ClearTimes, EdgeHandle, EdgeNudge, FilterAvatars, IconBtn, ImportFromCalendar, MissingPopover, PresetFills, Segment } from './availability/parts'
import { cellBands, clayFor, fmtDur, heat, mergeSlivers, padToWeeks, peakOf, pileFit, PILE_AV, PILE_FONT, PILE_OVER, subtract, type Band, type GDay } from './availability/grid-lib'
import { DayCalendar } from './availability/DayCalendar'
import { prefH24, prefWholeWeek } from '@/lib/prefs'
import { useAccount } from '@/hooks/useAccount'
import { useFollow } from '@/hooks/useFollow'
import { canEmail, sendNudges } from '@/lib/mail'
import {
  addMeToEvent, patchEvent, availIvOf, fullAvailIvOf, intervalsToGrid, normalizeIv, bestBlock, bestWindow, byYouFirst, fmtMinute, gridStartMinOf, longestRun, stepOf, sortByAttendance, type BestMode,
  type AppEvent, type Participant, type Iv, type AvailIntervals, type GridDay,
} from '@/lib/events'
import { buildImportPreview, googleBusyUtc, outlookBusyUtc, mockBusyUtc, ISO_DAY, localZoneShiftMin, localTimeZone, type DayImport, type UtcBusy } from '@/lib/calendar-import'
import { backendOn } from '@/lib/db'
import { connectCalendar, providerToken, type OAuthProvider } from '@/lib/session'

type Mode = 'view' | 'edit'
type Edge = 'top' | 'bottom'
type Sel = { day: string; s: number; e: number; edge: Edge }

type Drag =
  /* paint: the pointer sets every cell it crosses to one state, decided by the first cell:
     off before the press means the sweep paints on, on means it paints off. `trail` is the
     cells it has crossed, in order, and a cell crossed twice is left as it is, so a sweep
     never unpaints what it painted, whatever loop the pointer makes on the way. The path
     between two pointer samples is walked in half-cell steps, so a fast flick still touches
     every row it crossed. `base` is what the day looked like before the press. Pressed on
     one of your blocks and released without moving, the whole thing selects that block
     instead. */
  | {
      kind: 'paint'; day: string; di: number; ti: number; anchorClientY: number; anchorScrollTop: number; anchorScrollLeft: number; anchorMin: number
      trail: string[]; seen: Set<string>; on: boolean; lastX: number; lastY: number; base: Record<string, Iv[]>; moved: boolean; hit: Iv | null
    }
  | {
      kind: 'resize'; day: string; edge: Edge; fixedMin: number
      anchorClientY: number; anchorScrollTop: number; anchorMin: number; origS: number; origE: number
      block: Iv | null; del: boolean
    }

const CELL = 50 // px per grid row — must match the h-[50px] cell height below
// the fewest rows the grip may leave standing: three of them, plus the day header.
// Below that the panel stops being a calendar and starts being a scrollbar.
const MIN_GRID_H = CELL * 3 + 40
const MIN_LEN = 5 // smallest block, in minutes
// the time rail, wide enough for "12:30 AM" on one line beside its tick. A phone gives
// up the slack: every pixel here is a pixel the days do not get.
const TIME_COL = 82
const TIME_COL_NARROW = 62
const TICK_GAP = 6 // px of clear air between a time and the ticks either side of it
const PAD_W = 28 // px — a filler day on a phone: a thin hatched strip, not a column that hides the poll
const COL_MIN = 84 // px — narrowest a real day column gets, so its pile and count both fit
const GRAB_PX = 11 // half the depth of the bar along a selected block's edge
const ECHO_MS = 4000 // how long a write of this panel's own stays recognisable as its echo
const HOLD_MS = 160 // touch: rest the finger this long to start painting; a quicker swipe scrolls
const SLOP = 8 // px a touch may wander during the hold and still count as resting
const COARSE = '(pointer: coarse)'
function subscribeCoarse(cb: () => void) {
  const mq = window.matchMedia(COARSE)
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}
const OVERSCAN = 6 // rows rendered beyond the viewport each side, so scrolling doesn't flash blank

export function AvailabilityPanel({ event, locked = false, initialFilter = null, focusBest = 0, onLockDays, onRunChange, onPatch }: {
  event: AppEvent; locked?: boolean; initialFilter?: string[] | string | null; focusBest?: number
  // lets a change made here (adding yourself to the list) reach the always-mounted surfaces
  onPatch?: (patch: Partial<AppEvent>) => void
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

  // whose cells "Edit mine" writes: wherever the `you` marker sits — the stubbed
  // account normally, the guest when this browser joined via the share link. It can
  // be missing: signed in and not on this event's list, nobody here is you, and
  // editing has to stay off rather than quietly write to someone else's row.
  const mePart = event.participants.find((p) => p.you)
  const meId = mePart?.id ?? ''
  const notListed = !mePart

  const step = stepOf(event.granularity)
  const rows = event.times.length
  const gridMax = rows * step
  const gridStartMin = gridStartMinOf(event)
  const pxPerMin = CELL / step
  // a day poll asks "which days", not "which times": one all-day row, tap to mark,
  // and everything minute-shaped (handles, presets, clock settings) stays hidden
  const dayPoll = event.granularity === 'day'

  // others: everyone but you, minute-interval ranges per participant (read-only context).
  // Derived from the event, so a mark someone else makes lands here the moment the
  // websocket delivers it — the grid never needs a reload to show the room filling in
  const others = useMemo<AvailIntervals>(() => {
    const src = availIvOf(event)
    return Object.fromEntries(event.days.map((d) => {
      const byPid = { ...(src[d.key] ?? {}) }
      delete byPid[meId]
      return [d.key, byPid]
    }))
  }, [event, meId])
  // my row as the event has it — the seed for `mine`, and what it follows afterwards
  const remoteMine = useMemo<Record<string, Iv[]>>(() => {
    const src = availIvOf(event)
    return Object.fromEntries(event.days.map((d) => [d.key, normalizeIv(src[d.key]?.[meId] ?? [])]))
  }, [event, meId])
  // mine: minute-interval ranges per day (5-min precision, mergeable). Local while I
  // edit; it adopts the event's copy only when that changed somewhere else (a calendar
  // import on my other device, the host clearing my marks) — never for the echo of my
  // own write, and never mid-drag
  const [mine, setMine] = useState<Record<string, Iv[]>>(remoteMine)
  // what a calendar import showed as busy, per day: a striped marker beside the answer,
  // not part of it, so painting over or clearing a slot never loses what the calendar said
  const importedMine = useMemo<Record<string, Iv[]>>(() => {
    const src = event.importedIv ?? {}
    return Object.fromEntries(event.days.map((d) => [d.key, normalizeIv(src[d.key]?.[meId] ?? [])]))
  }, [event, meId])
  const hasImported = event.days.some((d) => (importedMine[d.key]?.length ?? 0) > 0)
  // the rows this panel persisted lately, to tell its own echo from somebody else's news.
  // They expire: an echo comes back in under a second, so anything older is not one, and a
  // remembered signature that never aged out would make a later correcting update — one
  // that happens to match something written before — invisible forever.
  const wroteRef = useRef<{ sig: string; at: number }[]>([])

  const youAny = event.days.some((d) => (mine[d.key]?.length ?? 0) > 0)
  // declared "none of these days work" — an explicit empty reply, held locally so the
  // demo works in memory and persisted for real events
  const [unavail, setUnavail] = useState<Set<string>>(() => new Set(event.unavailableIds ?? []))
  useFollow(event.unavailableIds ?? [], (ids) => setUnavail(new Set(ids)))
  const otherIds = new Set<string>()
  for (const d of event.days) for (const [id, ivs] of Object.entries(others[d.key] ?? {})) if (ivs.length) otherIds.add(id)
  const respondedIdSet = new Set(otherIds)
  if (youAny) respondedIdSet.add(meId)
  for (const id of unavail) respondedIdSet.add(id) // an explicit "none work" is a reply
  const responded = respondedIdSet.size

  // once the plan is locked the grid is reference only; otherwise open in edit
  // until you've marked something — the page's one ask of a new participant.
  // Arriving with a person to focus (clicked from another tab) always opens in view.
  const [mode, setMode] = useState<Mode>(locked || initialFilter || notListed ? 'view' : !youAny ? 'edit' : 'view')
  // there is nobody to write to — stay in view no matter what else says otherwise
  const editable = !locked && !notListed
  if (notListed && mode === 'edit') setMode('view')
  // person filter — view mode reads the heat map against just the selected people;
  // seeded with one person or a whole availability group from other tabs
  const [filter, setFilter] = useState<Set<string>>(() => new Set(Array.isArray(initialFilter) ? initialFilter : initialFilter ? [initialFilter] : []))
  // clock style follows the device preference from Settings; the grid's own
  // toggle still overrides it for the visit
  const [h24, setH24] = useState(() => prefH24())
  const [myTime, setMyTime] = useState(false) // show times in the viewer's local zone
  const [durationMin, setDurationMin] = useState(event.durationMin ?? 60)
  const [bestMode, setBestMode] = useState<BestMode>(event.bestMode ?? 'full')
  const [detail, setDetail] = useState<{ day: string; ti: number; cx: number; cyTop: number; cyBottom: number; below: boolean } | null>(null) // view-mode cell breakdown
  const [showMissing, setShowMissing] = useState(false)
  const [nudged, setNudged] = useState<Set<string>>(new Set())
  // nudges are emails from the host: only the host, logged in, with a backend
  const account = useAccount()
  const canNudge = !!event.hostedByYou && canEmail(account.signedIn)
  // what the panel offers depends on whose event it is: how long the thing needs and
  // what the best window should favour are the host's answers, and they change the
  // event for everybody. Everything else in there is about this screen or your own
  // times, so it is everybody's.
  const isHost = !!event.hostedByYou
  const [nudgeNote, setNudgeNote] = useState<string | null>(null)
  const [sel, setSel] = useState<Sel | null>(null)
  const [nudgeStep, setNudgeStep] = useState(5) // minutes the − / + buttons move an edge
  const [drag, setDrag] = useState<Drag | null>(null)
  useFollow(remoteMine, (rm) => {
    const sig = JSON.stringify(rm)
    const own = wroteRef.current.some((w) => w.sig === sig && Date.now() - w.at < ECHO_MS)
    if (drag || own || sig === JSON.stringify(mine)) return
    setMine(rm)
  })
  const [page, setPage] = useState(0)
  // row virtualization: only the visible slice of time rows is mounted.
  // starts at 0 to match the un-scrolled DOM; the mount effect jumps to ~8 AM
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportH, setViewportH] = useState(460)
  // the row window follows the scroller's real height: a panel that hugs its rows or
  // is stretched by the grip mounts every row it shows, not a fixed 460px of them
  useEffect(() => {
    const el = scroller.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => setViewportH(el.clientHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [dayPoll])
  const [viewportW, setViewportW] = useState(0)

  const WEEK = 7
  const paddedDays = useMemo<GDay[]>(() => padToWeeks(event.days), [event.days])
  const pageCount = Math.max(1, Math.ceil(paddedDays.length / WEEK))
  const weekDays = paddedDays.slice(page * WEEK, page * WEEK + WEEK)
  const goWeek = (dir: -1 | 1) => { setPage((p) => Math.max(0, Math.min(pageCount - 1, p + dir))); setSel(null) }

  /* ── the days outside the poll, folded away ──
     A week is squared off with filler so the columns line up with a calendar, but
     those days are not part of the question. They start folded, and the grip on the
     first real day's outer border opens them: drag away from the poll to let them
     back in, drag toward it to fold them again. Only the run before the first real
     day and the run after the last fold; filler INSIDE a sparse poll (weekends only,
     hand-picked dates) stays, because there it is holding two real days apart. */
  const firstReal = weekDays.findIndex((d) => !d.pad)
  const lastReal = weekDays.length - 1 - [...weekDays].reverse().findIndex((d) => !d.pad)
  const hasLead = firstReal > 0
  const hasTrail = lastReal >= 0 && lastReal < weekDays.length - 1
  // the device preference decides where they start; the seam buttons still rule the visit
  // the days on either side that only square the week off. One switch, in the
  // toolbar: two little chevrons straddling the grid lines were easy to miss, sat
  // over the header as the page scrolled, and asked the same question twice.
  const [wholeWeek, setWholeWeek] = useState(() => prefWholeWeek())
  const cols = useMemo(
    () => weekDays.filter((d) => !d.pad || wholeWeek),
    [weekDays, wholeWeek],
  )

  // a real day whose left neighbor is filler draws its own left border — the filler's
  // grayed edge is too weak to frame it. Covers a leading filler AND gaps inside a
  // sparse poll; with a real neighbor (or the time column) the shared border does the job.
  const ownLeft = (di: number) => di > 0 && cols[di - 1].pad
  // true when this column opens a month the one before it was not in (or opens the week)
  const monthTurn = (di: number) => {
    const mine = cols[di]?.date.split(' ')[0]
    for (let i = di - 1; i >= 0; i--) if (!cols[i].pad) return cols[i].date.split(' ')[0] !== mine
    return true
  }

  // a phone shows three or four columns at a time, so the filler days that square a
  // week off collapse to thin strips there — otherwise a poll starting on a Friday
  // opens on nothing but hatching, which reads as "nothing to tap here"
  const narrow = (viewportW || 999) < 600
  const timeCol = narrow ? TIME_COL_NARROW : TIME_COL
  const timeColRef = useRef(timeCol)
  const colTrack = (d: GDay) => (d.pad && narrow ? `${PAD_W}px` : `minmax(${narrow ? 0 : COL_MIN}px, 1fr)`)
  // faces per cell stay scarce by design: four on a wide screen, none at all on a small
  // one, where the "+N" chip and the n/N corner count carry the story by themselves
  const avatarCap = narrow ? 0 : 4
  // the pile still bows to the column width: 17px avatars + 2px gaps in a 5px-padded
  // cell, so narrow columns shrink the pile instead of spilling into cells below
  // the real resolved width of a day column — on a phone that is whatever a seventh of
  // the sheet comes to, and the pile is sized against it rather than against a floor
  const colW = (() => {
    const each = ((viewportW || 0) - timeCol) / Math.max(1, cols.length)
    return narrow ? Math.max(24, each) : Math.max(COL_MIN, each)
  })()

  // timezone conversion: shift is 0 unless "my time" is on and the local zone differs
  const day0 = event.days[0]?.key ?? ''
  const rawShift = (() => { try { return ISO_DAY.test(day0) ? localZoneShiftMin(event.timezone, day0, gridStartMin) : 0 } catch { return 0 } })()
  const canConvert = rawShift !== 0
  const shift = myTime && canConvert ? rawShift : 0
  const localTz = localTimeZone()
  const fmt = (min: number) => fmtMinute(min + shift, h24)

  useEffect(() => { timeColRef.current = timeCol }, [timeCol])
  const mineRef = useRef(mine); useEffect(() => { mineRef.current = mine }, [mine])
  const selRef = useRef(sel); useEffect(() => { selRef.current = sel }, [sel])
  const dragRef = useRef<Drag | null>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const gridEl = useRef<HTMLDivElement>(null) // the grid itself — column math for cross-day drags
  const weekDaysRef = useRef(cols); useEffect(() => { weekDaysRef.current = cols }, [cols])
  const colRef = useRef<HTMLDivElement>(null) // left column — cell popover anchors here, outside the scroller
  const lastYRef = useRef(0) // latest pointer Y, for the auto-scroll loop
  const lastXRef = useRef(0)
  // touch: where the finger landed, to tell a tap from a scroll and to start a hold-drag from
  const tapRef = useRef<{ day: string; ti: number; x: number; y: number; top: number; height: number } | null>(null)
  const holdRef = useRef<ReturnType<typeof setTimeout> | null>(null) // pending press-and-hold
  const touchDragRef = useRef(false) // the live drag came from a finger: block the browser's scroll
  // phones get a different hint — the gesture there starts with a short hold
  const coarse = useSyncExternalStore(subscribeCoarse, () => window.matchMedia(COARSE).matches, () => false)
  const rafRef = useRef(0)
  const scrollRaf = useRef(0)

  // all-day grids open scrolled to ~8 AM — the whole day stays reachable, mornings-first.
  // Also track the viewport height so virtualization knows how many rows to draw.
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const target = (8 * 60 - gridStartMin) * pxPerMin
    // read the offset back rather than trusting the one asked for: a short grid (a
    // handful of rows starting at midnight) cannot scroll that far, and a scrollTop
    // past the end would window the virtualizer clean off the rows and draw nothing
    if (!dayPoll && target > 0) { el.scrollTop = target; setScrollTop(el.scrollTop) }
    setViewportH(el.clientHeight)
    setViewportW(el.clientWidth)
    const ro = new ResizeObserver(() => { setViewportH(el.clientHeight); setViewportW(el.clientWidth) })
    ro.observe(el)
    return () => ro.disconnect()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  // where each day column starts, in px from the grid's left edge — read off the
  // resolved track sizes, since a phone's filler columns are narrower than the rest
  function colEdges(): number[] {
    const g = gridEl.current
    if (!g) return []
    const tracks = getComputedStyle(g).gridTemplateColumns.split(' ').map(parseFloat).filter((n) => !Number.isNaN(n))
    const out: number[] = []
    let x = tracks[0] || timeColRef.current
    for (let i = 1; i < tracks.length; i++) { out.push(x); x += tracks[i] }
    return out
  }

  // a week that begins before the poll does opens with the first real day at the left
  // edge. On a phone the grid shows three or four columns, and a poll that starts on a
  // Friday would otherwise open on nothing but hatched filler — which reads as "nothing
  // to tap here". Re-applied on every week change.
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const first = cols.findIndex((d) => !d.pad)
    const edges = colEdges()
    // only when the first real day would otherwise be off screen; if it already fits,
    // the week stays put with its filler in view
    const inView = first <= 0 || edges[first] == null || edges[first] + COL_MIN <= el.clientWidth
    el.scrollLeft = inView ? 0 : edges[first] - timeCol
  }, [page, narrow, wholeWeek]) // eslint-disable-line react-hooks/exhaustive-deps

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

  function persist(m: Record<string, Iv[]>, extra: Partial<AppEvent> = {}) {
    // marking any time takes back an earlier "none of these days work"
    if (Object.values(m).some((ivs) => ivs.length) && unavail.has(meId)) {
      setUnavail((prev) => { const next = new Set(prev); next.delete(meId); return next })
      if (!event.demo) patchEvent(event.id, { unavailableIds: (event.unavailableIds ?? []).filter((id) => id !== meId) })
    }
    if (event.demo) return
    const now = Date.now()
    wroteRef.current = [...wroteRef.current.filter((w) => now - w.at < ECHO_MS).slice(-19), { sig: JSON.stringify(m), at: now }]
    // start from every stored day, not just the current window — replies on days a
    // shrunken window dropped stay dormant and come back if the window re-grows
    const availIv: AvailIntervals = { ...fullAvailIvOf(event) }
    for (const d of event.days) {
      availIv[d.key] = { ...(others[d.key] ?? {}) }
      if (m[d.key]?.length) availIv[d.key][meId] = m[d.key]
      else delete availIv[d.key][meId]
    }
    patchEvent(event.id, { availIv, avail: { ...event.avail, ...intervalsToGrid(availIv, event.days, rows, step) }, ...extra })
  }
  // your explicit empty reply: none of these days work — cleared by marking any time
  function toggleNoneWork() {
    setUnavail((prev) => {
      const next = new Set(prev)
      if (next.has(meId)) next.delete(meId)
      else next.add(meId)
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
  // one call for one person or the whole missing list; the note under the popover
  // says exactly what happened, since an email is a real thing to have sent
  async function nudgeMany(ids: string[]) {
    if (!canNudge || !ids.length) return
    const r = await sendNudges(event.id, ids)
    if (!r.ok) { setNudgeNote(r.error); return }
    const done = [...r.data.sent, ...r.data.already]
    setNudged((prev) => { const n = new Set(prev); done.forEach((id) => n.add(id)); return n })
    const parts: string[] = []
    if (r.data.sent.length) parts.push(`${r.data.sent.length} emailed`)
    if (r.data.already.length) parts.push(`${r.data.already.length} already nudged today`)
    if (r.data.noEmail.length) parts.push(`${r.data.noEmail.length} with no email to reach`)
    if (r.data.failed.length) parts.push(`${r.data.failed.length} could not be sent`)
    setNudgeNote(parts.length ? parts.join(', ') + '.' : null)
  }
  function nudge(id: string) { void nudgeMany([id]) }
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
  function nudgeAll() { void nudgeMany(missing.filter((p) => !nudged.has(p.id)).map((p) => p.id)) }

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

  // set several days' intervals at once, normalized + persisted in one write
  function commitDays(patch: Record<string, Iv[]>): Record<string, Iv[]> {
    const norm = Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, normalizeIv(v)]))
    setMine((pm) => { const next = { ...pm, ...norm }; persist(next); return next })
    return norm
  }
  // set a day's intervals, normalized + persisted; returns the merged result for re-selection
  function commitDay(day: string, ivs: Iv[]): Iv[] {
    return commitDays({ [day]: ivs })[day]
  }
  function selectMerged(day: string, ivs: Iv[], probe: number, edge: Edge) {
    const merged = ivs.find((iv) => probe >= iv.s && probe <= iv.e)
    if (merged) setSel({ day, s: merged.s, e: merged.e, edge })
  }

  // everyone's intervals for a day (mine folded in under my id), with the live drag applied
  function combinedFor(day: string, liveMine?: Iv[], source: AvailIntervals = others): Record<string, Iv[]> {
    const m = liveMine ?? mine[day] ?? []
    return m.length ? { ...(source[day] ?? {}), [meId]: m } : { ...(source[day] ?? {}) }
  }

  /* a paint drag writes to the screen as it goes and to storage once, at the end:
     `paintRef` carries the working copy so a sweep over twenty cells is twenty repaints
     and one save, not twenty saves. */
  const paintRef = useRef<Record<string, Iv[]> | null>(null)
  const cellId = (day: string, ti: number) => `${day}|${ti}`
  // one slot turned over, on a working copy rather than on the stored answer
  function flipIn(map: Record<string, Iv[]>, day: string, ti: number): Record<string, Iv[]> {
    const w0 = ti * step, w1 = w0 + step
    const cur = map[day] ?? []
    const on = cur.some((iv) => iv.s <= w0 && iv.e >= w1)
    return { ...map, [day]: normalizeIv(on ? cur.flatMap((iv) => subtract(iv, w0, w1)) : [...cur, { s: w0, e: w1 }]) }
  }
  // is a slot wholly inside one of the blocks
  function cellOn(map: Record<string, Iv[]>, day: string, ti: number): boolean {
    const w0 = ti * step, w1 = w0 + step
    return (map[day] ?? []).some((iv) => iv.s <= w0 && iv.e >= w1)
  }
  // one slot set to a state, on a working copy: already there means untouched
  function setIn(map: Record<string, Iv[]>, day: string, ti: number, on: boolean): Record<string, Iv[]> {
    if (cellOn(map, day, ti) === on) return map
    const w0 = ti * step, w1 = w0 + step
    const cur = map[day] ?? []
    return { ...map, [day]: normalizeIv(on ? [...cur, { s: w0, e: w1 }] : cur.flatMap((iv) => subtract(iv, w0, w1))) }
  }
  function flipSlot(day: string, ti: number) {
    const next = flipIn(paintRef.current ?? mineRef.current, day, ti)
    paintRef.current = next
    setMine(next)
    return next
  }
  /* The sweep rebuilt from scratch: every cell the trail holds, set the sweep's way on
     top of what the day looked like before the press. A trail is as long as the cells the
     pointer crossed, so this stays cheap. */
  function applyTrail(d: Extract<Drag, { kind: 'paint' }>) {
    let next = d.base
    for (const id of d.trail) {
      const cut = id.lastIndexOf('|')
      next = setIn(next, id.slice(0, cut), Number(id.slice(cut + 1)), d.on)
    }
    paintRef.current = next
    setMine(next)
  }

  // ── coordinate + snapping helpers ──
  const snap5 = (m: number) => Math.max(0, Math.min(gridMax, Math.round(m / 5) * 5))
  const rowStart = (m: number) => Math.max(0, Math.min(gridMax - step, Math.floor(m / step) * step))

  // start a paint sweep from a cell: shared by the mouse (on press) and touch (after the hold).
  // Pressed over one of your own blocks it only arms — a release without moving selects it.
  function beginDrag(day: string, ti: number, clientX: number, clientY: number, top: number, height: number) {
    const di = weekDaysRef.current.findIndex((d) => d.key === day)
    if (di < 0) return
    const gridMin = Math.max(0, Math.min(gridMax, ti * step + ((clientY - top) / height) * step))
    const hit: Iv | null = (mine[day] ?? []).find((iv) => gridMin >= iv.s && gridMin <= iv.e) ?? null
    const w0 = ti * step, w1 = w0 + step
    paintRef.current = null
    const d: Drag = {
      kind: 'paint', day, di, ti, anchorClientY: clientY, anchorMin: gridMin,
      anchorScrollTop: scroller.current?.scrollTop ?? 0, anchorScrollLeft: scroller.current?.scrollLeft ?? 0,
      trail: [], seen: new Set(), on: !cellOn(mineRef.current, day, ti), lastX: clientX, lastY: clientY, base: mineRef.current, moved: false, hit,
    }
    dragRef.current = d; setDrag(d)
    lastXRef.current = clientX; lastYRef.current = clientY
    if (hit) return // your own block: the press only arms it — release without moving selects it
    // a slot already holding a partial never floods to full — a press in its empty
    // stretch drops a 5-minute band right there instead (a second partial), and the
    // normalize pass coalesces it into anything it touches
    const touching = (mine[day] ?? []).filter((iv) => iv.s < w1 && iv.e > w0)
    if (touching.length > 0) {
      const a = Math.max(0, Math.min(gridMax - MIN_LEN, snap5(gridMin - MIN_LEN / 2)))
      const pm = { ...mineRef.current, [day]: normalizeIv([...(mine[day] ?? []), { s: a, e: a + MIN_LEN }]) }
      paintRef.current = pm; setMine(pm)
      return
    }
    d.trail.push(cellId(day, ti)); d.seen.add(cellId(day, ti))
    flipSlot(day, ti)
  }
  function cancelHold() {
    if (holdRef.current) { clearTimeout(holdRef.current); holdRef.current = null }
  }
  function onCellDown(e: React.PointerEvent, day: string, ti: number) {
    if (mode !== 'edit') return
    const r = e.currentTarget.getBoundingClientRect()
    /* A press within reach of the selected block's own edge is a grab of that edge, never
       the start of a paint. The bar along the edge already takes the press itself; this is
       the backstop for wherever that bar's hit area does not reach, so the press can never
       fall through and paint the box it was meant to trim. */
    const cur = selRef.current
    if (cur && cur.day === day) {
      const min = ti * step + ((e.clientY - r.top) / r.height) * step
      const reach = GRAB_PX / pxPerMin // the bar's half-height, in minutes
      const dTop = Math.abs(min - cur.s), dBot = Math.abs(min - cur.e)
      if (dTop <= reach || dBot <= reach) {
        onHandleDown(e, dTop <= dBot ? 'top' : 'bottom')
        return
      }
    }
    // Touch: don't hijack the gesture outright. A finger that rests for a beat starts the
    // same drag as the mouse (and the browser's scroll is held off from then on); a quick
    // swipe scrolls the grid; a stationary release is a tap-to-mark (see onCellTap).
    if (e.pointerType === 'touch') {
      const t = { day, ti, x: e.clientX, y: e.clientY, top: r.top, height: r.height }
      tapRef.current = t
      cancelHold()
      holdRef.current = setTimeout(() => {
        holdRef.current = null
        if (tapRef.current !== t) return
        tapRef.current = null
        touchDragRef.current = true
        try { navigator.vibrate?.(8) } catch { /* not every phone hums */ }
        beginDrag(day, ti, t.x, t.y, t.top, t.height)
      }, HOLD_MS)
      return
    }
    e.preventDefault()
    // grid editing is driven by a window key listener, not element focus — drop any lingering
    // focus on a toolbar button so arrow-key nudging doesn't paint a stray focus ring on it
    if (document.activeElement instanceof HTMLElement && document.activeElement.tagName === 'BUTTON') document.activeElement.blur()
    touchDragRef.current = false
    beginDrag(day, ti, e.clientX, e.clientY, r.top, r.height)
  }
  // touch release: a real tap (little movement) marks or selects the slot; a moved touch was a
  // scroll; a held one became a drag, which the window-level release commits instead
  function onCellTap(e: React.PointerEvent, day: string, ti: number) {
    if (e.pointerType !== 'touch') return
    cancelHold()
    if (dragRef.current) { tapRef.current = null; return }
    if (mode !== 'edit') return
    const t = tapRef.current; tapRef.current = null
    if (!t || t.day !== day || t.ti !== ti) return
    if (Math.abs(e.clientY - t.y) > SLOP || Math.abs(e.clientX - t.x) > SLOP) return // was a scroll, not a tap
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
    function updateDrag(clientX: number, clientY: number) {
      const d = dragRef.current; if (!d) return
      const scrollDelta = (scroller.current?.scrollTop ?? 0) - d.anchorScrollTop
      const cur = Math.max(0, Math.min(gridMax, d.anchorMin + (clientY - d.anchorClientY + scrollDelta) / pxPerMin))
      if (d.kind === 'paint') {
        /* which cell the pointer is over is asked of the page, not worked out from how far
           it has travelled since the press. The arithmetic version drifts: it has to fold in
           how far the sheet has scrolled underneath, and any layout shift on top of that, and
           a few pixels of drift is a whole row wrongly swept. A filler day carries no label,
           so it is skipped by having nothing to find. */
        const dx = clientX - d.lastX, dy = clientY - d.lastY
        const n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / (CELL / 2)))
        d.lastX = clientX; d.lastY = clientY
        const first = cellId(d.day, d.ti)
        let changed = false
        for (let i = 1; i <= n; i++) {
          const under = document.elementFromPoint(clientX - dx + (dx * i) / n, clientY - dy + (dy * i) / n)?.closest<HTMLElement>('[data-cell]')
          const id = under?.dataset.cell
          // nothing under the point, the cell it started in, or one already swept: left alone
          if (!id || id === first || d.seen.has(id)) continue
          // the drag has left the cell it started in: it is painting a stretch now, not
          // fine-tuning one block, so the handles stand down. The cell it started in joins
          // the trail here — a press on your own block did not flip it, and a press in the
          // empty stretch of a partial dropped a band the sweep now supersedes.
          if (!d.moved) {
            d.moved = true
            setSel(null)
            if (!d.trail.length) { d.trail.push(first); d.seen.add(first) }
          }
          d.trail.push(id); d.seen.add(id)
          changed = true
        }
        if (changed) applyTrail(d)
        dragRef.current = d
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
      /* only a paint sweep scrolls itself along, and only once it is actually sweeping.
         A handle drag never does, or the grid creeps under a resting pointer and stretches
         the block to the whole day; and a sweep that has not moved yet never does either,
         or pressing the top row — which sits inside the edge zone — starts the grid moving
         before the pointer has asked for anything. */
      if (!d || !el || d.kind !== 'paint' || !d.moved) { rafRef.current = 0; return }
      const r = el.getBoundingClientRect()
      const headerH = (el.querySelector('.sticky') as HTMLElement | null)?.offsetHeight ?? 56
      const EDGE = 30, MAX_SPEED = 16
      const y = lastYRef.current, x = lastXRef.current
      let dy = 0, dx = 0
      if (y < r.top + headerH + EDGE) dy = -Math.min(MAX_SPEED, (r.top + headerH + EDGE - y) / 3)
      else if (y > r.bottom - EDGE) dy = Math.min(MAX_SPEED, (y - (r.bottom - EDGE)) / 3)
      // sideways too, past the sticky time column — a cross-day drag on a phone reaches every day
      if (d.kind === 'paint') {
        if (x < r.left + timeColRef.current + EDGE) dx = -Math.min(MAX_SPEED, (r.left + timeColRef.current + EDGE - x) / 3)
        else if (x > r.right - EDGE) dx = Math.min(MAX_SPEED, (x - (r.right - EDGE)) / 3)
      }
      if (dy || dx) {
        const beforeY = el.scrollTop, beforeX = el.scrollLeft
        if (dy) el.scrollTop = beforeY + dy
        if (dx) el.scrollLeft = beforeX + dx
        if (el.scrollTop !== beforeY || el.scrollLeft !== beforeX) updateDrag(x, y) // grid moved under the pointer — remap
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    function move(ev: PointerEvent) {
      if (!dragRef.current) return
      lastYRef.current = ev.clientY; lastXRef.current = ev.clientX
      updateDrag(ev.clientX, ev.clientY)
      if (!rafRef.current && dragRef.current?.kind === 'paint') rafRef.current = requestAnimationFrame(tick)
    }
    function up() {
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = 0 }
      const d = dragRef.current; if (!d) return
      dragRef.current = null; touchDragRef.current = false
      if (d.kind === 'paint') {
        const painted = paintRef.current
        paintRef.current = null
        const norm = painted ? commitDays(painted) : null
        /* a press that never left the cell it started in is a click, and a click is what
           asks for the fine-tune bar — on your own block, or on one you just filled. A
           sweep that crossed into another box was painting, and selects nothing. */
        if (d.moved) setSel(null)
        else selectMerged(d.day, norm?.[d.day] ?? mineRef.current[d.day] ?? [], d.anchorMin, 'bottom')
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
    // the browser took the gesture (a scroll won): drop the drag without writing anything
    function cancel() {
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = 0 }
      if (!dragRef.current) return
      dragRef.current = null; touchDragRef.current = false
      paintRef.current = null
      setDrag(null)
    }
    // touch: once a hold has turned into a drag, the finger paints — the grid must not
    // scroll under it. Before the hold lands, a real swipe cancels the hold and scrolls.
    function touchMove(ev: TouchEvent) {
      if (dragRef.current && touchDragRef.current) { if (ev.cancelable) ev.preventDefault(); return }
      const t = tapRef.current, f = ev.touches[0]
      if (t && holdRef.current && f && (Math.abs(f.clientX - t.x) > SLOP || Math.abs(f.clientY - t.y) > SLOP)) cancelHold()
    }
    const el = scroller.current
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
  /* a day poll's calendar sweeps the same way the timetable does: the calendar keeps the
     trail of days the pointer has crossed and hands the whole of it over on every change,
     so dragging back over one shortens the trail and that day goes back to how it was.
     The whole sweep is saved once, when it is let go. */
  const dayBaseRef = useRef<Record<string, Iv[]> | null>(null)
  function sweepDays(trail: string[]) {
    if (mode !== 'edit') return
    dayBaseRef.current ??= mineRef.current
    let next = dayBaseRef.current
    for (const key of trail) next = flipIn(next, key, 0)
    paintRef.current = next
    setMine(next)
  }
  function endDayDrag() {
    dayBaseRef.current = null
    const painted = paintRef.current
    paintRef.current = null
    if (painted) commitDays(painted)
  }
  // a day poll's every control comes through here: one day, a weekday down the whole
  // poll, a week across, or the lot. All on → the tap clears them; anything off → it fills.
  function toggleDays(keys: string[]) {
    if (mode !== 'edit' || !keys.length) return
    const allOn = keys.every((k) => (mine[k]?.length ?? 0) > 0)
    commitDays(Object.fromEntries(keys.map((k) => [k, allOn ? [] : [{ s: 0, e: gridMax }]])))
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

  // intervals to draw for a day. A paint drag has already written itself into `mine`
  // cell by cell, so only a handle drag still needs folding in for its live preview.
  function renderIvsFor(day: string): Iv[] {
    const d = drag
    const base = mine[day] ?? []
    if (!d || d.kind === 'paint' || d.day !== day) return base
    return [...base.filter((iv) => !(iv.s === d.origS && iv.e === d.origE)), ...(d.block ? [d.block] : [])]
  }

  // bulk changes (clear, calendar import) are instant with an undo window instead
  // of a scary confirm — the old times sit in state until the toast expires.
  // times: null makes it a plain notice with no Undo button
  const [undo, setUndo] = useState<{ times: Record<string, Iv[]> | null; label: string; importedIv?: AvailIntervals } | null>(null)
  const toastRef = useRef<HTMLDivElement>(null)
  useGSAP(() => {
    if (!undo || !toastRef.current) return
    gsap.fromTo(toastRef.current, { y: -16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.3, ease: 'power3.out' })
  }, { dependencies: [undo] })
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (undoTimer.current) clearTimeout(undoTimer.current) }, [])
  function stashUndo(times: Record<string, Iv[]> | null, label: string, importedIv?: AvailIntervals) {
    setUndo({ times, label, importedIv })
    if (undoTimer.current) clearTimeout(undoTimer.current)
    undoTimer.current = setTimeout(() => setUndo(null), 8000)
  }
  function clearAllMine() {
    const snapshot = mine
    const next = Object.fromEntries(event.days.map((d) => [d.key, [] as Iv[]]))
    setMine(next); persist(next)
    setSel(null)
    stashUndo(snapshot, 'Your times were cleared')
  }
  // an undone import takes its marker back too, the same way it was set
  function markImportedUndo(iv: AvailIntervals) { if (event.demo) return; if (onPatch) onPatch({ importedIv: iv }); else patchEvent(event.id, { importedIv: iv }) }
  function undoRestore() {
    const times = undo?.times
    if (!times) return
    setMine(times); persist(times)
    if (undo?.importedIv) markImportedUndo(undo.importedIv)
    setUndo(null)
    if (undoTimer.current) clearTimeout(undoTimer.current)
  }

  // calendar import: fetch busy as UTC instants, convert to event-tz grid minutes, and
  // apply in one step. No preview modal — the action is additive-only and the grid
  // shows the result right away, so the toast (what landed, Undo) is confirmation enough.
  async function startImport(provider: string, opts: { returned?: boolean } = {}) {
    if (!event.days.every((d) => ISO_DAY.test(d.key))) {
      stashUndo(null, 'Calendar import works on events you create, not this sample.')
      return
    }
    // with a backend the calendars are real: no token yet means a trip to the provider
    // that lands back here with ?import=google or ?import=outlook (see the effect
    // below); otherwise the sample calendar stands in so the flow can be tried without keys
    const remote: OAuthProvider | null = provider === 'Google Calendar' ? 'google' : provider === 'Outlook' ? 'azure' : null
    let busy: UtcBusy[]
    if (remote && backendOn) {
      const back = `/events/${event.id}?tab=availability&import=${remote === 'google' ? 'google' : 'outlook'}`
      const trip = async () => { const err = await connectCalendar(remote, back); if (err) stashUndo(null, err) }
      const token = await providerToken()
      if (!token) { await trip(); return }
      const r = remote === 'google'
        ? await googleBusyUtc(token, event.days, gridStartMin, gridMax, event.timezone)
        : await outlookBusyUtc(token, event.days, gridStartMin, gridMax, event.timezone)
      if (r.error === 'auth') { await trip(); return }
      // a token from a plain log-in has no calendar permission: ask for it with one trip.
      // Back from that trip and still refused, the reason is on the provider's side.
      if (r.error === 'scope') {
        if (!opts.returned) { await trip(); return }
        stashUndo(null, remote === 'google'
          ? 'Google would not share your calendar even after asking. The Calendar API may be off for this app, or the permission was refused.'
          : 'Microsoft would not share your calendar even after asking. The permission may have been refused.')
        return
      }
      if (r.error) { stashUndo(null, r.error); return }
      busy = r.busy
    } else {
      busy = mockBusyUtc(event.days)
    }
    const data = buildImportPreview(busy, event.days, gridStartMin, gridMax, event.timezone)
    const busyDays = Object.entries(data).filter(([, di]) => di.busy.length > 0)
    const calendar = provider === 'Outlook' ? 'Outlook calendar' : provider // "your Google Calendar", "your Outlook calendar"
    const span = event.days.length > 1 ? `${event.days[0].date} and ${event.days[event.days.length - 1].date}` : event.days[0]?.date ?? 'these days'
    // the two ends of the scale get said out loud: nothing on the calendar means every
    // hour is free and painted, everything busy means every hour is striped and nothing
    // is painted, and the toast says which happened
    const none = busyDays.length === 0
    const allBusy = !none && Object.values(data).every((di) => (dayPoll ? di.busy.length > 0 : di.free.length === 0))
    // the busy marker grows with every import and never shrinks on its own: what a
    // calendar said stays visible, striped, under whatever is painted later
    const wasImported = event.importedIv ?? {}
    const importedIv: AvailIntervals = { ...wasImported }
    for (const [day, di] of busyDays) importedIv[day] = { ...(importedIv[day] ?? {}), [meId]: normalizeIv([...(importedIv[day]?.[meId] ?? []), ...(dayPoll ? [{ s: 0, e: gridMax }] : di.busy)]) }
    // the marker lives on the event, so it goes through the page's live patch when there
    // is one: the stripes show the moment the import lands, not after the next reload
    const markImported = (iv: AvailIntervals) => { if (event.demo) return; if (onPatch) onPatch({ importedIv: iv }); else patchEvent(event.id, { importedIv: iv }) }
    const snapshot = mineRef.current
    const next = { ...snapshot }
    if (dayPoll) {
      // a day poll: a day with nothing on the calendar is marked as one you can make,
      // a day with something on it is striped as busy and left for you to decide
      let addedDays = 0
      for (const [day, di] of Object.entries(data)) {
        if (di.busy.length || snapshot[day]?.length) continue
        next[day] = [{ s: 0, e: gridMax }]
        addedDays++
      }
      setMine(next); persist(next); markImported(importedIv); setSel(null)
      const busyPart = `${busyDays.length} ${busyDays.length === 1 ? 'day is' : 'days are'} striped as busy`
      stashUndo(snapshot, none
        ? `Nothing on your ${calendar} between ${span}, so every day is marked as one you can make.`
        : allBusy
          ? `Your ${calendar} has something on every one of these days, so they are all striped and none is marked.`
          : addedDays ? `${addedDays} free ${addedDays === 1 ? 'day' : 'days'} marked from your ${calendar}, and ${busyPart}` : `Nothing new to mark from your ${calendar}, but ${busyPart}`, wasImported)
      return
    }
    // merge, never remove: imported free times join whatever is already marked.
    // `addedMin` counts only genuinely new minutes (free minus what's already there)
    let addedMin = 0
    for (const [day, di] of Object.entries(data)) {
      let add = di.free
      for (const iv of snapshot[day] ?? []) add = add.flatMap((a) => subtract(a, iv.s, iv.e))
      addedMin += add.reduce((m, iv) => m + (iv.e - iv.s), 0)
      next[day] = normalizeIv([...(next[day] ?? []), ...di.free])
    }
    if (addedMin === 0) {
      // nothing to paint: every hour is busy, or already painted by hand. The busy
      // stretches are striped either way.
      const changed = JSON.stringify(importedIv) !== JSON.stringify(wasImported)
      if (changed) markImported(importedIv)
      // new stripes can be undone even though nothing was painted
      stashUndo(changed ? snapshot : null, allBusy
        ? `Your ${calendar} is busy for all of these times, so they are all striped and nothing is marked free.`
        : `Nothing new to add from your ${calendar}, but its busy times are striped now.`, changed ? wasImported : undefined)
      return
    }
    setMine(next); persist(next); markImported(importedIv); setSel(null)
    stashUndo(snapshot, none
      ? `Nothing on your ${calendar} between ${span}, so every hour is marked free.`
      : `Added ${fmtDur(addedMin)} of free time from your ${calendar}. Its busy times are striped.`, wasImported)
  }

  // back from Google or Microsoft with the calendar permission: finish the import
  // that started it, once, and take the marker off the address bar
  const importOnce = useRef(false)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    const which = url.searchParams.get('import')
    const provider = which === 'google' ? 'Google Calendar' : which === 'outlook' ? 'Outlook' : null
    if (!provider) return
    // a tick later, so the import's own state changes land after this render. The
    // marker leaves the address bar only when the import really starts: an effect
    // that is run, cleaned up and run again (development does that) must find it
    // still there, or the import would never happen at all.
    const t = setTimeout(() => {
      if (importOnce.current) return
      importOnce.current = true
      url.searchParams.delete('import')
      window.history.replaceState(window.history.state, '', url.toString())
      void startImport(provider, { returned: true })
    }, 0)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
  const editTotal = filterOnEarly ? filter.size + (filter.has(meId) ? 0 : 1) : total

  // live per-day intervals while editing (folds in the current drag); only the dragged day changes
  const editIvsByDay = useMemo<Record<string, Iv[]>>(
    () => (mode === 'edit' ? Object.fromEntries(cols.map((d) => [d.key, renderIvsFor(d.key)])) : {}),
    [mode, mine, drag, page], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const editCombinedByDay = useMemo<Record<string, Record<string, Iv[]>>>(
    () => (mode === 'edit' ? Object.fromEntries(cols.map((d) => [d.key, combinedFor(d.key, editIvsByDay[d.key], othersFiltered)])) : {}),
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

  /* the day calendar reads whole days, not minutes: one id list per day. Hoisted once
     per render rather than recomputed per cell, so a hundred people stay cheap. */
  const idsWithTimes = (src: AvailIntervals, key: string) => {
    const byPid = src[key]
    return byPid ? Object.keys(byPid).filter((id) => byPid[id].length > 0) : []
  }
  const dayFreeIds = useMemo<Record<string, string[]>>(
    () => (dayPoll ? Object.fromEntries(event.days.map((d) => [d.key, idsWithTimes(viewCombinedByDay, d.key)])) : {}),
    [dayPoll, viewCombinedByDay], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const dayOtherIds = useMemo<Record<string, string[]>>(
    () => (dayPoll ? Object.fromEntries(event.days.map((d) => [d.key, idsWithTimes(othersFiltered, d.key)])) : {}),
    [dayPoll, othersFiltered], // eslint-disable-line react-hooks/exhaustive-deps
  )

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

  // drag-to-grow: the corner grip stretches the panel between its default height (the
  // floor) and just tall enough to show every row (the ceiling — no dead space past it).
  // Page scroll folds into the math, and holding the pointer at the viewport's edge
  // auto-scrolls so the drag can keep going past the fold.
  const rootRef = useRef<HTMLDivElement>(null)
  const baseHRef = useRef<number | null>(null)
  const [panelH, setPanelH] = useState<number | null>(null)
  // the floor: enough of the sheet to still be a calendar, and never more than about
  // half of what is in front of you. Measured against the screen AND against the
  // toolbar, hint and best-answer line wrapped above and below the rows — on a phone
  // that chrome is most of a screen's worth, and a floor that ignored it handed the
  // grip a card whose rows had been squeezed to ten pixels behind it.
  const floorH = () => {
    const el = rootRef.current, sc = scroller.current
    const chrome = el && sc ? Math.max(0, el.getBoundingClientRect().height - sc.clientHeight) : 0
    return Math.round(Math.max(chrome + MIN_GRID_H, Math.min(window.innerHeight * 0.45, 420)))
  }
  // a height dragged at one size is the wrong height at the next. Turning the phone,
  // the address bar folding away, or the layout crossing into its side-by-side form
  // all leave the number stale: too short to be a calendar, or tall enough to hang
  // empty space under the last row. Measure again against what is on screen now.
  useEffect(() => {
    if (panelH === null) return
    const settle = () => setPanelH((h) => {
      const sc = scroller.current
      if (h === null) return h
      const dead = sc ? Math.max(0, sc.clientHeight - sc.scrollHeight) : 0
      return Math.max(floorH(), h - dead)
    })
    window.addEventListener('resize', settle)
    window.addEventListener('orientationchange', settle)
    return () => { window.removeEventListener('resize', settle); window.removeEventListener('orientationchange', settle) }
  }, [panelH === null]) // eslint-disable-line react-hooks/exhaustive-deps
  function onResizeDown(e: React.PointerEvent) {
    e.preventDefault()
    const el = rootRef.current
    if (!el) return
    const startH = el.getBoundingClientRect().height
    if (baseHRef.current === null && panelH === null) baseHRef.current = startH
    // a panel whose natural height is already under the floor has nothing to give
    // back: the floor must not shove it taller the moment the grip is touched
    const minH = Math.min(startH, floorH())
    const sc = scroller.current
    // the ceiling is the height at which the last row ends, so the grip never drags
    // out dead space. Below lg the scroller is still wearing its viewport cap at this
    // moment — it comes off on the first render with a height — but the sum is the
    // same either way: what is on screen plus what is scrolled out of sight.
    const maxH = startH + (sc ? Math.max(0, sc.scrollHeight - sc.clientHeight) : 0)
    const startY = e.clientY
    let lastY = e.clientY
    let raf = 0
    // only the scrolling this drag asked for counts. Reading window.scrollY instead
    // fed back on itself: a shrink makes the page shorter, the browser scrolls up to
    // suit, and that read as more dragging, so the grid fell to its floor from the
    // first inch of movement.
    let autoScrolled = 0
    const scrollBy = (n: number) => { const was = window.scrollY; window.scrollBy(0, n); autoScrolled += window.scrollY - was }
    const apply = () => {
      const dy = (lastY - startY) + autoScrolled
      setPanelH(Math.round(Math.max(minH, Math.min(maxH, startH + dy))))
    }
    const EDGE = 56
    const tick = () => {
      const vh = window.innerHeight
      if (lastY > vh - EDGE) scrollBy(Math.min(18, (lastY - (vh - EDGE)) / 2))
      else if (lastY < EDGE + 60) scrollBy(-Math.min(18, (EDGE + 60 - lastY) / 2))
      apply()
      raf = requestAnimationFrame(tick)
    }
    const move = (ev: PointerEvent) => { lastY = ev.clientY; apply() }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      cancelAnimationFrame(raf)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    raf = requestAnimationFrame(tick)
  }

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

  /* what the calendar frames in ochre. Reference only, so it waits for view mode the
     same way the time grid's best-day chip does. */
  const calBestKeys = useMemo(() => {
    if (!dayPoll || mode !== 'view') return null
    if (blockKeys) return blockKeys
    return block ? new Set([block.startKey]) : null
  }, [dayPoll, mode, blockKeys, block])
  const calBestLabel = blockLen === 1 ? 'Best day' : `Best ${blockLen} days`

  // who still hasn't marked any availability (to nudge)
  const respondedIds = respondedIdSet
  const missing = rosterSorted.filter((p) => !respondedIds.has(p.id) && p.rsvp !== 'not_going')
  // filtered-in people with nothing marked — an empty grid needs to say why
  const unmarked = filterOn
    ? [...filter].filter((id) => !respondedIds.has(id)).map((id) => pById.get(id)).filter((p): p is Participant => !!p)
    : []
  const unmarkedNudgees = unmarked.filter((p) => !p.you)
  const labelDays = weekDays.filter((d) => !d.pad)
  const rangeLabel = labelDays.length ? (labelDays.length > 1 ? `${labelDays[0].date} – ${labelDays[labelDays.length - 1].date}` : labelDays[0].date) : ''
  // the day calendar shows every day at once, so its label is the whole poll
  const pollRange = event.days.length > 1 ? `${event.days[0].date} – ${event.days[event.days.length - 1].date}` : event.days[0]?.date ?? ''
  const allDaysOn = event.days.length > 0 && event.days.every((d) => (mine[d.key]?.length ?? 0) > 0)

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
    if (!dayPoll) {
      const target = Math.max(0, ((bw.s + bw.e) / 2) * pxPerMin - el.clientHeight / 2)
      el.scrollTop = target
      setScrollTop(target)
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [focusBest]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    // the panel hugs its rows: a short evening grid ends just under its last row, and
    // a long day takes the whole viewport under the header and scrolls inside. The
    // grip below can still stretch it further, which is when the inline height takes over.
    <div
      ref={rootRef}
      className={`relative flex flex-col rounded-2xl border border-border bg-s1 lg:flex-row ${dayPoll || panelH !== null ? '' : 'lg:max-h-[calc(100dvh-88px)]'}`}
      style={!dayPoll && panelH !== null ? { height: panelH } : undefined}
    >
      <div ref={colRef} data-tour="grid-all" className="relative flex min-w-0 min-h-0 flex-1 flex-col p-4">
        {/* toolbar — first row pairs the mode toggle with Settings (always right-aligned);
            the week nav and time controls flow on their own row below */}
        <div className="border-b border-border pb-[13px]">
          {editable && (
            <div className="mb-2.5 flex items-center justify-between gap-[9px]">
              <SegmentedControl size="sm" value={mode} onChange={(v) => { setMode(v as Mode); setSel(null); setDetail(null) }} options={[{ v: 'view', l: 'View' }, { v: 'edit', l: 'Edit mine' }]} />
              <Popover
                align="end"
                width={284}
                trigger={(open) => (
                  <span className={`flex h-7 items-center gap-1.5 rounded-lg border px-[10px] text-[12.5px] font-medium ${open ? 'border-accent bg-accent-bg text-accent-text' : 'border-border bg-s1 hover:border-border2'}`}>
                    <SlidersHorizontal size={13} /> Settings
                  </span>
                )}
              >
                {() => (
                  <div className="flex flex-col gap-3 p-1">
                    {/* the length as a track the width of the panel, the value named
                        beside its label, the way the wizard asks it */}
                    {isHost && !daysAnswer && (
                      <DurationField
                        value={durationMin} max={Math.max(step, event.times.length * step)} onChange={changeDuration}
                        title={<span className="text-[11px] font-semibold uppercase tracking-[.12em] text-faint">Event length</span>}
                      />
                    )}
                    {isHost && <div className={daysAnswer ? '' : 'border-t border-border pt-2.5'}>
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
                    </div>}
                    {!daysAnswer && <div className={isHost ? 'border-t border-border pt-2.5' : ''}>
                      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[.12em] text-faint">Time format</div>
                      <Segment value={h24 ? '24' : '12'} onChange={(v) => setH24(v === '24')} options={[{ v: '12', l: '12-hour' }, { v: '24', l: '24-hour' }]} />
                    </div>}
                    {/* the days that only square the week off. Out of the toolbar and
                        in here: it is a preference about the view, not an action */}
                    {!dayPoll && (hasLead || hasTrail) && (
                      <div className="border-t border-border pt-2.5">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[11px] font-semibold uppercase tracking-[.12em] text-faint">Whole week</span>
                          <Switch on={wholeWeek} onChange={setWholeWeek} label="Show the whole week" />
                        </div>
                        <p className="mt-1.5 text-[12px] leading-[1.5] text-faint">Shows the days around the poll, greyed out.</p>
                      </div>
                    )}
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
          {dayPoll ? (
            <span className="text-[13.5px] font-semibold leading-tight">
              {pollRange}
              <span className="font-medium text-faint"> ({event.days.length} days)</span>
            </span>
          ) : (
            <div className="flex items-center gap-[3px]">
              <IconBtn onClick={() => goWeek(-1)} disabled={page === 0} label="Previous week"><ChevronLeft size={17} /></IconBtn>
              <span className="px-1 text-center text-[13.5px] font-semibold leading-tight">
                {rangeLabel}
                {pageCount > 1 && <> <span className="font-medium text-faint">(week {page + 1} of {pageCount})</span></>}
              </span>
              <IconBtn onClick={() => goWeek(1)} disabled={page >= pageCount - 1} label="Next week"><ChevronRight size={17} /></IconBtn>
            </div>
          )}
          {/* it lives in Settings, which only a grid you can edit has; a read-only
              grid keeps it here so nobody loses the days around the poll */}
          {!editable && !dayPoll && (hasLead || hasTrail) && (
            <button
              type="button"
              onClick={() => setWholeWeek((w) => !w)}
              aria-pressed={wholeWeek}
              title={wholeWeek ? 'Show only the days this poll asks about' : 'Show the whole week around the days this poll asks about'}
              className={`flex h-7 flex-none items-center gap-1.5 rounded-lg border px-[9px] text-[12.5px] font-medium ${wholeWeek ? 'border-accent-border bg-accent-bg text-accent-text' : 'border-border bg-s1 text-dim hover:border-border2 hover:text-text'}`}
            >
              {wholeWeek ? <ChevronsRightLeft size={13} /> : <ChevronsLeftRight size={13} />}
              Whole week
            </button>
          )}
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
          {!locked && mode === 'edit' && <ImportFromCalendar soon={backendOn && process.env.NEXT_PUBLIC_CALENDAR_IMPORT_ON !== '1'} onPick={(p) => void startImport(p)} note={backendOn ? (dayPoll ? 'Free days are marked for you. Days with something on your calendar are striped as busy, for you to decide.' : 'Your free hours are painted, and what your calendar has is striped as busy.') : 'A sample calendar stands in until a backend is set up.'} />}
          </div>
        </div>

        {/* participants + edit hint */}
        <div data-tour="people" className="flex flex-wrap items-center gap-2.5 py-[11px]">
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
              <MissingPopover missing={missing} nudged={nudged} canNudge={canNudge} note={nudgeNote} onNudge={nudge} onNudgeAll={nudgeAll} onClose={() => setShowMissing(false)} />
            )}
          </div>
          {mode === 'edit' && (dayPoll
            ? !allDaysOn && (
                <button
                  type="button"
                  onClick={fillAllDays}
                  className="flex h-11 items-center gap-1.5 rounded-lg border border-border bg-s1 px-[11px] text-[12.5px] font-medium hover:border-border2 sm:h-7"
                >
                  <Zap size={13} /> Free for all of it
                </button>
              )
            : <PresetFills onFill={fillPreset} onFillAll={fillAllDays} />)}
          {/* the explicit empty reply: with nothing marked, "none of these days work"
              is one tap — and marking any time takes it back */}
          {mode === 'edit' && !locked && !youAny && (
            unavail.has(meId) ? (
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
              {dayPoll
                ? `${coarse ? 'Tap' : 'Click'} the days you can make it. A weekday heading marks every one of them, and the rail on the left marks a week.`
                : (coarse ? 'Hold a moment, then drag across the days and times you’re free. The checkmarks fill a whole day or row at once.' : 'Drag across the days and times you’re free. The checkmarks fill a whole day or row at once.')}
            </span>
          )}
          {mode === 'edit' && !sel && hasImported && <span className="text-[12.5px] text-faint">{dayPoll ? 'Striped days are busy on your calendar.' : 'Striped times are busy on your calendar.'}</span>}
          {locked && <span className="text-[12.5px] text-faint">Planning is locked. The grid stays for reference.</span>}
          {notListed && !locked && !event.demo && (
            <span className="flex flex-wrap items-center gap-2 text-[12.5px] text-dim">
              You are not on this event yet, so the grid is read only.
              <button
                type="button"
                onClick={() => { const added = addMeToEvent(event.id); if (added) onPatch?.({ participants: [...event.participants, added] }) }}
                className="flex h-8 items-center rounded-[9px] bg-accent px-3 text-[12.5px] font-semibold text-on-accent"
              >
                Add me
              </button>
            </span>
          )}
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
                <div className="flex flex-col gap-2.5 p-1 text-[12px] leading-[1.5] text-dim">
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
              {unmarkedNudgees.length > 0 && canNudge && (
                <button
                  onClick={() => void nudgeMany(unmarkedNudgees.filter((p) => !nudged.has(p.id)).map((p) => p.id))}
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
              <button onClick={deleteSel} className="flex h-11 items-center gap-1.5 rounded-[8px] border border-brick-border bg-s1 px-3 text-[12.5px] font-semibold text-brick-text hover:bg-brick-bg sm:h-8 sm:px-2.5">
                <Trash2 size={14} /> Remove
              </button>
              <button onClick={() => setSel(null)} className="flex h-11 items-center rounded-[8px] border border-border2 bg-s1 px-3 text-[12.5px] font-semibold hover:bg-s2 sm:h-8 sm:px-2.5">Done</button>
            </div>
          </div>
        )}

        {/* one line of how the grid works, gone once dismissed. Edit mode has its own
            line about dragging, so the hint stays out of its way there */}
        {mode !== 'edit' && (
          <Hint name="grid" className="mb-2">
            {!editable ? 'The greener a slot, the more people are free then.'
              : dayPoll ? 'Tap the days you can make. The greener a day, the more people can.'
                : 'Switch to Edit mine and drag across the hours you can make. The greener a slot, the more people can.'}
          </Hint>
        )}

        {/* grid — a day poll gets the calendar, everything else the timetable */}
        {dayPoll ? (
          <div
            ref={scroller}
            data-tour="grid"
            onScroll={onGridScroll}
            className={`scroll-slim min-h-0 flex-1 overflow-auto rounded-[10px] border border-border pb-2 ${panelH === null ? 'max-h-[calc(100dvh-200px)] lg:max-h-none' : ''}`}
          >
            <DayCalendar
              days={event.days}
              mode={mode}
              editable={editable}
              marked={(k) => (mine[k]?.length ?? 0) > 0}
              imported={(k) => (importedMine[k]?.length ?? 0) > 0}
              freeIds={dayFreeIds}
              otherIds={dayOtherIds}
              total={mode === 'edit' ? editTotal : viewTotal}
              bestKeys={calBestKeys}
              bestLabel={calBestLabel}
              avatarOf={avatarOf}
              byRoster={byRoster}
              narrow={narrow}
              cellW={Math.max(40, ((viewportW || 700) - (narrow ? 44 : 60)) / 7)}
              openKey={detail?.day ?? null}
              onToggleDays={toggleDays}
              onSweep={sweepDays}
              onDragEnd={endDayDrag}
              onOpenDetail={(e, key) => openDetail(e, key, 0)}
            />
          </div>
        ) : (
        <div
          ref={scroller}
          data-tour="grid"
          onScroll={onGridScroll}
          // a held finger is how painting starts on a phone — it must not open the long-press menu
          onContextMenu={(e) => { if (mode === 'edit') e.preventDefault() }}
          className={`scroll-slim min-h-0 flex-1 overflow-auto rounded-[10px] border border-border pb-2 ${panelH === null ? 'max-h-[calc(100dvh-200px)] lg:max-h-none' : ''}`}
          // the seam button on the last day hangs half its width past the sheet's right
          // edge, and a scroller clips whatever leaves it: weeks with days after the
          // poll keep that half-width free so the button stays whole
          style={{ WebkitTouchCallout: 'none' } as React.CSSProperties}
        >
          {/* width tracks the day count: a single day must fit the screen without a
              horizontal scroll, and shouldn't stretch into one huge column either */}
          <div
            ref={gridEl}
            className="grid"
            style={{
              gridTemplateColumns: `${timeCol}px ${cols.map(colTrack).join(' ')}`,
              minWidth: narrow ? 0 : timeCol + cols.reduce((w, d) => w + COL_MIN, 0),
              maxWidth: timeCol + cols.reduce((w, d) => w + (d.pad && narrow ? PAD_W : 280), 0),
            }}
          >
            {/* header row — every cell placed by hand, so the seam buttons below can
                share a cell with the day they belong to instead of taking a column of
                their own. The corner stays pinned through both scroll directions. */}
            <div style={{ gridColumn: 1, gridRow: 1 }} className="sticky left-0 top-0 z-[30] border-b border-r border-grid-edge bg-s0"/>
            {cols.map((d, di) => {
              // filler day outside the event's window — labeled but inert
              if (d.pad) {
                return (
                  <div key={d.key} style={{ gridColumn: di + 2, gridRow: 1 }} className={`sticky top-0 z-20 border-b border-r border-border bg-s0 py-2 text-center ${narrow ? 'px-0' : 'px-1.5'}`}>
                    <div className="text-[11px] text-faint">{d.dow}</div>
                    {!narrow && <div className="text-[14px] font-semibold text-faint">{d.date}</div>}
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
                    gridColumn: di + 2,
                    gridRow: 1,
                    background: isBestDay || inBlock ? 'var(--best-head)' : 'var(--s0)',
                    boxShadow: inBlock ? 'inset 0 2px 0 var(--ochre)' : undefined,
                    cursor: mode === 'edit' ? 'pointer' : 'default',
                  }}
                  title={mode === 'edit' ? 'Click to fill the whole day' : undefined}
                >
                  <div className={`text-dim ${narrow ? 'text-[10px]' : 'text-[11px]'}`}>{narrow ? d.dow[0] : d.dow}</div>
                  <div className={`font-semibold leading-tight ${narrow ? 'text-[13px]' : 'text-[14px]'}`} style={{ color: isBestDay || inBlock ? 'var(--ochre-text)' : 'var(--text)' }}>
                    {narrow ? (
                      <>
                        <span className="block h-[10px] text-[8.5px] font-semibold uppercase leading-[10px] tracking-[.06em] text-faint">{monthTurn(di) ? d.date.split(' ')[0] : ''}</span>
                        {d.date.split(' ')[1]}
                      </>
                    ) : d.date}
                  </div>
                  {mode === 'edit' && (
                    <span className={`mx-auto mt-[3px] grid h-4 w-4 place-items-center rounded-[5px] border ${dayFull ? 'border-accent bg-accent text-on-accent' : 'border-border2 text-transparent'}`}>
                      <Check size={11} />
                    </span>
                  )}
                  {mode === 'view' && (blockFirst
                    ? <span className={`mt-[3px] inline-block whitespace-nowrap rounded-[5px] border border-ochre-border bg-ochre-bg py-px font-semibold text-ochre-text ${narrow ? 'px-[3px] text-[9px]' : 'px-[5px] text-[9.5px]'}`}>{narrow ? `Best ${blockLen}` : `Best ${blockLen} days`}</span>
                    : isBestDay
                      ? <span className={`mt-[3px] inline-block whitespace-nowrap rounded-[5px] border border-ochre-border bg-ochre-bg py-px font-semibold text-ochre-text ${narrow ? 'px-[3px] text-[9px]' : 'px-[5px] text-[9.5px]'}`}>{narrow ? 'Best' : 'Best day'}</span>
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
              const rowFull = cols.every((d) => d.pad || (mine[d.key] ?? []).some((iv) => iv.s <= w0 && iv.e >= w1))
              return (
              <div key={ti} className="contents">
                <button
                  type="button"
                  onClick={() => toggleTime(ti)}
                  /* the rail reads like a chart axis: the time sits ON the line that
                     opens its row, not floating in the middle of it, and the rule is a
                     tick between the label and the grid — clear of the label, and with
                     nothing at all to its left. The first row keeps the header's plain
                     border, so the ticks start one step in and the top time is the one
                     time the rail never has to name. */
                  className={`sticky left-0 z-[15] flex items-center justify-end gap-1.5 border-r border-grid-edge bg-s0 px-1.5 font-medium text-dim ${narrow ? 'text-[10px]' : 'text-[12px]'}`}
                  style={{ cursor: mode === 'edit' ? 'pointer' : 'default' }}
                  aria-label={mode === 'edit' ? `Fill ${fmt(gridStartMin + ti * step)} across the week` : `${fmt(gridStartMin + ti * step)} row`}
                  title={mode === 'edit' ? 'Click to fill this time across the week' : undefined}
                >
                  {mode === 'edit' && (
                    <span className={`grid h-3.5 w-3.5 flex-none place-items-center rounded-[4px] border ${rowFull ? 'border-accent bg-accent text-on-accent' : 'border-border2 text-transparent'}`}>
                      <Check size={10} />
                    </span>
                  )}
                  {ti > 0 && (
                    /* the time sits on the rule that opens its row, with a tick either
                       side of it and a gap so neither touches it. The rule is centred on
                       y = -0.5px: the hairline between two rows lives in the last pixel
                       of the row above, so anything drawn at this row's own top edge
                       would sit a pixel low and miss the cell borders it belongs to. */
                    <span
                      className="pointer-events-none absolute inset-x-0 flex -translate-y-1/2 items-center leading-none"
                      style={{ top: '-0.5px', gap: narrow ? 4 : TICK_GAP }}
                    >
                      <span className="h-px flex-1 bg-grid-edge" />
                      <span className="flex items-baseline gap-[3px] whitespace-nowrap">
                        <span>{labelMain}</span>
                        {labelSub && <span className={`font-semibold tracking-[.04em] text-faint ${narrow ? 'text-[8px]' : 'text-[9.5px]'}`}>{labelSub}</span>}
                      </span>
                      <span className="h-px flex-1 bg-grid-edge" />
                    </span>
                  )}
                </button>
                {cols.map((d, di) => {
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
                        {/* the pile sits on the cell's bottom left, beside the count, capped so a
                            hundred-person cell draws a few faces and a chip rather than a hundred nodes */}
                        {n > 0 && (() => {
                          const { shown, chip } = pileFit(n, avatarCap, colW, viewTotal)
                          if (!shown) return null
                          return (
                            <div className="pointer-events-none absolute bottom-[3px] left-[4px] z-[1]">
                              <AvatarRow
                                people={byRoster(peak.ids).slice(0, shown).map(avatarOf)}
                                size={PILE_AV} overlap={PILE_OVER} font={PILE_FONT} max={shown}
                                more={chip ? `+${chip}` : ''}
                              />
                            </div>
                          )
                        })()}
                        {/* one uniform count in every cell — the theme's ink, no backplate */}
                        {n > 0 && (
                          <span className="pointer-events-none absolute bottom-[3px] right-1 z-[1] text-[9.5px] font-bold" style={{ color: 'var(--heat-count)' }}>
                            {n}/{viewTotal}
                          </span>
                        )}
                      </div>
                    )
                  }
                  // edit mode — others' availability as context under your own clay. It is
                  // banded here exactly as it is in view mode: tinting the cell flat at its
                  // busiest minute was the one place left that rounded somebody's partial
                  // out to a whole slot, and everything around it had stopped doing that.
                  const oBands = cellBands(othersFiltered[d.key] ?? {}, w0, w1)
                  const oPaint = mergeSlivers(oBands, minBandDur)
                  const oCount = peakOf(oBands).ids.length
                  const clay = clayFor(oCount)
                  const ivs = editIvsByDay[d.key] ?? []
                  const cnt = peakOf(cellBands(editCombinedByDay[d.key] ?? {}, w0, w1)).ids.length
                  const isTopEdge = !!sel && !dragDel && sel.day === d.key && topCell === ti
                  const isBotEdge = !!sel && !dragDel && sel.day === d.key && botCell === ti
                  return (
                    <div key={d.key} data-cell={cellId(d.key, ti)} className={`relative h-[50px] select-none border-b border-r border-grid-line ${ownLeft(di) ? 'border-l border-l-grid-line' : ''}`} style={{ background: 'var(--s2)', boxShadow: d.best ? 'inset 1px 0 0 0 var(--ochre-border), inset -1px 0 0 0 var(--ochre-border)' : undefined }}>
                      {oPaint.map((b, k) => (
                        <div
                          key={`o${k}`}
                          className="pointer-events-none absolute inset-x-0"
                          style={{
                            top: `${((b.s - w0) / step) * 100}%`,
                            height: `${((b.e - b.s) / step) * 100}%`,
                            background: heat(b.ids.length, editTotal),
                            borderTop: b.s > w0 ? '1px dashed var(--grid-dash)' : undefined,
                          }}
                        />
                      ))}
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
                      {/* what a calendar import showed as busy: fine stripes over the range, painted
                          or not, so the calendar's word stays readable whatever is painted later */}
                      {(importedMine[d.key] ?? []).map((iv, k) => {
                        const cs = Math.max(iv.s, w0), ce = Math.min(iv.e, w1)
                        if (ce <= cs) return null
                        return (
                          <div
                            key={`i${k}`}
                            className="pointer-events-none absolute inset-x-0 z-[1] opacity-[.22]"
                            style={{ top: `${((cs - w0) / step) * 100}%`, height: `${((ce - cs) / step) * 100}%`, background: 'repeating-linear-gradient(135deg, transparent 0 5px, var(--accent) 5px 6px)' }}
                          />
                        )
                      })}
                      {/* slot line redrawn above the heat fills so saturated cells can't wash it out */}
                      <div className="pointer-events-none absolute z-[1] border-b border-r border-grid-line" style={{ inset: '0 -1px -1px 0' }} />
                      {cnt > 0 && (() => {
                        // color for the surface under the corner: my clay block reaching the
                        // cell's bottom edge wants dark clay text; a full dark heat wants cream;
                        // anything paler (partials included) reads best in dark text
                        const clayAtCorner = ivs.some((iv) => iv.e >= w1 && iv.s < w1)
                        const onDarkHeat = !clayAtCorner && oCount >= editTotal
                        return <span className="pointer-events-none absolute bottom-[2px] right-1 z-[2] text-[9px] font-bold" style={{ color: onDarkHeat ? 'var(--heat-count-full)' : 'var(--you-text)' }}>{cnt}/{editTotal}</span>
                      })()}
                      {/* full-cell hit zone: empty → paint, over a block → select */}
                      <div className="absolute inset-0 z-[5] touch-auto" onPointerDown={(e) => onCellDown(e, d.key, ti)} onPointerUp={(e) => onCellTap(e, d.key, ti)} onPointerCancel={() => { cancelHold(); tapRef.current = null }} />
                      {/* time handles + delete for the selected block */}
                      {isTopEdge && (
                        <>
                          <EdgeHandle pct={topPct} label={fmt(gridStartMin + sel!.s)} active={sel!.edge === 'top'} side={topSide} onDown={(e) => onHandleDown(e, 'top')} />
                          {/* a mouse gets the small cross on the block's edge; a finger would find it
                              jammed against the drag bar, so on touch the selection bar's Remove
                              button, sized for a thumb, is the one way to take a block away */}
                          {!coarse && <button
                            type="button"
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={deleteSel}
                            className="pointer-events-auto absolute right-0.5 z-[10] grid h-[15px] w-[15px] place-items-center rounded-full border bg-s1 text-brick shadow-soft"
                            // like the time chip, tuck fully inside the block when the edge hugs the grid top
                            style={{ top: `${topPct}%`, transform: topSide === 'below' ? 'translateY(3px)' : 'translateY(-50%)', borderColor: 'var(--border2)' }}
                            aria-label="Remove this block"
                          >
                            <X size={11} />
                          </button>}
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
        )}

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
              dayLabel={dayPoll ? blockDayLabel(detail.day) : undefined}
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
                    <span className="text-[14px] font-semibold text-ochre">{bw.dayLabel}, {fmt(gridStartMin + bw.s)} – {fmt(gridStartMin + bw.e)}</span>
                    <TimezonePill tz={myTime && canConvert ? localTz : event.timezone} />
                    {bestMode === 'crowd'
                      // never round a partial attendee away: below one person on average,
                      // count everyone who shows up at all instead
                      ? Math.round(bw.avg) >= 1
                        ? <span className="text-[12.5px] font-semibold text-teal-text">around {Math.round(bw.avg)} of {viewTotal} there{bw.count > 0 && <span className="font-normal text-dim">, {bw.count} the whole time</span>}</span>
                        : <span className="text-[12.5px] font-semibold text-teal-text">{bw.anyIds.length} of {viewTotal} there for part of it</span>
                      : <span className="text-[12.5px] font-semibold text-teal-text">{bw.count} of {viewTotal} free</span>}
                    <div className="ml-auto"><AvatarRow people={byRoster(bestMode === 'crowd' ? bw.anyIds : bw.ids).map(avatarOf)} size={22} max={8} overlap={5} /></div>
                    {bwAllShown && (
                      <span className="flex w-full items-center gap-1.5 text-[12.5px] text-dim">
                        <span className="inline-block h-0 w-[18px] border-t-2 border-dashed border-ochre" aria-hidden />
                        Everyone&apos;s best stays marked for comparison: <span className="font-semibold text-text">{bwAllShown.dayLabel}, {fmt(gridStartMin + bwAllShown.s)} – {fmt(gridStartMin + bwAllShown.e)}</span>
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

      {/* undo toast — drops in under the header, gone after 8s */}
      {undo && (
        <div ref={toastRef} className="pointer-events-none fixed inset-x-0 top-[72px] z-50 flex justify-center px-4 md:top-[68px]">
          <div className={`pointer-events-auto flex items-center gap-2.5 rounded-full border border-border bg-s1 py-1.5 pl-4 text-[13px] shadow-soft ${undo.times ? 'pr-1.5' : 'pr-4'}`}>
            {undo.label}
            {undo.times && (
              <button type="button" onClick={undoRestore} className="flex h-8 items-center rounded-full bg-accent px-3.5 text-[13px] font-semibold text-on-accent">
                Undo
              </button>
            )}
          </div>
        </div>
      )}


      {/* corner grip: drag to give the grid more rows, or to hand the height back to
          the page. Wears the same diagonal mark as a resizable textarea, and is a
          thumb's worth of target on a phone. Day polls have nothing to expand. */}
      {!dayPoll && (
        <div
          role="separator"
          aria-label="Drag to resize the grid"
          title="Drag to resize the grid"
          onPointerDown={onResizeDown}
          className="absolute bottom-0 right-0 z-[20] grid h-9 w-9 cursor-ns-resize touch-none place-items-center rounded-tl-[8px] text-faint hover:bg-s2 hover:text-dim lg:h-6 lg:w-6"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
            <path d="M9 1 1 9M9 5 5 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" fill="none" />
          </svg>
        </div>
      )}
    </div>
  )
}

