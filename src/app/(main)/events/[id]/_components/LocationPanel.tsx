'use client'

import { Fragment, useEffect, useRef, useState } from 'react'
import { MapPin, MapPinOff, Video, Link2, ArrowUp, Route, X, ChevronUp, ChevronDown, Vote, Check, Copy, RefreshCw, Search, Plus, Loader2, Footprints, Car, Bus, TrainFront, Plane, GripVertical, Trash2, TriangleAlert } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { patchEvent, type AppEvent, type EventPlace, type Participant } from '@/lib/events'
import { estimateModes, fastestMode, fmtDuration, MODE_LABEL, type TravelMode, type ModeEstimate } from '@/lib/travel'
import { useFlipReorder } from '@/hooks/useFlipReorder'
import { SegmentedControl } from '@/components/ui/SegmentedControl'

// ~0.6 km per map-percent — puts a metro-area offsite in walk/drive/transit range
const KM_PER_PCT = 0.6
const MODE_ICON: Record<TravelMode, typeof Car> = { walk: Footprints, bus: Bus, drive: Car, train: TrainFront, flight: Plane }

const YOU = 'JM'
// a stop references a place but has its own id, so the same venue can appear more than once
type ItinStop = { uid: string; placeId: string }
// deterministic pin spots on the fake map, by place index (stable regardless of ranking)
const PIN_SLOTS = [
  { left: '27%', top: '60%' }, { left: '55%', top: '38%' }, { left: '70%', top: '72%' },
  { left: '38%', top: '22%' }, { left: '16%', top: '34%' }, { left: '82%', top: '28%' },
  { left: '48%', top: '80%' }, { left: '64%', top: '14%' },
]

