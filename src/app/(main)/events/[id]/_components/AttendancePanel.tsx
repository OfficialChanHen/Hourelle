'use client'

import { useMemo, useState } from 'react'
import { Clock, MapPin, TriangleAlert } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { availIvOf, bestWindow, gridStartMinOf, fmtMinute, stepOf, type AppEvent, type Participant, type Iv } from '@/lib/events'
import { computeItinerary } from '@/lib/itinerary'
import { ALL_MODES, type TravelMode } from '@/lib/travel'

type Cover = 'full' | 'partial' | 'none' | 'nodata'
// how fully a person's free time covers a [s, e) window (grid minutes)
function coverOf(ivs: Iv[] | undefined, s: number, e: number): Cover {
  if (e <= s) return 'nodata'
  if (!ivs || ivs.length === 0) return 'nodata'
  if (ivs.some((iv) => iv.s <= s && iv.e >= e)) return 'full'
  if (ivs.some((iv) => iv.s < e && iv.e > s)) return 'partial'
  return 'none'
}
// the span a person is actually around inside a window (for the "arrives late / leaves early" note)
function windowOf(ivs: Iv[] | undefined, s: number, e: number): { s: number; e: number } | null {
  const clipped = (ivs ?? []).map((iv) => ({ s: Math.max(iv.s, s), e: Math.min(iv.e, e) })).filter((iv) => iv.e > iv.s)
  if (!clipped.length) return null
  return { s: Math.min(...clipped.map((c) => c.s)), e: Math.max(...clipped.map((c) => c.e)) }
}

export function AttendancePanel({ event }: { event: AppEvent }) {
  const hasItinerary = (event.itinStops?.length ?? 0) > 0
  const [model, setModel] = useState<'single' | 'itin'>(hasItinerary ? 'itin' : 'single')

  const availIv = availIvOf(event)
  const gridStart = gridStartMinOf(event)
  const step = stepOf(event.granularity)
  const rows = event.times.length
  const best = bestWindow(availIv, event.days, event.durationMin ?? 60)
  const dayKey = best?.dayKey ?? event.days[0]?.key
  const dayIv = (dayKey && availIv[dayKey]) || {}

  const attendees = event.participants.filter((p) => p.rsvp === 'attending' || p.rsvp === 'maybe')
  const anyResponded = event.participants.some((p) => p.rsvp !== 'pending')

  return (
    <div className="flex flex-col gap-4">
      {/* header — friendly summary + (only when relevant) the model switch */}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <RsvpSummary event={event} />
        {hasItinerary && (
          <SegmentedControl
            size="sm"
            value={model}
            onChange={(v) => setModel(v as 'single' | 'itin')}
            options={[{ v: 'single', l: 'Single venue' }, { v: 'itin', l: 'Itinerary' }]}
          />
        )}
      </div>

      {!anyResponded ? (
        <EmptyState />
      ) : model === 'itin' && hasItinerary ? (
        <ItineraryAttendance event={event} attendees={attendees} dayIv={dayIv} gridStart={gridStart} />
      ) : (
        <SingleVenue event={event} attendees={attendees} best={best} dayIv={dayIv} gridStart={gridStart} step={step} rows={rows} />
      )}
    </div>
  )
}

/* ── shared: RSVP figure (borderless, open stats) ── */
function RsvpSummary({ event }: { event: AppEvent }) {
  const going = event.participants.filter((p) => p.rsvp === 'attending').length
  const maybe = event.participants.filter((p) => p.rsvp === 'maybe').length
  const out = event.participants.filter((p) => p.rsvp === 'not_going').length
  const noReply = event.participants.filter((p) => p.rsvp === 'pending').length
  const total = event.participants.length
  return (
    <div>
      <div className="flex items-baseline gap-2">
        <span className="font-serif text-[42.5px] leading-none">{going}</span>
        <span className="text-[14.5px] text-dim">going of {total}</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
        {maybe > 0 && <span className="text-ochre-text">{maybe} maybe</span>}
        {out > 0 && <span className="text-brick-text">{out} can&apos;t</span>}
        {noReply > 0 && <span className="text-faint">{noReply} no reply</span>}
      </div>
    </div>
  )
}

