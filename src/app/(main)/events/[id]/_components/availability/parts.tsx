'use client'

/* the availability panel's satellite components: people filter (strip + modal),
   calendar import (menu + preview), clear-times, drag handles, quick fills,
   the who's-missing popover, the cell breakdown, and small controls */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Bell, CalendarPlus, Check, ChevronDown, Eraser, GripHorizontal, Minus, Plus, Search, X } from 'lucide-react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { Avatar } from '@/components/ui/Avatar'
import { TimezonePill } from '@/components/ui/TimezonePill'
import type { AppEvent, Iv, Participant } from '@/lib/events'
import type { DayImport } from '@/lib/calendar-import'
import { subtract, type Band } from './grid-lib'

/* ── clickable participant strip: tap a person to filter the grid to their free times.
   Capped at 8 avatars; the +N chip opens a modal with EVERYONE, filtered people marked. ── */
export const FILTER_CAP = 8
export function FilterAvatars({ participants, filter, onToggle, onClear }: { participants: Participant[]; filter: Set<string>; onToggle: (id: string) => void; onClear: () => void }) {
  const shown = participants.slice(0, FILTER_CAP)
  const extra = participants.slice(FILTER_CAP)
  const active = filter.size > 0
  const extraOn = extra.filter((p) => filter.has(p.id)).length
  const [pickerOpen, setPickerOpen] = useState(false)
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
        <button
          type="button" onClick={() => setPickerOpen(true)} title="Pick people to filter by"
          className={`ml-1.5 grid h-[25px] min-w-[25px] place-items-center rounded-full border px-1.5 text-[10.5px] font-bold ${extraOn > 0 ? 'border-accent-border bg-accent-bg text-accent-text' : 'border-border2 bg-s1 text-dim'}`}
        >
          +{extra.length}
        </button>
      )}
      {pickerOpen && (
        <FilterModal participants={participants} filter={filter} onToggle={onToggle} onClear={onClear} onClose={() => setPickerOpen(false)} />
      )}
    </span>
  )
}

/* the full people picker: everyone in roster order, the filtered group marked */
export function FilterModal({ participants, filter, onToggle, onClear, onClose }: {
  participants: Participant[]; filter: Set<string>; onToggle: (id: string) => void; onClear: () => void; onClose: () => void
}) {
  const root = useRef<HTMLDivElement>(null)
  const card = useRef<HTMLDivElement>(null)
  useGSAP(() => {
    gsap.timeline()
      .fromTo(root.current, { opacity: 0 }, { opacity: 1, duration: 0.2, ease: 'power2.out' })
      .fromTo(card.current, { y: 12, opacity: 0 }, { y: 0, opacity: 1, duration: 0.3, ease: 'power3.out' }, '<')
  }, { scope: root })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const [q, setQ] = useState('')
  const list = q.trim() ? participants.filter((p) => p.name.toLowerCase().includes(q.trim().toLowerCase())) : participants
  return (
    <div
      ref={root}
      className="fixed inset-0 z-50 grid place-items-center bg-[rgba(0,0,0,.25)] p-4"
      onPointerDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div ref={card} className="flex max-h-[calc(100dvh-32px)] w-full max-w-[360px] flex-col rounded-2xl border border-border bg-s1 shadow-soft">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-[.13em] text-faint">Filter the grid</div>
            <div className="mt-0.5 text-[15.5px] font-semibold">Pick people</div>
          </div>
          <button onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-[8px] text-dim hover:bg-s2 hover:text-text">
            <X size={16} />
          </button>
        </div>
        <div className="flex min-h-0 flex-col px-3 py-2.5">
          {participants.length > 8 && (
            <div className="mb-1.5 flex items-center gap-1.5 rounded-[8px] border border-border bg-s0 px-2 focus-within:border-border2">
              <Search size={12} className="flex-none text-faint" />
              <input
                autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a person"
                className="h-8 w-full min-w-0 bg-transparent text-[13px] outline-none placeholder:text-faint"
              />
            </div>
          )}
          <div className="scroll-slim flex min-h-0 flex-1 flex-col overflow-auto">
            {list.map((p) => {
              const on = filter.has(p.id)
              return (
                <button key={p.id} type="button" onClick={() => onToggle(p.id)} className={`flex items-center gap-2.5 rounded-[8px] px-2 py-2 text-left text-[13.5px] font-medium hover:bg-s2 ${on ? 'bg-s2' : ''}`}>
                  <Avatar initials={p.initials} color={p.color} size={24} font={9.5} />
                  <span className="min-w-0 flex-1 truncate">{p.name}{p.you && <span className="font-normal text-faint"> (You)</span>}</span>
                  {on && <span className="flex flex-none items-center gap-1 text-[11.5px] font-semibold text-accent-text">In filter <Check size={13} /></span>}
                </button>
              )
            })}
            {list.length === 0 && <span className="px-2 py-1.5 text-[12.5px] text-faint">No one matches.</span>}
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3">
          <button
            type="button" onClick={onClear} disabled={filter.size === 0}
            className="text-[13px] font-semibold text-dim enabled:hover:text-brick-text disabled:opacity-40"
          >
            Clear filter{filter.size > 0 ? ` (${filter.size})` : ''}
          </button>
          <button type="button" onClick={onClose} className="flex h-9 items-center rounded-[9px] bg-accent px-4 text-[13.5px] font-semibold text-on-accent">
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── import preview: confirm what the calendar import will mark before it lands ── */
export function ImportPreview({ provider, data, mine, days, tz, fmt, gridStartMin, onApply, onClose }: {
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
export function ImportFromCalendar({ onPick }: { onPick: (provider: string) => void }) {
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
export function useClampX(open: boolean) {
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
export function ClearTimes({ onClear }: { onClear: () => void }) {
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

export function EdgeHandle({ pct, label, active, side, onDown }: { pct: number; label: string; active: boolean; side: 'above' | 'below'; onDown: (e: React.PointerEvent) => void }) {
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

/* ── quick-fill presets (edit mode): fill a standard block across every visible day,
   or the whole event in one tap for the always-free ── */
export function PresetFills({ onFill, onFillAll }: { onFill: (startClock: number, endClock: number) => void; onFillAll: () => void }) {
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
export function MissingPopover({ missing, nudged, onNudge, onNudgeAll, onClose }: { missing: Participant[]; nudged: Set<string>; onNudge: (id: string) => void; onNudgeAll: () => void; onClose: () => void }) {
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
export function CellDetail({ bands, total, fmt, gridStartMin, avatarOf, onPerson, filter, style, onClose }: {
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
export function Segment({ value, onChange, options, compact }: { value: string; onChange: (v: string) => void; options: { v: string; l: string }[]; compact?: boolean }) {
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
export function EdgeNudge({ label, value, onLess, onMore }: { label: string; value: string; onLess: () => void; onMore: () => void }) {
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
export function IconBtn({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
  return <button type="button" onClick={onClick} disabled={disabled} className="grid h-7 w-7 place-items-center rounded-[7px] border border-border bg-s1 text-dim enabled:hover:text-text disabled:opacity-40">{children}</button>
}