export function LocationPanel({ event }: { event: AppEvent }) {
  const loc = event.location
  // places are editable on this tab (host, or guests once the host allows it)
  const [places, setPlaces] = useState<EventPlace[]>(loc.places)
  const [guestsCanSuggest, setGuestsCanSuggest] = useState(!!loc.guestsCanSuggest)
  const canAddPlaces = event.hostedByYou || guestsCanSuggest
  const pById = new Map(event.participants.map((p) => [p.id, p]))
  const avatarOf = (id: string) => {
    const p = pById.get(id)
    return { initials: p?.initials ?? id, name: p?.name ?? id, color: p?.color ?? ('gray' as Participant['color']) }
  }

  const [votes, setVotes] = useState<Record<string, string[]>>(() => event.votes ?? {})
  const stopUid = useRef(0)
  const [stops, setStops] = useState<ItinStop[]>(() =>
    (event.itinStops ?? []).filter((id) => loc.places.some((p) => p.id === id)).map((placeId) => ({ uid: `s${stopUid.current++}`, placeId })),
  )
  const [builtRank, setBuiltRank] = useState<string[]>(() => event.itinRank ?? [])
  const [sub, setSub] = useState<'vote' | 'itin'>(loc.planMode === 'itinerary' ? 'itin' : 'vote')
  const [focusPin, setFocusPin] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [adding, setAdding] = useState(false) // itinerary "add a stop" picker open
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null) // placeId pending delete confirm

  function persist(patch: { votes?: Record<string, string[]>; itinStops?: string[]; itinRank?: string[] }) {
    if (!event.demo) patchEvent(event.id, patch)
  }
  function persistLocation(nextPlaces: EventPlace[], nextSuggest: boolean) {
    if (!event.demo) patchEvent(event.id, { location: { ...loc, places: nextPlaces, guestsCanSuggest: nextSuggest } })
  }
  function addPlace(p: EventPlace) {
    if (places.some((x) => x.id === p.id)) return
    const next = [...places, p]
    setPlaces(next)
    persistLocation(next, guestsCanSuggest)
  }
  function toggleGuestsCanSuggest() {
    const next = !guestsCanSuggest
    setGuestsCanSuggest(next)
    persistLocation(places, next)
  }

  const votesOf = (id: string) => votes[id] ?? []
  const ranked = [...places].sort((a, b) => votesOf(b.id).length - votesOf(a.id).length)
  const rankIds = ranked.map((p) => p.id)
  const leadingId = ranked.length && votesOf(ranked[0].id).length > 0 ? ranked[0].id : null

  function toggleVote(placeId: string) {
    voteFlip.capture() // re-rank slides instead of snapping
    setVotes((v) => {
      const cur = v[placeId] ?? []
      const next = { ...v, [placeId]: cur.includes(YOU) ? cur.filter((x) => x !== YOU) : [...cur, YOU] }
      persist({ votes: next })
      return next
    })
  }
  // owner removes a candidate — confirm first if it already has votes (they'd be lost)
  function attemptRemovePlace(placeId: string) {
    if (votesOf(placeId).length > 0) setConfirmRemove(placeId)
    else removePlace(placeId)
  }
  function removePlace(placeId: string) {
    voteFlip.capture(); itinFlip.capture()
    const nextPlaces = places.filter((p) => p.id !== placeId)
    const nextVotes = { ...votes }; delete nextVotes[placeId]
    const nextStops = stops.filter((s) => s.placeId !== placeId) // drop it from the itinerary too
    setPlaces(nextPlaces); setVotes(nextVotes); setStops(nextStops); setConfirmRemove(null)
    if (!event.demo) {
      patchEvent(event.id, {
        location: { ...loc, places: nextPlaces, guestsCanSuggest },
        votes: nextVotes,
        itinStops: nextStops.map((s) => s.placeId),
      })
    }
  }

  // votes decide WHICH places make the itinerary; geometry decides the SEQUENCE.
  // Nearest-neighbor over the map coordinates stands in for real route optimization
  // (Mapbox Directions later) — raw vote order would zigzag the route.
  function routeOrder(ids: string[]): string[] {
    if (ids.length < 3) return ids
    const pos = (id: string) => { const s = slotFor(id); return { x: parseFloat(s.left), y: parseFloat(s.top) } }
    const remaining = [...ids]
    const route = [remaining.shift()!] // start at the top-voted place
    while (remaining.length) {
      const cur = pos(route[route.length - 1])
      let best = 0, bestD = Infinity
      remaining.forEach((id, i) => {
        const p = pos(id)
        const d = (p.x - cur.x) ** 2 + (p.y - cur.y) ** 2
        if (d < bestD) { bestD = d; best = i }
      })
      route.push(remaining.splice(best, 1)[0])
    }
    return route
  }
  function persistStops(a: ItinStop[]) {
    setStops(a); persist({ itinStops: a.map((s) => s.placeId) })
  }
  const asStops = (ids: string[]): ItinStop[] => ids.map((placeId) => ({ uid: `s${stopUid.current++}`, placeId }))

  function buildFromVotes() {
    itinFlip.capture()
    const top = asStops(routeOrder(rankIds.slice(0, 6)))
    setBuiltRank(rankIds)
    setStops(top); persist({ itinStops: top.map((s) => s.placeId), itinRank: rankIds })
    setSub('itin')
  }
  // add a stop manually — a candidate place, or the same venue again (a revisit)
  function addStop(placeId: string) {
    itinFlip.capture()
    persistStops([...stops, ...asStops([placeId])])
  }
  // add a brand-new place: it joins the candidate list (so it gets a pin) and becomes a stop
  function addNewPlaceAsStop(p: EventPlace) {
    if (!places.some((x) => x.id === p.id)) {
      const nextPlaces = [...places, p]
      setPlaces(nextPlaces)
      persistLocation(nextPlaces, guestsCanSuggest)
    }
    addStop(p.id)
  }
  function moveStop(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= stops.length) return
    itinFlip.capture()
    const a = [...stops]; ;[a[i], a[j]] = [a[j], a[i]]
    persistStops(a)
  }
  // drag-to-reorder, mirroring the create wizard: reorder live as you drag over a row
  function onStopDragEnter(i: number) {
    if (dragIndex === null || dragIndex === i) return
    itinFlip.capture()
    const a = [...stops]
    const [m] = a.splice(dragIndex, 1)
    a.splice(i, 0, m)
    persistStops(a)
    setDragIndex(i)
  }
  function removeStop(i: number) {
    itinFlip.capture()
    persistStops(stops.filter((_, k) => k !== i))
  }
  function keepCurrentItin() {
    setBuiltRank(rankIds); persist({ itinRank: rankIds })
  }
  // the itinerary came from votes, and voting has since reshuffled the ranking
  const rankChanged = stops.length > 0 && builtRank.length > 0 && JSON.stringify(builtRank) !== JSON.stringify(rankIds)

  const placeAt = (id: string) => places.find((p) => p.id === id)
  const slotFor = (id: string) => PIN_SLOTS[Math.max(0, places.findIndex((p) => p.id === id)) % PIN_SLOTS.length]
  const legKm = (a: string, b: string) => {
    const pa = slotFor(a), pb = slotFor(b)
    return Math.hypot(parseFloat(pa.left) - parseFloat(pb.left), parseFloat(pa.top) - parseFloat(pb.top)) * KM_PER_PCT
  }
  // per-leg mode estimates + the fastest pick; the route total sums the fastest per leg
  const legs = stops.slice(0, -1).map((s, i) => {
    const est = estimateModes(legKm(s.placeId, stops[i + 1].placeId))
    return { est, fast: fastestMode(est)! }
  })
  const routeMinutes = legs.reduce((s, l) => s + l.fast.minutes, 0)
  const modesUsed = [...new Set(legs.map((l) => l.fast.mode))] as TravelMode[]
  const blurred = loc.mode !== 'vote' || places.length === 0
  const focusPlace = focusPin ? placeAt(focusPin) : (leadingId ? placeAt(leadingId) : null)

  // Flip animations: vote list re-ranks smoothly on each vote; itinerary rows slide on reorder
  const voteFlip = useFlipReorder(rankIds.join('|'))
  const itinFlip = useFlipReorder(stops.map((s) => s.uid).join('|'))

  function copyLink() {
    navigator.clipboard?.writeText(loc.meetingLink || '').then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800) }).catch(() => {})
  }

  return (
    <div className="flex flex-col items-stretch gap-3.5 lg:flex-row">
      {/* map */}
      <div className="relative flex min-w-0 flex-1">
        <div
          className="relative min-h-[320px] flex-1 overflow-hidden rounded-[13px] border border-border transition-[filter] duration-300 lg:min-h-[452px]"
          style={{
            filter: blurred ? 'blur(4px) saturate(.85)' : 'none',
            background: 'repeating-linear-gradient(0deg,transparent 0 43px,rgba(120,118,104,.13) 43px 45px),repeating-linear-gradient(90deg,transparent 0 52px,rgba(120,118,104,.13) 52px 54px),#E7E6DF',
          }}
        >
          {/* fake terrain: water, parks, roads */}
          <div className="absolute rounded-[50px]" style={{ left: '-8%', top: '-12%', width: '26%', height: '128%', background: '#AEC9E3', transform: 'rotate(9deg)' }} />
          <div className="absolute rounded-[40px]" style={{ left: '2%', top: '55%', width: '15%', height: '48%', background: '#AEC9E3', transform: 'rotate(-6deg)' }} />
          <div className="absolute rounded-xl" style={{ left: '39%', top: '17%', width: 92, height: 66, background: '#C2D9A7' }} />
          <div className="absolute rounded-xl" style={{ left: '58%', top: '62%', width: 80, height: 58, background: '#C2D9A7' }} />
          <div className="absolute rounded-md" style={{ left: '8%', top: '38%', width: '78%', height: 6, background: '#FAFAF6', transform: 'rotate(-14deg)' }} />
          <div className="absolute rounded-md" style={{ left: '30%', top: '-5%', width: 6, height: '110%', background: '#FAFAF6', transform: 'rotate(7deg)' }} />

          {/* itinerary route line */}
          {!blurred && sub === 'itin' && stops.length > 1 && (
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 z-[2] h-full w-full">
              <polyline
                points={stops.map((s) => { const sl = slotFor(s.placeId); return `${parseFloat(sl.left)},${parseFloat(sl.top)}` }).join(' ')}
                fill="none" stroke="#3E6B54" strokeWidth="0.9" strokeDasharray="2.2 1.7" strokeLinecap="round"
              />
            </svg>
          )}

          {/* pins */}
          {!blurred && sub === 'vote' && places.map((p) => {
            const n = votesOf(p.id).length
            const lead = p.id === leadingId
            return (
              <MapPinMarker key={p.id} left={slotFor(p.id).left} top={slotFor(p.id).top} color={lead ? '#2E4A3C' : '#5E7B69'} label={String(n)} onClick={() => setFocusPin(p.id)} />
            )
          })}
          {!blurred && sub === 'itin' && stops.map((s, i) => (
            <MapPinMarker key={s.uid} left={slotFor(s.placeId).left} top={slotFor(s.placeId).top} color="#2E4A3C" label={String(i + 1)} onClick={() => setFocusPin(s.placeId)} />
          ))}

          {/* popup for the focused (or leading) place */}
          {!blurred && sub === 'vote' && focusPlace && (
            <div className="absolute z-[5] min-w-[158px] rounded-[11px] bg-white px-3 py-2.5" style={{ left: slotFor(focusPlace.id).left, top: slotFor(focusPlace.id).top, transform: 'translate(-50%, calc(-100% - 32px))', boxShadow: '0 10px 28px rgba(0,0,0,.28)' }}>
              <div className="text-[12px] font-semibold text-[#1b1b19]">{focusPlace.name}</div>
              <div className="mb-1.5 mt-0.5 text-[10.5px] text-[#6b7280]">{focusPlace.place}</div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10.5px] font-bold text-teal-text">{votesOf(focusPlace.id).length} vote{votesOf(focusPlace.id).length === 1 ? '' : 's'}</span>
                <div className="flex">
                  {votesOf(focusPlace.id).slice(0, 5).map((id) => { const a = avatarOf(id); return <span key={id} className="-mr-[5px]"><Avatar initials={a.initials} color={a.color} size={17} font={7.5} title={a.name} /></span> })}
                </div>
              </div>
              <div className="absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 bg-white" />
            </div>
          )}

          {/* zoom control (decorative) */}
          <div className="absolute bottom-2.5 right-2.5 z-[6] flex flex-col overflow-hidden rounded-lg border border-[rgba(0,0,0,.12)]">
            <span className="grid h-[30px] w-[30px] place-items-center border-b border-[rgba(0,0,0,.1)] bg-white text-[16px] text-[#1b1b19]">+</span>
            <span className="grid h-[30px] w-[30px] place-items-center bg-white text-[16px] text-[#1b1b19]">−</span>
          </div>
        </div>

        {/* overlay when the map is blurred */}
        {blurred && (
          <div className="absolute inset-0 z-[8] flex items-center justify-center p-5" style={{ background: 'color-mix(in srgb, var(--bg) 38%, transparent)' }}>
            <div className="w-full max-w-[330px] rounded-2xl border border-border2 bg-s1 px-5 py-6 text-center shadow-soft">
              {loc.mode === 'remote' ? (
                <>
                  <span className="mx-auto mb-3 grid h-[46px] w-[46px] place-items-center rounded-xl border border-accent-border bg-accent-bg text-accent-text"><Video size={22} /></span>
                  <div className="text-[14px] font-semibold">This event is remote</div>
                  <p className="mb-3.5 mt-1 text-[11.5px] leading-[1.55] text-dim">Everyone joins online, so there is no map. The link lives here and in every reminder.</p>
                  <div className="mb-2.5 flex h-[38px] items-center gap-2 rounded-[10px] border border-border bg-s2 py-0 pl-3 pr-2">
                    <Link2 size={14} className="flex-none text-accent-text" />
                    <span className="flex-1 truncate text-left font-mono text-[11.5px]">{loc.meetingLink || `${loc.platform} link coming soon`}</span>
                    {loc.meetingLink && (
                      <button onClick={copyLink} className="flex h-7 flex-none items-center gap-1 rounded-[7px] bg-accent px-2.5 text-[11px] font-semibold text-on-accent">
                        {copied ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
                      </button>
                    )}
                  </div>
                  <div className="text-[11px] text-dim">{event.participants.filter((p) => p.rsvp !== 'not_going').length} joining on {loc.platform}</div>
                </>
              ) : (
                <>
                  <span className="mx-auto mb-3 grid h-[46px] w-[46px] place-items-center rounded-xl border border-ochre-border bg-ochre-bg text-ochre-text"><MapPinOff size={22} /></span>
                  <div className="text-[14px] font-semibold">No location yet</div>
                  <p className="mt-1 text-[11.5px] leading-[1.55] text-dim">
                    {loc.mode === 'later'
                      ? 'The host is deciding where later. Availability and chat keep working in the meantime, and the map fills in once places are added.'
                      : canAddPlaces
                        ? 'Nothing on the ballot yet. Add the first place in the panel and the map fills in as votes come in.'
                        : 'No candidate places yet. The host can add some, or allow guests to suggest them.'}
                  </p>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* side panel — only for in-person events */}
      {loc.mode === 'vote' && (
        <div className="flex w-full flex-none flex-col lg:w-[330px]">
          <div className="mb-3 flex items-center gap-2">
            <SegmentedControl
              size="sm"
              stretch
              className="flex-1"
              value={sub}
              onChange={(v) => { setSub(v as 'vote' | 'itin'); setFocusPin(null) }}
              options={[{ v: 'vote', l: 'Venue vote' }, { v: 'itin', l: 'Itinerary' }]}
            />
            {sub === 'itin' && (
              <button onClick={() => setAdding((a) => !a)} className={`flex h-8 flex-none items-center gap-1 rounded-[9px] border px-2.5 text-[11.5px] font-semibold ${adding ? 'border-accent bg-accent-bg text-accent-text' : 'border-border2 bg-s1 hover:bg-s2'}`}>
                <Plus size={14} /> Add stop
              </button>
            )}
          </div>

          {sub === 'vote' && (
            <div ref={voteFlip.scope} className="flex flex-col gap-2">
              {canAddPlaces && <AddPlaceSearch onAdd={addPlace} taken={new Set(places.map((p) => p.id))} />}
              {places.length === 0 ? (
                <EmptyNote icon={Vote} text={canAddPlaces ? 'No places on the ballot yet. Search above to add the first one.' : 'No places to vote on yet. The host can add some, or allow guests to.'} />
              ) : null}
                {ranked.map((p, i) => {
                  const ids = votesOf(p.id)
                  const you = ids.includes(YOU)
                  const lead = p.id === leadingId
                  return (
                    <div key={p.id} data-flip-id={p.id} className={`relative flex items-start gap-2.5 rounded-xl border p-2.5 ${lead ? 'border-accent-border bg-accent-bg/40' : 'border-border bg-s0'}`}>
                      <span className={`grid h-[30px] w-[30px] flex-none place-items-center rounded-full text-[12px] font-bold ${lead ? 'bg-accent text-on-accent' : 'bg-s2 text-dim'}`}>{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <div className="mb-0.5 flex items-center gap-1.5">
                          <span className="text-[12.5px] font-semibold">{p.name}</span>
                          {lead && <span className="flex-none rounded-[5px] border border-accent-border bg-accent-bg px-[5px] py-px text-[9px] font-semibold text-accent-text">Leading</span>}
                        </div>
                        {/* address wraps in full — no truncation */}
                        <div className="mb-1.5 text-[10.5px] leading-[1.45] text-dim">{p.place} · {ids.length} vote{ids.length === 1 ? '' : 's'}</div>
                        <div className="flex">
                          {ids.slice(0, 6).map((id) => { const a = avatarOf(id); return <span key={id} className="-mr-[5px]"><Avatar initials={a.initials} color={a.color} size={18} font={7.5} title={a.name} /></span> })}
                        </div>
                      </div>
                      <div className="flex flex-none items-center gap-1">
                        <button
                          onClick={() => toggleVote(p.id)}
                          aria-pressed={you}
                          title={you ? 'Remove your vote' : 'Vote for this place'}
                          className={`grid h-[34px] w-[34px] place-items-center rounded-[9px] border ${you ? 'border-accent bg-accent text-on-accent' : 'border-border2 bg-s1 text-text hover:bg-s2'}`}
                        >
                          <ArrowUp size={16} />
                        </button>
                        {event.hostedByYou && (
                          <button onClick={() => attemptRemovePlace(p.id)} title="Remove this place" aria-label={`Remove ${p.name}`} className="grid h-[34px] w-7 place-items-center rounded-[9px] text-faint hover:text-brick-text">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                      {confirmRemove === p.id && (
                        <div className="absolute inset-0 z-10 flex items-center gap-2 rounded-xl border border-brick-border bg-brick-bg px-2.5">
                          <TriangleAlert size={15} className="flex-none text-brick-text" />
                          <span className="min-w-0 flex-1 text-[11px] leading-[1.4] text-brick-text">Remove {p.name}? Its {ids.length} vote{ids.length === 1 ? '' : 's'} will be lost.</span>
                          <button onClick={() => setConfirmRemove(null)} className="flex h-7 flex-none items-center rounded-[7px] border border-brick-border bg-s1 px-2.5 text-[11px] font-semibold text-brick-text">Cancel</button>
                          <button onClick={() => removePlace(p.id)} className="flex h-7 flex-none items-center gap-1 rounded-[7px] px-2.5 text-[11px] font-semibold text-white" style={{ background: 'var(--brick)' }}><Trash2 size={12} /> Remove</button>
                        </div>
                      )}
                    </div>
                  )
                })}
              {event.hostedByYou && (
                <label className="mt-1 flex cursor-pointer items-center gap-2 px-0.5 text-[11px] text-dim">
                  <input type="checkbox" checked={guestsCanSuggest} onChange={toggleGuestsCanSuggest} className="h-3.5 w-3.5" style={{ accentColor: 'var(--accent)' }} />
                  Guests can add places to the ballot
                </label>
              )}
            </div>
          )}

          {sub === 'itin' && (
            <div ref={itinFlip.scope} className="flex flex-col gap-2">
              {rankChanged && (
                <div className="rounded-[10px] border border-ochre-border bg-ochre-bg p-3">
                  <div className="flex items-start gap-2">
                    <RefreshCw size={13} className="mt-0.5 flex-none text-ochre-text" />
                    <p className="text-[11.5px] leading-[1.5] text-ochre-text">Votes have changed since this itinerary was built, and the ranking is different now.</p>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button onClick={buildFromVotes} className="flex h-7 items-center rounded-[7px] px-2.5 text-[11px] font-semibold text-white" style={{ background: 'var(--ochre)' }}>Rebuild from votes</button>
                    <button onClick={keepCurrentItin} className="flex h-7 items-center rounded-[7px] border border-ochre-border bg-s1 px-2.5 text-[11px] font-semibold text-ochre-text">Keep as is</button>
                  </div>
                </div>
              )}
              {adding && (
                <div className="rounded-xl border border-border bg-s0 p-2.5">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-[10.5px] font-semibold uppercase tracking-[.1em] text-faint">Add a stop</span>
                    <button onClick={() => setAdding(false)} className="text-faint hover:text-text" aria-label="Done adding"><X size={13} /></button>
                  </div>
                  {places.length > 0 && (
                    <div className="mb-2 flex flex-col gap-1">
                      {places.map((p) => {
                        const count = stops.filter((s) => s.placeId === p.id).length
                        return (
                          <button key={p.id} onClick={() => addStop(p.id)} className="flex items-start gap-2 rounded-[9px] border border-border bg-s1 px-2.5 py-1.5 text-left hover:border-border2">
                            <MapPin size={13} className="mt-0.5 flex-none text-dim" />
                            <span className="min-w-0 flex-1 text-[12px] font-medium leading-[1.4]">{p.name} <span className="font-normal text-faint">· {p.place}</span></span>
                            <span className="mt-0.5 flex flex-none items-center gap-1 text-[11px] font-semibold text-accent-text"><Plus size={13} /> {count > 0 ? `Again${count > 1 ? ` · ${count}` : ''}` : 'Add'}</span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                  {canAddPlaces
                    ? <AddPlaceSearch onAdd={addNewPlaceAsStop} taken={new Set(places.map((p) => p.id))} placeholder="Search a new place to add…" />
                    : places.length === 0 && <EmptyNote icon={MapPin} text="No places to add yet. The host can add candidate places." />}
                </div>
              )}
              {stops.length === 0 ? (
                <div className="rounded-xl border border-border bg-s0 p-4 text-center">
                  <span className="mx-auto mb-2.5 grid h-[38px] w-[38px] place-items-center rounded-[10px] border border-teal-border bg-teal-bg text-teal-text"><Route size={17} /></span>
                  <div className="text-[12.5px] font-semibold">No itinerary yet</div>
                  <p className="mx-auto mt-1 max-w-[250px] text-[11.5px] leading-[1.5] text-dim">Build one automatically from the top-voted places, or add the stops yourself in whatever order you like. Reorder or remove any time.</p>
                  <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                    <button
                      onClick={buildFromVotes}
                      disabled={places.length === 0}
                      className="inline-flex h-9 items-center gap-1.5 rounded-[9px] bg-accent px-3.5 text-[12px] font-semibold text-on-accent disabled:opacity-40"
                    >
                      <Route size={13} /> Build from top votes
                    </button>
                    <button
                      onClick={() => setAdding(true)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-[9px] border border-border2 bg-s1 px-3.5 text-[12px] font-semibold hover:bg-s2"
                    >
                      <Plus size={13} /> Add stops yourself
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {stops.map((s, i) => {
                    const p = placeAt(s.placeId)
                    if (!p) return null
                    const leg = i < legs.length ? legs[i] : null
                    return (
                      <Fragment key={s.uid}>
                        <div
                          data-flip-id={s.uid}
                          draggable
                          onDragStart={() => setDragIndex(i)}
                          onDragEnter={() => onStopDragEnter(i)}
                          onDragOver={(e) => e.preventDefault()}
                          onDragEnd={() => setDragIndex(null)}
                          className={`flex items-start gap-2 rounded-xl border bg-s0 p-2.5 ${dragIndex === i ? 'border-accent-border opacity-50' : 'border-border'}`}
                        >
                          <GripVertical size={15} className="mt-0.5 flex-none cursor-grab text-faint active:cursor-grabbing" />
                          <span className="mt-px grid h-6 w-6 flex-none place-items-center rounded-full bg-accent text-[11px] font-bold text-on-accent">{i + 1}</span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-[12.5px] font-semibold">{p.name}</span>
                              {stops.filter((x) => x.placeId === s.placeId).length > 1 && <span className="flex-none rounded-[5px] border border-border2 bg-s2 px-[5px] py-px text-[8.5px] font-semibold text-dim">revisit</span>}
                            </div>
                            {/* address wraps in full */}
                            <div className="text-[10.5px] leading-[1.45] text-dim">{p.place} · {votesOf(s.placeId).length} vote{votesOf(s.placeId).length === 1 ? '' : 's'}</div>
                          </div>
                          <div className="flex flex-none items-center">
                            <button onClick={() => moveStop(i, -1)} disabled={i === 0} className="grid h-6 w-6 place-items-center rounded-[6px] text-dim enabled:hover:text-text disabled:opacity-30" aria-label="Move up"><ChevronUp size={15} /></button>
                            <button onClick={() => moveStop(i, 1)} disabled={i === stops.length - 1} className="grid h-6 w-6 place-items-center rounded-[6px] text-dim enabled:hover:text-text disabled:opacity-30" aria-label="Move down"><ChevronDown size={15} /></button>
                            <button onClick={() => removeStop(i)} className="grid h-6 w-6 place-items-center rounded-[6px] text-faint hover:text-brick-text" aria-label="Remove stop"><X size={14} /></button>
                          </div>
                        </div>
                        {leg && <TravelLeg est={leg.est} fastest={leg.fast} />}
                      </Fragment>
                    )
                  })}
                  {legs.length > 0 && (
                    <div className="mt-1 rounded-xl border border-teal-border bg-teal-bg/50 p-3">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] font-semibold text-teal-text">
                        <span className="flex items-center gap-1.5"><Route size={14} /> Fastest route · {fmtDuration(routeMinutes)} total travel</span>
                        <span className="flex items-center gap-1 text-[10.5px] font-medium text-faint"><GripVertical size={11} /> Drag stops to reorder</span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1">
                        {modesUsed.map((m) => { const Icon = MODE_ICON[m]; return (
                          <span key={m} className="flex items-center gap-1 rounded-full border border-teal-border bg-s1 px-2 py-0.5 text-[10.5px] font-medium text-teal-text"><Icon size={11} /> {MODE_LABEL[m]}</span>
                        ) })}
                        <span className="text-[10.5px] text-dim">· quickest mode picked per leg</span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// travel connector between two stops — every feasible mode with its time, fastest highlighted
function TravelLeg({ est, fastest }: { est: ModeEstimate[]; fastest: ModeEstimate }) {
  return (
    <div className="flex items-stretch gap-2 pl-3">
      <div className="flex w-6 flex-none justify-center">
        <span className="my-0.5 w-px" style={{ background: 'repeating-linear-gradient(var(--border2) 0 3px, transparent 3px 6px)' }} />
      </div>
      <div className="flex flex-wrap items-center gap-1 py-1.5">
        {est.map((e) => {
          const Icon = MODE_ICON[e.mode]
          const best = e.mode === fastest.mode
          return (
            <span
              key={e.mode}
              title={`${MODE_LABEL[e.mode]} · ${fmtDuration(e.minutes)}${best ? ' · fastest' : ''}`}
              className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] ${best ? 'border-accent bg-accent text-on-accent font-semibold' : 'border-border bg-s1 text-dim'}`}
            >
              <Icon size={11} /> {fmtDuration(e.minutes)}
            </span>
          )
        })}
      </div>
    </div>
  )
}

function MapPinMarker({ left, top, color, label, onClick }: { left: string; top: string; color: string; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="absolute z-[3]" style={{ left, top, transform: 'translate(-50%, -100%)' }} aria-label={`Map pin ${label}`}>
      <span
        className="flex h-[27px] w-[27px] items-center justify-center border-2 border-white"
        style={{ borderRadius: '50% 50% 50% 0', transform: 'rotate(-45deg)', background: color, boxShadow: '0 3px 9px rgba(0,0,0,.38)' }}
      >
        <span className="text-[11px] font-bold text-white" style={{ transform: 'rotate(45deg)' }}>{label}</span>
      </span>
    </button>
  )
}

/* search-to-add for the ballot (host, or guests once allowed) — same Nominatim flow as the wizard */
function AddPlaceSearch({ onAdd, taken, placeholder = 'Add a place to the ballot…' }: { onAdd: (p: EventPlace) => void; taken: Set<string>; placeholder?: string }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<EventPlace[]>([])
  const [searching, setSearching] = useState(false)
  const term = query.trim()

  useEffect(() => {
    if (term.length < 3) { setResults([]); setSearching(false); return }
    setSearching(true)
    const ctrl = new AbortController()
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=${encodeURIComponent(term)}`, { signal: ctrl.signal, headers: { Accept: 'application/json' } })
        const data: { place_id: number; name?: string; display_name: string }[] = await res.json()
        setResults(data.map((d) => {
          const parts = d.display_name.split(', ')
          return { id: String(d.place_id), name: d.name && d.name.trim() ? d.name : parts[0], place: (d.name ? parts : parts.slice(1)).slice(0, 3).join(', ') }
        }))
      } catch (err) {
        if ((err as Error).name !== 'AbortError') setResults([])
      } finally { setSearching(false) }
    }, 350)
    return () => { ctrl.abort(); clearTimeout(t) }
  }, [term])

  const shown = results.filter((r) => !taken.has(r.id))
  function pick(p: EventPlace) { onAdd(p); setQuery('') }

  return (
    <div className="relative">
      <div className="flex h-9 items-center gap-2 rounded-[10px] border border-border bg-s2 px-3 focus-within:border-accent-border">
        <Search size={13} className="flex-none text-faint" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={placeholder} className="min-w-0 flex-1 bg-transparent text-[12px] outline-none placeholder:text-faint" />
      </div>
      {term && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-[240px] overflow-auto rounded-[10px] border border-border bg-s1 p-1 shadow-soft">
          {term.length < 3 ? (
            <div className="px-2.5 py-2 text-[11px] text-faint">Keep typing to search for a place…</div>
          ) : (
            <>
              {searching && <div className="flex items-center gap-2 px-2.5 py-2 text-[11px] text-faint"><Loader2 size={12} className="animate-spin" /> Searching…</div>}
              {!searching && shown.map((r) => (
                <button key={r.id} type="button" onClick={() => pick(r)} className="flex w-full items-center gap-2 rounded-[7px] px-2.5 py-2 text-left hover:bg-s2">
                  <MapPin size={13} className="flex-none text-dim" />
                  <span className="min-w-0 flex-1 truncate text-[12px] font-medium">{r.name} <span className="font-normal text-faint">· {r.place}</span></span>
                  <Plus size={13} className="flex-none text-accent-text" />
                </button>
              ))}
              {!searching && shown.length === 0 && <div className="px-2.5 py-1.5 text-[11px] text-faint">No new matches. It may already be on the ballot.</div>}
              {!searching && (
                <button type="button" onClick={() => pick({ id: `custom:${term.toLowerCase()}`, name: term, place: 'Custom place' })} className="mt-0.5 flex w-full items-center gap-2 rounded-[7px] border-t border-border px-2.5 py-2 text-left hover:bg-s2">
                  <Plus size={13} className="flex-none text-accent-text" />
                  <span className="min-w-0 truncate text-[12px]">Add “<span className="font-semibold">{term}</span>” as a custom place</span>
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function EmptyNote({ icon: Icon, text }: { icon: typeof Vote; text: string }) {
  return (
    <div className="flex items-start gap-2 rounded-[10px] border border-border bg-s2 px-3 py-2.5">
      <Icon size={14} className="mt-0.5 flex-none text-accent-text" />
      <span className="text-[11.5px] leading-[1.5] text-dim">{text}</span>
    </div>
  )
}