/* ── Single venue: who's in the room, and when ── */
function SingleVenue({
  event, attendees, best, dayIv, gridStart, step, rows,
}: {
  event: AppEvent; attendees: Participant[]; best: ReturnType<typeof bestWindow>
  dayIv: Record<string, Iv[]>; gridStart: number; step: number; rows: number
}) {
  const [view, setView] = useState<'roster' | 'timeline'>('roster')
  const winS = best?.s ?? 0
  const winE = best?.e ?? rows * step

  // group attendees by how their availability lines up with the event window — RSVP leads,
  // availability only splits "going" into whole-time vs part-of-the-time.
  const groups = useMemo(() => {
    const whole: Participant[] = [], part: { p: Participant; s: number; e: number | null }[] = []
    const maybe: Participant[] = [], out: Participant[] = [], noReply: Participant[] = []
    for (const p of event.participants) {
      if (p.rsvp === 'not_going') { out.push(p); continue }
      if (p.rsvp === 'pending') { noReply.push(p); continue }
      if (p.rsvp === 'maybe') { maybe.push(p); continue }
      const cover = best ? coverOf(dayIv[p.id], winS, winE) : 'nodata'
      if (cover === 'partial' || cover === 'none') {
        const w = windowOf(dayIv[p.id], winS, winE)
        part.push({ p, s: w ? w.s : winS, e: w ? w.e : null })
      } else whole.push(p)
    }
    return { whole, part, maybe, out, noReply }
  }, [event.participants, dayIv, best, winS, winE])

  return (
    <div className="rounded-2xl border border-border bg-s1 p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="text-[11px] font-semibold uppercase tracking-[.13em] text-faint">Who&apos;s coming</div>
        <SegmentedControl size="sm" value={view} onChange={(v) => setView(v as 'roster' | 'timeline')}
          options={[{ v: 'roster', l: 'Roster' }, { v: 'timeline', l: 'Timeline' }]} />
      </div>

      {view === 'roster' ? (
        <div className="flex flex-col gap-4">
          <RosterGroup label="Here the whole time" tone="teal" people={groups.whole.map((p) => ({ p }))} />
          <RosterGroup label="Part of the time" tone="ochre" people={groups.part.map((x) => ({ p: x.p, note: x.e != null ? `${fmtMinute(gridStart + x.s)}–${fmtMinute(gridStart + x.e)}` : 'time conflict' }))} />
          <RosterGroup label="Maybe" tone="ochre" people={groups.maybe.map((p) => ({ p }))} />
          <RosterGroup label="Can't make it" tone="brick" people={groups.out.map((p) => ({ p }))} />
          <RosterGroup label="No reply" tone="faint" people={groups.noReply.map((p) => ({ p }))} />
        </div>
      ) : (
        <DayTimeline attendees={attendees} best={best} dayIv={dayIv} gridStart={gridStart} step={step} rows={rows}
          whole={groups.whole} part={groups.part} winS={winS} winE={winE} />
      )}
    </div>
  )
}

const TONE: Record<string, { dot: string; text: string }> = {
  teal: { dot: 'var(--teal)', text: 'text-teal-text' },
  ochre: { dot: 'var(--ochre)', text: 'text-ochre-text' },
  brick: { dot: 'var(--brick)', text: 'text-brick-text' },
  faint: { dot: 'var(--faint)', text: 'text-faint' },
}

