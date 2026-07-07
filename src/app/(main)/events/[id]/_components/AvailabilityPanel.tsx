'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, CalendarPlus, MessageCircle, X, Send, GripHorizontal, Check } from 'lucide-react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { Avatar } from '@/components/ui/Avatar'
import { AvatarRow } from '@/components/ui/AvatarRow'
import { TimezonePill } from '@/components/ui/TimezonePill'
import {
  patchEvent, availIvOf, intervalsToGrid, normalizeIv, bestWindow, fmtMinute, gridStartMinOf, stepOf,
  type AppEvent, type Participant, type ChatMessage, type Iv, type AvailIntervals,
} from '@/lib/events'

type Mode = 'view' | 'edit'
type Gran = '15' | '30' | '60'
type Edge = 'top' | 'bottom'
type Sel = { day: string; s: number; e: number; edge: Edge }
type Band = { s: number; e: number; ids: string[] } // constant-crowd segment inside one cell

type Drag =
  | { kind: 'paint'; day: string; anchorClientY: number; anchorMin: number; block: Iv | null }
  | {
      kind: 'resize'; day: string; edge: Edge; fixedMin: number
      anchorClientY: number; anchorMin: number; origS: number; origE: number
      block: Iv | null; del: boolean
    }

const CELL = 50 // px per grid row — must match the h-[50px] cell height below
const MIN_LEN = 5 // smallest block, in minutes

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
  const [gran, setGran] = useState<Gran>(event.granularity)
  const [h24, setH24] = useState(false)
  const [chatOpen, setChatOpen] = useState(true)
  const [sel, setSel] = useState<Sel | null>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [page, setPage] = useState(0)

  const WEEK = 7
  const pageCount = Math.max(1, Math.ceil(event.days.length / WEEK))
  const weekDays = event.days.slice(page * WEEK, page * WEEK + WEEK)
  const goWeek = (dir: -1 | 1) => { setPage((p) => Math.max(0, Math.min(pageCount - 1, p + dir))); setSel(null) }

  const fmt = (min: number) => fmtMinute(min, h24)

  const mineRef = useRef(mine); useEffect(() => { mineRef.current = mine }, [mine])
  const selRef = useRef(sel); useEffect(() => { selRef.current = sel }, [sel])
  const dragRef = useRef<Drag | null>(null)
  const scroller = useRef<HTMLDivElement>(null)

  // all-day grids open scrolled to ~8 AM — the whole day stays reachable, mornings-first
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const target = (8 * 60 - gridStartMin) * pxPerMin
    if (target > 0) el.scrollTop = target
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
  const clientYToMin = (anchorMin: number, anchorClientY: number, clientY: number) =>
    Math.max(0, Math.min(gridMax, anchorMin + (clientY - anchorClientY) / pxPerMin))
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
    const d: Drag = { kind: 'paint', day, anchorClientY: e.clientY, anchorMin: gridMin, block: { s: a, e: a + step } }
    dragRef.current = d; setDrag(d); setSel(null)
  }
  function onHandleDown(e: React.PointerEvent, edge: Edge) {
    e.preventDefault(); e.stopPropagation()
    const s = selRef.current; if (!s) return
    const d: Drag = {
      kind: 'resize', day: s.day, edge,
      fixedMin: edge === 'top' ? s.e : s.s,
      anchorClientY: e.clientY, anchorMin: edge === 'top' ? s.s : s.e,
      origS: s.s, origE: s.e, block: { s: s.s, e: s.e }, del: false,
    }
    dragRef.current = d; setDrag(d)
  }

  // window-level drag tracking (raw pointer Y → grid minutes, so handles cross cells cleanly)
  useEffect(() => {
    function move(ev: PointerEvent) {
      const d = dragRef.current; if (!d) return
      const cur = clientYToMin(d.anchorMin, d.anchorClientY, ev.clientY)
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
    function up() {
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
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
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

  function sendMessage(text: string) {
    setMessages((prev) => { const next = [...prev, { id: 'JM', name: 'You', time: 'now', text, you: true }]; if (!event.demo) patchEvent(event.id, { messages: next }); return next })
  }

  // best window (live interval sweep — most people simultaneously free, longest such stretch)
  const combinedIv: AvailIntervals = Object.fromEntries(event.days.map((d) => [d.key, combinedFor(d.key)]))
  const bw = bestWindow(combinedIv, event.days)
  const rangeLabel = weekDays.length ? (weekDays.length > 1 ? `${weekDays[0].date} – ${weekDays[weekDays.length - 1].date}` : weekDays[0].date) : ''

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
    <div className="flex h-[calc(100dvh-300px)] max-h-[820px] min-h-[480px] overflow-hidden rounded-2xl border border-border bg-s1">
      <div className="flex min-w-0 flex-1 flex-col p-4">
        {/* toolbar */}
        <div className="flex flex-wrap items-center gap-[9px] border-b border-border pb-[13px]">
          <Segment value={mode} onChange={(v) => { setMode(v as Mode); setSel(null) }} options={[{ v: 'view', l: 'View' }, { v: 'edit', l: 'Edit mine' }]} />
          <span className="h-5 w-px bg-border" />
          <div className="flex items-center gap-[3px]">
            <IconBtn onClick={() => goWeek(-1)} disabled={page === 0}><ChevronLeft size={15} /></IconBtn>
            <span className="px-1 text-center text-[12px] font-semibold leading-tight">
              {rangeLabel}
              {pageCount > 1 && <span className="ml-1 font-medium text-faint">· Week {page + 1}/{pageCount}</span>}
            </span>
            <IconBtn onClick={() => goWeek(1)} disabled={page >= pageCount - 1}><ChevronRight size={15} /></IconBtn>
          </div>
          <button className="flex h-7 items-center gap-1.5 rounded-lg border border-border bg-s1 px-[11px] text-[11.5px] font-medium hover:border-border2">
            <CalendarPlus size={13} /> Google Calendar
          </button>
          <div className="flex-1" />
          <Segment value={h24 ? '24' : '12'} onChange={(v) => setH24(v === '24')} options={[{ v: '12', l: '12h' }, { v: '24', l: '24h' }]} compact />
          <Segment value={gran} onChange={(v) => setGran(v as Gran)} options={[{ v: '15', l: '15 min' }, { v: '30', l: '30 min' }, { v: '60', l: '1 hr' }]} compact />
          {!chatOpen && (
            <button onClick={() => setChatOpen(true)} className="flex h-7 items-center gap-1.5 rounded-lg border border-border bg-s1 px-[11px] text-[11.5px] font-semibold hover:border-border2">
              <MessageCircle size={13} /> Discussion
              {messages.length > 0 && <span className="flex h-[15px] items-center rounded-[10px] bg-accent px-[5px] text-[9px] text-on-accent">{messages.length}</span>}
            </button>
          )}
        </div>

        {/* participants + edit hint */}
        <div className="flex flex-wrap items-center gap-2.5 py-[11px]">
          <span className="text-[11px] text-dim">Participants</span>
          <AvatarRow people={event.participants.map((p) => ({ initials: p.initials, name: p.name, color: p.color }))} size={22} max={8} overlap={5} />
          <span className="ml-1.5 text-[11px] text-dim">{responded} of {total} responded</span>
          {mode === 'edit' && (
            <span className="text-[11px] text-faint">· Drag to block out time. Click a block to fine-tune with the handles, or arrow keys to nudge by the minute.</span>
          )}
        </div>

        {/* grid */}
        <div ref={scroller} className="scroll-slim flex-1 overflow-auto rounded-[10px] border border-border">
          <div className="grid min-w-[520px]" style={{ gridTemplateColumns: `54px repeat(${weekDays.length}, minmax(72px, 1fr))` }}>
            {/* header row */}
            <div className="sticky top-0 z-20 border-b border-r border-border bg-s0" />
            {weekDays.map((d) => {
              const dayFull = mode === 'edit' && mine[d.key]?.length === 1 && mine[d.key][0].s === 0 && mine[d.key][0].e === gridMax
              return (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => toggleDay(d.key)}
                  className="sticky top-0 z-10 border-b border-r border-border px-1.5 py-2 text-center"
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

            {/* body rows */}
            {event.times.map((_, ti) => {
              const rowMin = gridStartMin + ti * step
              const rowH = Math.floor(rowMin / 60) % 24
              const rowMm = String(rowMin % 60).padStart(2, '0')
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
                    const bands = cellBands(combinedFor(d.key), w0, w1)
                    const peak = peakOf(bands)
                    const n = peak.ids.length
                    const paint = mergeSlivers(bands, minBandDur)
                    const title = bands.length === 1
                      ? (n ? `${n} of ${total} free` : 'No one free')
                      : bands.map((b) => `${fmt(gridStartMin + b.s)} – ${fmt(gridStartMin + b.e)}: ${b.ids.length} free`).join('\n')
                    return (
                      <div key={d.key} className="relative min-h-[50px] border-b border-r border-border" style={{ boxShadow: d.best ? 'inset 1px 0 0 0 var(--teal-border), inset -1px 0 0 0 var(--teal-border)' : undefined }} title={title}>
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
                        <div className="relative z-[1] flex flex-wrap content-start gap-0.5 p-[5px]">
                          {peak.ids.map((id) => { const a = avatarOf(id); return <Avatar key={id} initials={a.initials} color={a.color} size={15} font={7.5} title={a.name} /> })}
                        </div>
                        {n > 0 && <span className="pointer-events-none absolute bottom-[3px] right-1 z-[1] text-[8.5px] font-bold" style={{ color: n >= total ? '#F4F1EA' : '#46604F' }}>{n}/{total}</span>}
                      </div>
                    )
                  }
                  // edit mode — others' context tinted at their peak concurrency; my blocks in clay above
                  const oBands = cellBands(others[d.key] ?? {}, w0, w1)
                  const oCount = peakOf(oBands).ids.length
                  const clay = clayFor(oCount)
                  const ivs = renderIvsFor(d.key)
                  const cnt = peakOf(cellBands(combinedFor(d.key, ivs), w0, w1)).ids.length
                  const isTopEdge = !!sel && !dragDel && sel.day === d.key && topCell === ti
                  const isBotEdge = !!sel && !dragDel && sel.day === d.key && botCell === ti
                  return (
                    <div key={d.key} className="relative h-[50px] select-none border-b border-r border-border" style={{ background: heat(oCount, total), boxShadow: d.best ? 'inset 1px 0 0 0 var(--teal-border), inset -1px 0 0 0 var(--teal-border)' : undefined }}>
                      {ivs.map((iv, k) => {
                        const cs = Math.max(iv.s, w0), ce = Math.min(iv.e, w1)
                        if (ce <= cs) return null
                        return (
                          <div
                            key={k}
                            className="pointer-events-none absolute inset-x-0"
                            style={{
                              top: `${((cs - w0) / step) * 100}%`,
                              height: `${((ce - cs) / step) * 100}%`,
                              background: clay,
                              borderTop: cs > w0 ? '1px dashed #C2A468' : undefined,
                              borderBottom: ce < w1 ? '1px dashed #C2A468' : undefined,
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
                            className="pointer-events-auto absolute right-0.5 z-[10] grid h-[15px] w-[15px] -translate-y-1/2 place-items-center rounded-full border bg-s1 text-brick shadow-soft"
                            style={{ top: `${topPct}%`, borderColor: 'var(--border2)' }}
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
          </div>
        </div>

        {/* best-window footer */}
        <div className="mt-0.5 flex flex-wrap items-center gap-2.5 border-t border-border px-0.5 pt-3">
          {bw ? (
            <>
              <span className="text-[11px] text-dim">Best so far</span>
              <span className="text-[12.5px] font-semibold">{bw.dayLabel} · {fmt(gridStartMin + bw.s)} – {fmt(gridStartMin + bw.e)}</span>
              <TimezonePill tz={event.timezone} />
              <span className="text-[11px] font-semibold text-teal-text">{bw.count} of {total} free</span>
              <div className="ml-auto"><AvatarRow people={bw.ids.map(avatarOf)} size={20} max={8} overlap={5} /></div>
            </>
          ) : (
            <span className="text-[11px] text-dim">No availability yet. Add yours in <span className="font-semibold text-text">Edit mine</span> to start finding the best time.</span>
          )}
        </div>
      </div>

      {chatOpen && <ChatPanel members={total} messages={messages} onSend={sendMessage} onClose={() => setChatOpen(false)} avatarOf={avatarOf} />}
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
    <div ref={panel} className="flex w-[300px] flex-none flex-col border-l border-border bg-s0">
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