function RosterGroup({ label, tone, people, cap = 12 }: { label: string; tone: keyof typeof TONE | string; people: { p: Participant; note?: string }[]; cap?: number }) {
  if (!people.length) return null
  const t = TONE[tone] ?? TONE.faint
  const shown = people.slice(0, cap)
  const extra = people.length - shown.length
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: t.dot }} />
        <span className={`text-[13.5px] font-semibold ${t.text}`}>{label}</span>
        <span className="text-[12.5px] text-faint">{people.length}</span>
      </div>
      <div className="flex flex-col gap-1.5">
        {shown.map(({ p, note }) => (
          <div key={p.id} className="flex items-center gap-2.5">
            <Avatar initials={p.initials} color={p.color} size={27} font={10} />
            <span className="min-w-0 flex-1 truncate text-[14px]">{p.name}{p.you && <span className="text-faint"> · you</span>}</span>
            {note && <span className="flex flex-none items-center gap-1 text-[12.5px] text-dim"><Clock size={12} /> {note}</span>}
          </div>
        ))}
        {extra > 0 && <div className="pl-[34px] text-[12.5px] text-faint">and {extra} more</div>}
      </div>
    </div>
  )
}

/* Timeline: collapse whole-time attendees into one bar; give part-time people their own row */
function DayTimeline({
  attendees, best, dayIv, gridStart, step, rows, whole, part, winS, winE,
}: {
  attendees: Participant[]; best: ReturnType<typeof bestWindow>
  dayIv: Record<string, Iv[]>; gridStart: number; step: number; rows: number
  whole: Participant[]; part: { p: Participant; s: number; e: number | null }[]; winS: number; winE: number
}) {
  // headcount across the event day — how many attendees are free per slot
  const counts = useMemo(() => Array.from({ length: rows }, (_, ti) => {
    const s = ti * step, e = (ti + 1) * step
    return attendees.filter((p) => (dayIv[p.id] ?? []).some((iv) => iv.s < e && iv.e > s)).length
  }), [attendees, dayIv, rows, step])
  const peak = Math.max(1, ...counts)
  const total = Math.max(1, attendees.length)
  const span = Math.max(1, winE - winS)
  const pct = (m: number) => `${(((m - winS) / span) * 100).toFixed(1)}%`
  const wid = (a: number, b: number) => `${(((b - a) / span) * 100).toFixed(1)}%`

  if (!best) {
    return <div className="rounded-xl border border-border bg-s0 px-4 py-6 text-center text-[13.5px] text-dim">Add availability to see who is around when.</div>
  }

  return (
    <div className="flex flex-col gap-4">
      {/* free-through-the-day bars */}
      <div>
        <div className="flex h-16 items-end gap-[2px]">
          {counts.map((c, i) => {
            const frac = c / total
            const bg = frac === 0 ? 'var(--s2)' : frac >= 0.85 ? 'var(--teal)' : frac >= 0.5 ? '#9DBBA4' : frac >= 0.25 ? '#CFE0D2' : '#EBF1EB'
            return <span key={i} className="flex-1 rounded-t-[2px]" style={{ height: `${Math.max(6, (c / peak) * 100)}%`, background: bg }} title={`${fmtMinute(gridStart + i * step)} · ${c} free`} />
          })}
        </div>
        <div className="mt-1.5 flex justify-between text-[11px] text-faint">
          <span>{fmtMinute(gridStart)}</span>
          <span className="text-dim">Best window {fmtMinute(gridStart + winS)}–{fmtMinute(gridStart + winE)}</span>
          <span>{fmtMinute(gridStart + rows * step)}</span>
        </div>
      </div>

      {/* who's in the room, within the best window */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <span className="w-[92px] flex-none truncate text-[13px] font-medium text-teal-text">Whole time</span>
          <div className="relative h-6 flex-1 rounded-[7px] bg-s2">
            <div className="absolute inset-y-0 rounded-[7px] bg-teal-bg" style={{ left: 0, width: '100%' }} />
            <span className="absolute inset-0 flex items-center px-2 text-[12px] font-semibold text-teal-text">{whole.length} {whole.length === 1 ? 'person' : 'people'}</span>
          </div>
        </div>
        {part.map(({ p, s, e }) => (
          <div key={p.id} className="flex items-center gap-3">
            <span className="flex w-[92px] flex-none items-center gap-1.5 truncate text-[13px]"><Avatar initials={p.initials} color={p.color} size={20} font={8.5} /> {p.name.split(' ')[0]}</span>
            <div className="relative h-6 flex-1 rounded-[7px] bg-s2">
              {e != null
                ? <div className="absolute inset-y-0 rounded-[7px] bg-ochre-bg" style={{ left: pct(s), width: wid(s, e) }} />
                : <span className="absolute inset-0 flex items-center px-2 text-[12px] text-brick-text">time conflict</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Multi-stop itinerary: O(1) per stop, exceptions not a matrix ── */
function ItineraryAttendance({
  event, attendees, dayIv, gridStart,
}: { event: AppEvent; attendees: Participant[]; dayIv: Record<string, Iv[]>; gridStart: number }) {
  const placeName = (id: string) => event.location.places.find((p) => p.id === id)?.name ?? 'Stop'
  const stops = event.itinStops ?? []
  const dwell = event.itinDwell ?? []
  const startMin = event.itinStartMin ?? 9 * 60

  // schedule + per-stop attendance, computed once (O(stops × people)). The schedule comes from
  // the shared helper, so these clock times match the Location tab exactly.
  const stopData = useMemo(() => {
    const inputStops = stops.map((placeId, i) => ({ placeId, dwell: dwell[i] ?? 60 }))
    const modes = ((event.travelModes as TravelMode[] | undefined) ?? []).filter((m) => ALL_MODES.includes(m))
    const { schedule } = computeItinerary(event.location.places, inputStops, startMin, modes)
    return schedule.map((s, i) => {
      const sG = s.arrive - gridStart, eG = s.depart - gridStart
      const present: Participant[] = [], partial: Participant[] = [], absent: Participant[] = []
      for (const p of attendees) {
        const c = coverOf(dayIv[p.id], sG, eG)
        if (c === 'none') absent.push(p)
        else { present.push(p); if (c === 'partial') partial.push(p) }
      }
      return { placeId: s.placeId, name: placeName(s.placeId), i, arrive: s.arrive, depart: s.depart, present, partial, absent }
    })
  }, [stops, dwell, startMin, gridStart, attendees, dayIv, event.location.places, event.travelModes]) // eslint-disable-line react-hooks/exhaustive-deps

  // people missing at least one stop → the exceptions list (never an O(people × stops) grid)
  const exceptions = useMemo(() => attendees
    .map((p) => ({ p, misses: stopData.filter((s) => s.absent.some((a) => a.id === p.id)).map((s) => s.i + 1) }))
    .filter((x) => x.misses.length > 0), [attendees, stopData])
  const attendAll = attendees.length - exceptions.length
  const peak = Math.max(1, ...stopData.map((s) => s.present.length))

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-border bg-s1 p-5">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <div className="text-[14.5px]"><span className="font-serif text-[24.5px]">{attendAll}</span> <span className="text-dim">of {attendees.length} attend all {stops.length} stops</span></div>
          <div className="text-[11px] font-semibold uppercase tracking-[.13em] text-faint">Headcount by stop</div>
        </div>
        {/* headcount strip — one bar per stop, full vs part-time */}
        <div className="flex items-end gap-2">
          {stopData.map((s) => {
            const h = (s.present.length / peak) * 100
            const partFrac = s.present.length ? s.partial.length / s.present.length : 0
            return (
              <div key={s.i} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                <div className="flex h-20 w-full items-end justify-center">
                  <div className="relative w-full max-w-[38px] overflow-hidden rounded-t-[3px] bg-s2" style={{ height: `${Math.max(8, h)}%` }}>
                    <div className="absolute inset-x-0 top-0 bg-ochre" style={{ height: `${partFrac * 100}%` }} />
                    <div className="absolute inset-x-0 bottom-0 bg-teal" style={{ height: `${(1 - partFrac) * 100}%` }} />
                  </div>
                </div>
                <span className="grid h-4 w-4 flex-none place-items-center rounded-full bg-accent text-[10px] font-bold text-on-accent">{s.i + 1}</span>
                <span className="w-full truncate text-center text-[10.5px] text-dim">{s.present.length}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* per-stop cards — bounded work, capped pile, flag chips */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {stopData.map((s) => (
          <div key={s.i} className="rounded-xl border border-border bg-s1 p-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="grid h-6 w-6 flex-none place-items-center rounded-full bg-accent text-[12.5px] font-bold text-on-accent">{s.i + 1}</span>
              <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{s.name}</span>
              <span className="flex flex-none items-center gap-1 text-[12px] text-faint"><Clock size={11} /> {fmtMinute(s.arrive)}</span>
            </div>
            <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-s2">
              <div className="h-full rounded-full bg-teal" style={{ width: `${(s.present.length / Math.max(1, attendees.length)) * 100}%` }} />
            </div>
            <div className="mb-2.5 text-[12.5px] text-dim">{s.present.length} of {attendees.length} here</div>
            <div className="flex items-center justify-between">
              <AvatarPile people={s.present} cap={6} />
              <div className="flex flex-wrap justify-end gap-1">
                {s.partial.length > 0 && <Flag tone="ochre">{s.partial.length} partial</Flag>}
                {s.absent.length > 0 && <Flag tone="brick">{s.absent.length} out</Flag>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* exceptions — only people with gaps get a row */}
      <div className="rounded-2xl border border-border bg-s1 p-5">
        <div className="mb-3 text-[11px] font-semibold uppercase tracking-[.13em] text-faint">Gaps</div>
        {exceptions.length === 0 ? (
          <div className="flex items-center gap-2 text-[14px] text-teal-text"><span className="h-1.5 w-1.5 rounded-full bg-teal" /> Everyone going makes every stop.</div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {exceptions.map(({ p, misses }) => (
              <div key={p.id} className="flex items-center gap-2.5">
                <Avatar initials={p.initials} color={p.color} size={27} font={10} />
                <span className="min-w-0 flex-1 truncate text-[14px]">{p.name}</span>
                <div className="flex flex-wrap justify-end gap-1">
                  {misses.map((n) => <span key={n} className="grid h-5 w-5 place-items-center rounded-full border border-brick-border bg-brick-bg text-[10.5px] font-semibold text-brick-text" title={`Misses stop ${n}`}>{n}</span>)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function AvatarPile({ people, cap }: { people: Participant[]; cap: number }) {
  const shown = people.slice(0, cap)
  const extra = people.length - shown.length
  return (
    <div className="flex items-center">
      {shown.map((p) => <span key={p.id} className="-mr-1.5"><Avatar initials={p.initials} color={p.color} size={25} font={9.5} ring /></span>)}
      {extra > 0 && <span className="ml-2.5 text-[12.5px] font-semibold text-dim">+{extra}</span>}
      {people.length === 0 && <span className="text-[12.5px] text-faint">nobody yet</span>}
    </div>
  )
}

function Flag({ tone, children }: { tone: 'ochre' | 'brick'; children: React.ReactNode }) {
  const cls = tone === 'ochre' ? 'border-ochre-border bg-ochre-bg text-ochre-text' : 'border-brick-border bg-brick-bg text-brick-text'
  return <span className={`flex items-center gap-1 rounded-[6px] border px-1.5 py-px text-[10.5px] font-semibold ${cls}`}>{tone === 'brick' && <TriangleAlert size={10} />}{children}</span>
}

function EmptyState() {
  return (
    <div className="grid min-h-[280px] place-items-center rounded-2xl border border-dashed border-border2 bg-s1 px-6 text-center">
      <div className="max-w-sm">
        <span className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-xl border border-border bg-s2 text-dim"><MapPin size={22} /></span>
        <p className="font-serif text-[27px] tracking-[-0.01em]">No responses yet</p>
        <p className="mt-1.5 text-[14px] text-dim">As people RSVP and mark when they are free, the headcount and roster fill in here.</p>
      </div>
    </div>
  )
}
