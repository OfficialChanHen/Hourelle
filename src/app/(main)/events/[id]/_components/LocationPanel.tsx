'use client'


/* ── the Location tab: where the plan happens ──
   One tab, four answers to the same question, chosen by `location.mode`:
     vote    a live ballot on places people suggest
     set     a venue the host stated as fact, no voting
     remote  an online call, a platform and a link
     later   nothing decided yet (opens as In person so the host can start)
   Each mode keeps its own data, so switching away and back never destroys the
   other one's work.

   In-person events also choose a PLAN MODE: a single venue chosen by ballot, or an
   itinerary, which is an ordered list of stops with dwell times. Timing for the
   itinerary is not computed here — `lib/itinerary` owns it, and the Attendance tab
   runs the same function, which is what keeps the two tabs' clocks identical.
   Real road distance and driving minutes come from OSRM through `useRoute`; when
   the router is unavailable the straight-line model fills in.

   Editing rights are narrow and explicit: the host may always edit, guests may add
   places only when the host has opened suggestions, and everything freezes once the
   plan is locked in or the voting deadline passes. Like the other panels, edits go
   to local state first (so the demos work in memory) and are persisted for real
   events through `persist`. */

import { Fragment, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { gsap } from 'gsap'
import { MapPin, MapPinOff, Video, Link2, ArrowUp, Route, X, ChevronUp, ChevronDown, Vote, Check, Copy, RefreshCw, Search, Plus, Loader2, Footprints, Car, Bus, TrainFront, Plane, GripVertical, Trash2, TriangleAlert, Clock, Minus, SlidersHorizontal, Info, ExternalLink } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { namesLabel } from '@/components/ui/AvatarRow'
import { fromDay, todayKey, getEvent, patchEvent, fmtMinute, fmtMinuteDay, bestWindow, availIvOf, gridStartMinOf, daysUntil, dayLabel, type AppEvent, type ConfirmedSlot, type EventPlace, type Participant } from '@/lib/events'
import { hintDismissed as isHintDismissed, dismissHint as markHintDismissed } from '@/lib/prefs'
import { fmtDuration, MODE_LABEL, ALL_MODES, type TravelMode, type ModeEstimate } from '@/lib/travel'
import { computeItinerary, legKm } from '@/lib/itinerary'
import { centroidOf, coordsOf, searchPlaces, type LatLng } from '@/lib/geo'
import { useRoute } from '@/hooks/useRoute'
import { useFollow } from '@/hooks/useFollow'
import type { MapPin as MapPinData, PanRequest } from '@/components/EventMap'
import { useFlipReorder } from '@/hooks/useFlipReorder'
import { usePointerReorder } from '@/hooks/usePointerReorder'
import { usePhoneScreen } from '@/hooks/usePhoneScreen'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { OverflowText } from '@/components/ui/OverflowText'
import { TimeSelect } from '@/components/ui/TimeSelect'
import { Popover } from '@/components/ui/Popover'
import { DateField } from '@/components/ui/DateField'

// Leaflet reads `window` when it loads, so the map only ever renders in the browser
const EventMap = dynamic(() => import('@/components/EventMap').then((m) => m.EventMap), { ssr: false, loading: () => <div className="absolute inset-0 animate-pulse bg-s2" /> })

const MODE_ICON: Record<TravelMode, typeof Car> = { walk: Footprints, bus: Bus, drive: Car, train: TrainFront, flight: Plane }

// a stop references a place but has its own id (so a venue can repeat) and a dwell time
type ItinStop = { uid: string; placeId: string; dwell: number }

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
function deadlineText(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return `${DOW[dt.getDay()]}, ${dayLabel(dt)}`
}
// check a place out before voting — Nominatim results resolve fine by name search
function osmUrl(p: EventPlace): string {
  const q = p.place && p.place !== 'Custom place' ? `${p.name}, ${p.place}` : p.name
  return `https://www.openstreetmap.org/search?query=${encodeURIComponent(q)}`
}

export function LocationPanel({ event, locked = false, confirmed, onPatch }: { event: AppEvent; locked?: boolean; confirmed?: ConfirmedSlot; onPatch?: (patch: Partial<AppEvent>) => void }) {
  // who votes and suggests: the `you` participant — the guest when this browser
  // joined via the share link, the stubbed account otherwise
  // empty when nobody here is you (signed in, not on this event's list) — voting and
  // suggesting then do nothing rather than acting as somebody else. The availability
  // tab is where the "Add me" way out lives.
  const YOU = event.participants.find((p) => p.you)?.id ?? ''
  const loc = event.location
  // once the host locks in, voting and editing close; the chosen place(s) get the highlight
  const confirmedIds = new Set(confirmed?.placeIds ?? [])
  // the itinerary lives inside the event: it can't start before people are actually free,
  // and it shouldn't run longer than the time the owner set aside for the event.
  const eventDuration = event.durationMin ?? 60
  const gridStart = gridStartMinOf(event)
  const bw = bestWindow(availIvOf(event), event.days, eventDuration, event.bestMode)
  const winStart = bw ? gridStart + bw.s : null           // best free window, clock minutes
  const winEnd = bw ? gridStart + bw.e : null
  // start is bounded to the free window, leaving room for at least the planned duration
  const minStart = winStart ?? 6 * 60
  const maxStart = winEnd != null ? Math.max(minStart, winEnd - eventDuration) : 22 * 60
  // places are editable on this tab (host, or guests once the host allows it)
  const [places, setPlaces] = useState<EventPlace[]>(loc.places)
  const [guestsCanSuggest, setGuestsCanSuggest] = useState(!!loc.guestsCanSuggest)
  // venue type is switchable on this tab (In person / Remote); each mode's data (votes,
  // itinerary, remote link) lives in its own field and is kept when you switch away and back.
  // A "decide later" event opens as In person here so the host can start adding places.
  const [mode, setMode] = useState<AppEvent['location']['mode']>(loc.mode === 'later' ? 'vote' : loc.mode)
  // which in-person flavor this event uses ('vote' ballot vs 'set' fact), so toggling
  // to Remote and back never demotes a set venue into a ballot
  const inPerson = useRef<'vote' | 'set'>(loc.mode === 'set' ? 'set' : 'vote')
  const [meetingLink, setMeetingLink] = useState(loc.meetingLink)
  // optional voting deadline — voting (and ballot changes) freeze once it passes
  const [voteDeadline, setVoteDeadline] = useState(event.voteDeadline ?? '')
  const deadlineDu = voteDeadline ? daysUntil(voteDeadline) : null
  const votingClosed = deadlineDu !== null && deadlineDu < 0
  // a set venue is a fact the host stated — no voting, no guest suggestions
  const settled = mode === 'set'
  const canAddPlaces = !locked && !votingClosed && !!YOU && (event.hostedByYou || (guestsCanSuggest && !settled))
  // the itinerary is the host's to build: its stops, their order, how long each one
  // takes and when the day starts. Everyone else reads it.
  const canEditItin = event.hostedByYou && !locked
  const pById = new Map(event.participants.map((p) => [p.id, p]))
  const avatarOf = (id: string) => {
    const p = pById.get(id)
    return { initials: p?.initials ?? id, name: p?.name ?? id, color: p?.color ?? ('gray' as Participant['color']), you: !!p?.you }
  }

  const [votes, setVotes] = useState<Record<string, string[]>>(() => event.votes ?? {})
  const [maxVotes, setMaxVotes] = useState(event.maxVotes ?? 1)
  const [hideVoters, setHideVoters] = useState(!!event.hideVoters)
  // the tab's one-line how-it-works, shown until dismissed (this page never SSRs — the
  // event itself loads from localStorage first, so reading it in the initializer is safe)
  const [hintDismissed, setHintDismissed] = useState(() => isHintDismissed('location'))
  // custom mode: host sets an arbitrary votes-per-person beyond the 1/2/3 presets
  const [customVotes, setCustomVotes] = useState(() => (event.maxVotes ?? 1) > 3)
  const stopUid = useRef(0)
  const [stops, setStops] = useState<ItinStop[]>(() => {
    const ids = (event.itinStops ?? []).filter((id) => loc.places.some((p) => p.id === id))
    const dwell = event.itinDwell ?? []
    return ids.map((placeId, i) => ({ uid: `s${stopUid.current++}`, placeId, dwell: dwell[i] ?? 60 }))
  })
  const [itinStartMin, setItinStartMin] = useState(event.itinStartMin ?? minStart)
  const [travelModes, setTravelModes] = useState<TravelMode[]>(() => (event.travelModes as TravelMode[] | undefined)?.filter((m) => ALL_MODES.includes(m)) ?? [...ALL_MODES])
  const [builtRank, setBuiltRank] = useState<string[]>(() => event.itinRank ?? [])
  const [sub, setSub] = useState<'vote' | 'itin'>(loc.planMode === 'itinerary' ? 'itin' : 'vote')
  const [focusPin, setFocusPin] = useState<string | null>(null)
  // a tap on a place in the list: focus its pin and bring the map to it
  const [panReq, setPanReq] = useState<PanRequest | null>(null)
  const goToPin = (id: string) => { setFocusPin(id); setPanReq((r) => ({ id, n: (r?.n ?? 0) + 1 })) }
  const [copied, setCopied] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null) // placeId pending delete confirm
  const [confirmClear, setConfirmClear] = useState<'places' | 'stops' | null>(null) // clear-all pending confirm

  // the event changes under this tab too — someone else's vote, a place a guest
  // suggested, an itinerary rebuilt on the host's other device — and every field
  // follows it live. A panel's own edit comes back as the value it just set: a no-op.
  useFollow(loc.places, setPlaces)
  useFollow(!!loc.guestsCanSuggest, setGuestsCanSuggest)
  useFollow(loc.meetingLink, setMeetingLink)
  useFollow(loc.mode === 'later' ? 'vote' : loc.mode, (m) => { setMode(m); if (m === 'set' || m === 'vote') inPerson.current = m })
  useFollow<'vote' | 'itin'>(loc.planMode === 'itinerary' ? 'itin' : 'vote', (v) => { setSub(v); setFocusPin(null) })
  useFollow(event.votes ?? {}, setVotes)
  useFollow(event.maxVotes ?? 1, (n) => { setMaxVotes(n); setCustomVotes((c) => c || n > 3) })
  useFollow(!!event.hideVoters, setHideVoters)
  useFollow(event.voteDeadline ?? '', setVoteDeadline)
  useFollow(event.itinStartMin ?? minStart, setItinStartMin)
  useFollow(event.travelModes ?? null, (tm) => setTravelModes((tm as TravelMode[] | null)?.filter((m) => ALL_MODES.includes(m)) ?? [...ALL_MODES]))
  useFollow(event.itinRank ?? [], setBuiltRank)
  // stops keep their uids where the place order still matches, so the list does not
  // re-animate for a change that only echoed back
  useFollow({ ids: event.itinStops ?? [], dwell: event.itinDwell ?? [] }, ({ ids, dwell }) => setStops((cur) => {
    const real = ids.filter((id) => loc.places.some((p) => p.id === id))
    if (real.length === cur.length && real.every((id, i) => id === cur[i].placeId && (dwell[i] ?? 60) === cur[i].dwell)) return cur
    const used = new Set<string>()
    return real.map((placeId, i) => {
      const keep = cur.find((s) => s.placeId === placeId && !used.has(s.uid))
      if (keep) used.add(keep.uid)
      return { uid: keep?.uid ?? `s${stopUid.current++}`, placeId, dwell: dwell[i] ?? 60 }
    })
  }))
  const [sheetOpen, setSheetOpen] = useState(false) // mobile: venues/itinerary bottom sheet

  // route through the parent when it listens, so the always-mounted surfaces (the
  // Lock-it-in popover, the hero summary) see mode/place/vote changes without a reload
  // the ballot as this device holds it right now, which can be newer than the one this
  // screen last drew (see patchEventWith)
  const latestVotes = () => (event.demo ? votes : getEvent(event.id)?.votes ?? votes)
  function persist(patch: Partial<AppEvent>) {
    if (onPatch) onPatch(patch)
    else if (!event.demo) patchEvent(event.id, patch)
  }
  // one place to persist the location object, so switching mode never clobbers the other
  // fields — pass the changed field in `over`; unchanged fields come from current state
  function persistLoc(over: Partial<AppEvent['location']> = {}) {
    persist({ location: { ...loc, mode, places, guestsCanSuggest, meetingLink, ...over } })
  }
  function changeMode(m: AppEvent['location']['mode']) { setMode(m); persistLoc({ mode: m }) }
  function changeLink(v: string) { setMeetingLink(v); persistLoc({ meetingLink: v }) }
  function addPlace(p: EventPlace) {
    if (!YOU || places.some((x) => x.id === p.id)) return
    // a set venue is singular — picking another swaps it out (same as the wizard);
    // on a ballot, new places join the list. addedBy remembers who suggested it.
    const entry = { ...p, addedBy: p.addedBy ?? YOU }
    const next = settled ? [entry] : [...places, entry]
    setPlaces(next)
    persistLoc({ places: next })
  }
  function changeDeadline(raw: string) {
    const v = fromDay(raw, todayKey()) // a closing day already gone would freeze the vote at once
    setVoteDeadline(v)
    persist({ voteDeadline: v || undefined })
  }
  function dismissHint() {
    setHintDismissed(true)
    markHintDismissed('location')
  }
  function toggleGuestsCanSuggest() {
    const next = !guestsCanSuggest
    setGuestsCanSuggest(next)
    persistLoc({ guestsCanSuggest: next })
  }
  function toggleHideVoters() {
    const next = !hideVoters
    setHideVoters(next)
    persist({ hideVoters: next })
  }

  // on a phone the places panel is the whole screen while it is open, the same as the
  // discussion: pinned to the visible part of the screen, so the keyboard the place
  // search raises cannot lift it off the page. It slides up in and down out.
  const sheetRef = useRef<HTMLDivElement>(null)
  usePhoneScreen(sheetRef, { active: sheetOpen })
  useEffect(() => {
    const el = sheetRef.current
    if (!sheetOpen || !el || window.matchMedia('(min-width: 1024px)').matches) return
    const tw = gsap.fromTo(el, { y: '100%' }, { y: 0, duration: 0.36, ease: 'power3.out' })
    return () => { tw.kill(); gsap.set(el, { clearProps: 'transform' }) }
  }, [sheetOpen])
  const closing = useRef(false)
  // where Cancel on a remove-all or clear-all confirm hands focus back
  const clearPlacesBtn = useRef<HTMLButtonElement>(null)
  const refocusClearStops = useRef(false)
  function closeSheet() {
    const el = sheetRef.current
    if (!el || closing.current) return
    closing.current = true
    gsap.to(el, { y: '100%', duration: 0.26, ease: 'power2.in', onComplete: () => { closing.current = false; setSheetOpen(false) } })
  }
  // while it is the whole phone screen it is a modal: the keyboard stays in it, Escape
  // puts it away, and focus goes back to the bar that raised it. On a desktop it is a
  // plain column and none of that applies.
  useFocusTrap(sheetRef, { active: sheetOpen, media: '(max-width: 1023px)' })
  useEffect(() => {
    if (!sheetOpen) return
    const onKey = (e: KeyboardEvent) => {
      // a popover open inside the sheet takes the first Escape for itself
      if (e.key !== 'Escape' || e.defaultPrevented || window.matchMedia('(min-width: 1024px)').matches) return
      closeSheet()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sheetOpen])

  const votesOf = (id: string) => votes[id] ?? []
  const ranked = [...places].sort((a, b) => votesOf(b.id).length - votesOf(a.id).length)
  const rankIds = ranked.map((p) => p.id)
  const leadingId = ranked.length && votesOf(ranked[0].id).length > 0 ? ranked[0].id : null
  const myVoteCount = places.filter((p) => votesOf(p.id).includes(YOU)).length
  const votesLeft = Math.max(0, maxVotes - myVoteCount)

  // vote budget: everyone gets `maxVotes`. With 1, voting moves your single pick (radio);
  // with more, extra votes are blocked once you're out.
  function toggleVote(placeId: string) {
    if (votingClosed || !YOU) return
    const has = votesOf(placeId).includes(YOU)
    if (!has && maxVotes > 1 && votesLeft === 0) return // out of votes
    voteFlip.capture()
    // build the next ballot first, then set and persist — persisting inside a state
    // updater would run during render and update the parent mid-render. Only your own
    // vote moves, laid over the ballot as saved now: everyone else's votes come from
    // there, not from this screen, which may not have caught up with a vote cast a
    // moment ago and would otherwise write it back out.
    const base = latestVotes()
    const next: Record<string, string[]> = { ...base }
    const without = (id: string) => (base[id] ?? []).filter((x) => x !== YOU)
    if (has) {
      next[placeId] = without(placeId)
    } else if (maxVotes === 1) {
      for (const id of Object.keys(base)) if (base[id].includes(YOU)) next[id] = without(id)
      next[placeId] = [...without(placeId), YOU]
    } else {
      next[placeId] = [...without(placeId), YOU]
    }
    setVotes(next)
    persist({ votes: next })
  }
  // can't hand out more votes than there are places to vote on
  const voteCap = Math.max(1, places.length)
  function changeMaxVotes(n: number) { const v = Math.min(voteCap, Math.max(1, n)); setMaxVotes(v); persist({ maxVotes: v }) }
  function toggleMode(m: TravelMode) {
    const next = travelModes.includes(m) ? travelModes.filter((x) => x !== m) : [...travelModes, m]
    if (!next.length) return // keep at least one mode enabled
    setTravelModes(next); persist({ travelModes: next })
  }
  function changeStart(min: number) { const v = Math.min(maxStart, Math.max(minStart, min)); setItinStartMin(v); persist({ itinStartMin: v }) }
  function changeDwell(i: number, d: number) { persistStops(stops.map((s, k) => (k === i ? { ...s, dwell: Math.max(15, d) } : s))) }
  // owner removes a candidate — confirm first if it already has votes (they'd be lost)
  function attemptRemovePlace(placeId: string) {
    if (votesOf(placeId).length > 0) setConfirmRemove(placeId)
    else removePlace(placeId)
  }
  function removePlace(placeId: string) {
    voteFlip.capture(); itinFlip.capture()
    const nextPlaces = places.filter((p) => p.id !== placeId)
    const nextVotes = { ...latestVotes() }; delete nextVotes[placeId]
    const nextStops = stops.filter((s) => s.placeId !== placeId) // drop it from the itinerary too
    setPlaces(nextPlaces); setVotes(nextVotes); setStops(nextStops); setConfirmRemove(null)
    persist({
      location: { ...loc, mode, places: nextPlaces, guestsCanSuggest, meetingLink },
      votes: nextVotes,
      itinStops: nextStops.map((s) => s.placeId),
      itinDwell: nextStops.map((s) => s.dwell),
    })
  }

  // clear-all, behind an inline confirm: the ballot takes votes and the itinerary
  // with it (stops reference places); clearing the itinerary leaves the ballot alone
  function clearAllPlaces() {
    voteFlip.capture(); itinFlip.capture()
    setPlaces([]); setVotes({}); setStops([]); setBuiltRank([]); setConfirmClear(null)
    persist({
      location: { ...loc, mode, places: [], guestsCanSuggest, meetingLink },
      votes: {},
      itinStops: [], itinDwell: [], itinRank: [],
    })
  }
  function clearAllStops() {
    itinFlip.capture()
    setStops([]); setBuiltRank([]); setConfirmClear(null)
    persist({ itinStops: [], itinDwell: [], itinRank: [] })
  }

  // votes decide WHICH places make the itinerary; geometry decides the SEQUENCE.
  // Nearest-neighbor over straight-line distance — raw vote order would zigzag the route.
  function routeOrder(ids: string[]): string[] {
    if (ids.length < 3) return ids
    const remaining = [...ids]
    const route = [remaining.shift()!] // start at the top-voted place
    while (remaining.length) {
      const cur = route[route.length - 1]
      let best = 0, bestD = Infinity
      remaining.forEach((id, i) => {
        const d = legKm(places, cur, id)
        if (d < bestD) { bestD = d; best = i }
      })
      route.push(remaining.splice(best, 1)[0])
    }
    return route
  }
  function persistStops(a: ItinStop[]) {
    setStops(a); persist({ itinStops: a.map((s) => s.placeId), itinDwell: a.map((s) => s.dwell) })
  }
  const asStops = (ids: string[]): ItinStop[] => ids.map((placeId) => ({ uid: `s${stopUid.current++}`, placeId, dwell: 60 }))

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
      const nextPlaces = [...places, { ...p, addedBy: p.addedBy ?? YOU }]
      setPlaces(nextPlaces)
      persistLoc({ places: nextPlaces })
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
  // pointer reorder (works on touch + mouse): move item `from` to index `to`
  function reorderStop(from: number, to: number) {
    itinFlip.capture()
    const a = [...stops]
    const [m] = a.splice(from, 1)
    a.splice(to, 0, m)
    persistStops(a)
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
  // the stops' coordinates in order; one stop without a location and the road route is
  // off (legs fall back to straight-line estimates, the map draws a dashed line)
  const stopPoints = stops.map((s) => coordsOf(placeAt(s.placeId)))
  const routable: LatLng[] = stopPoints.every((p): p is LatLng => !!p) ? stopPoints : []
  const road = useRoute(routable)
  // schedule + per-leg travel, shared with the Attendance tab so both clocks agree
  const { schedule, legs, routeMinutes, anyUnreachable, endMin } = computeItinerary(places, stops, itinStartMin, travelModes, road?.legs)
  // how long the built itinerary actually runs vs. the time set aside for the event
  const itinDuration = endMin - itinStartMin
  const overDuration = stops.length > 0 && itinDuration > eventDuration
  const overWindow = winEnd != null && stops.length > 0 && endMin > winEnd
  // the schedule covers one day; a route that runs past midnight has to say so
  const pastMidnight = stops.length > 0 && endMin >= 24 * 60
  const blurred = mode === 'remote' || places.length === 0
  const focusPlace = focusPin ? placeAt(focusPin) : (leadingId ? placeAt(leadingId) : null)
  // what the map draws: on the ballot, one pin per located place with its vote count;
  // on the itinerary, one numbered pin per stop
  const mapPins: MapPinData[] = sub === 'vote'
    ? places.flatMap((p) => {
        const c = coordsOf(p)
        if (!c) return []
        const n = votesOf(p.id).length
        const lead = locked ? confirmedIds.has(p.id) : p.id === leadingId
        // what the pin is called out loud: once the plan is locked the lead is the chosen place
        const spoken = settled ? p.name : `${p.name}, ${n} ${n === 1 ? 'vote' : 'votes'}${lead ? (locked ? ', chosen' : ', leading') : ''}`
        return [{ id: p.id, label: String(n), name: p.name, spoken, lead, ...c }]
      })
    : stops.flatMap((s, i) => {
        const c = coordsOf(placeAt(s.placeId))
        if (!c) return []
        const name = placeAt(s.placeId)?.name
        return [{ id: s.uid, label: String(i + 1), name, spoken: name ? `Stop ${i + 1}: ${name}` : `Stop ${i + 1}`, lead: true, ...c }]
      })
  const unmapped = places.filter((p) => !coordsOf(p)).length
  // searches look near the places the event already has
  const near = centroidOf(places)
  // the pin popup: name, votes, and a vote button — fixed light colors like the map itself
  const renderPopup = (id: string) => {
    const fp = placeAt(id)
    if (!fp) return null
    return (
      <div>
              <div className="text-[13.5px] font-semibold text-[#1b1b19]">{fp.name}</div>
              <div className="mb-1.5 mt-0.5 text-[12px] text-[#6b7280]">{fp.place}</div>
              <div className="flex items-center gap-1.5">
                <span className="text-[12px] font-bold text-teal-text">{votesOf(fp.id).length} vote{votesOf(fp.id).length === 1 ? '' : 's'}</span>
                {!hideVoters && (
                  <div className="flex" role={votesOf(fp.id).length ? 'img' : undefined} aria-label={votesOf(fp.id).length ? `Voted: ${namesLabel(votesOf(fp.id).slice(0, 5).map((id) => avatarOf(id).name), votesOf(fp.id).length - 5)}` : undefined}>
                    {votesOf(fp.id).slice(0, 5).map((id) => { const a = avatarOf(id); return <span key={id} className="-mr-[5px]"><Avatar initials={a.initials} color={a.color} size={19} font={8.5} title={a.name} /></span> })}
                  </div>
                )}
              </div>
              {/* vote right from the map — the popup uses fixed light colors like the map itself */}
              {!locked && !settled && (() => {
                const youVoted = votesOf(fp.id).includes(YOU)
                return (
                  <button
                    onClick={() => toggleVote(fp.id)}
                    disabled={votingClosed || (!youVoted && maxVotes > 1 && votesLeft === 0)}
                    className="mt-2 flex h-11 sm:h-7 w-full items-center justify-center gap-1 rounded-[8px] text-[12px] font-semibold disabled:opacity-40"
                    style={youVoted ? { background: '#E7EEE8', color: '#2A4537', border: '1px solid #CBDCCE' } : { background: '#2E4A3C', color: '#F8F5EC' }}
                  >
                    {youVoted ? <><Check size={13} /> Voted</> : <><ArrowUp size={13} /> Vote</>}
                  </button>
                )
              })()}
      </div>
    )
  }

  // Flip animations: vote list re-ranks smoothly on each vote; itinerary rows slide on reorder
  const voteFlip = useFlipReorder(rankIds.join('|'))
  const itinFlip = useFlipReorder(stops.map((s) => s.uid).join('|'))
  const stopReorder = usePointerReorder(reorderStop)
  // the scrollable stops list is both the Flip scope and the drag/auto-scroll scope
  const setStopsScope = (el: HTMLDivElement | null) => {
    ;(itinFlip.scope as React.MutableRefObject<HTMLDivElement | null>).current = el
    ;(stopReorder.scope as React.MutableRefObject<HTMLDivElement | null>).current = el
  }

  function copyLink() {
    navigator.clipboard?.writeText(meetingLink || '').then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800) }).catch(() => {})
  }

  return (
    <div className="flex flex-col gap-3.5">
      {/* venue-type switch (host) — switching keeps each mode's data */}
      {event.hostedByYou && !locked && (
        <div className="flex items-center gap-2">
          <SegmentedControl label="Meeting type"
            size="sm"
            value={mode === 'remote' ? 'remote' : 'vote'}
            onChange={(v) => { setFocusPin(null); changeMode(v === 'remote' ? 'remote' : inPerson.current) }}
            options={[
              { v: 'vote', l: 'In person', icon: MapPin },
              { v: 'remote', l: 'Remote', icon: Video },
            ]}
          />
        </div>
      )}

      <div className="flex flex-col items-stretch gap-3.5 lg:flex-row">
      {/* map */}
      <div className="relative flex min-w-0 flex-1">
        <div
          className="relative min-h-[54dvh] flex-1 overflow-hidden rounded-[13px] border border-border bg-s2 transition-[filter] duration-300 lg:min-h-[580px]"
          style={{ filter: blurred ? 'blur(4px) saturate(.85)' : 'none' }}
        >
          {!blurred && (
            <EventMap
              pins={mapPins}
              route={sub === 'itin' && stops.length > 1 ? (road?.line ?? routable) : undefined}
              dashed={sub === 'itin' && !road}
              focusId={sub === 'vote' ? (focusPlace?.id ?? null) : null}
              panTo={panReq}
              onFocus={sub === 'vote' ? setFocusPin : undefined}
              renderPopup={sub === 'vote' ? renderPopup : undefined}
            />
          )}
          {/* places the map cannot show: custom ones typed by hand, or saved before the real map */}
          {!blurred && unmapped > 0 && (
            <div className="absolute left-2.5 top-2.5 z-[6] rounded-lg border border-[rgba(0,0,0,.12)] bg-white/95 px-2.5 py-1.5 text-[12px] text-[#4A463C]">
              {unmapped === 1 ? '1 place has no map location' : `${unmapped} places have no map location`}
            </div>
          )}
        </div>

        {/* overlay when the map is blurred */}
        {blurred && (
          <div className="absolute inset-0 z-[8] flex items-center justify-center p-5" style={{ background: 'color-mix(in srgb, var(--bg) 38%, transparent)' }}>
            <div className="w-full max-w-[330px] rounded-2xl border border-border2 bg-s1 px-5 py-6 text-center shadow-soft">
              {mode === 'remote' ? (
                <>
                  <span className="mx-auto mb-3 grid h-[46px] w-[46px] place-items-center rounded-xl border border-accent-border bg-accent-bg text-accent-text"><Video size={25} /></span>
                  <div className="text-[15.5px] font-semibold">This event is remote</div>
                  <p className="mb-3.5 mt-1 text-[13px] leading-[1.55] text-dim">Everyone joins online, so there is no map. The link lives here and in every reminder.</p>
                  {event.hostedByYou ? (
                    // host can set/change the link; it's kept if they switch venue type and back
                    <div className="mb-2.5 flex h-[38px] items-center gap-2 rounded-[10px] border border-border bg-s2 py-0 pl-3 pr-2 focus-within:border-accent">
                      <Link2 size={16} className="flex-none text-accent-text" />
                      <input value={meetingLink} onChange={(e) => changeLink(e.target.value)} aria-label="Meeting link" placeholder={`Paste a ${loc.platform} link`} className="min-w-0 flex-1 bg-transparent text-left font-mono text-[13px] outline-none placeholder:text-faint" />
                      {meetingLink && (
                        <button onClick={copyLink} className="flex h-7 flex-none items-center gap-1 rounded-[7px] bg-accent px-2.5 text-[12.5px] font-semibold text-on-accent">
                          {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
                        </button>
                      )}
                    </div>
                  ) : (
                    // everyone else: a way into the call, not an address to pass on, since
                    // handing out the link is the host's for now, like the invite link
                    meetingLink ? (
                      <a href={meetingLink} target="_blank" rel="noopener noreferrer" className="mb-2.5 flex h-11 w-full items-center justify-center gap-1.5 rounded-[10px] bg-accent text-[14px] font-semibold text-on-accent">
                        <Video size={16} /> Join on {loc.platform || 'the call'}
                      </a>
                    ) : (
                      <div className="mb-2.5 flex h-[38px] items-center justify-center gap-2 rounded-[10px] border border-border bg-s2 px-3 text-[13px] text-dim">
                        <Link2 size={15} className="flex-none text-faint" /> The {loc.platform} link is on its way
                      </div>
                    )
                  )}
                  <div className="text-[12.5px] text-dim">{event.participants.filter((p) => p.rsvp !== 'not_going').length} joining on {loc.platform}</div>
                </>
              ) : (
                <>
                  <span className="mx-auto mb-3 grid h-[46px] w-[46px] place-items-center rounded-xl border border-ochre-border bg-ochre-bg text-ochre-text"><MapPinOff size={25} /></span>
                  <div className="text-[15.5px] font-semibold">No location yet</div>
                  <p className="mt-1 text-[13px] leading-[1.55] text-dim">
                    {canAddPlaces
                      ? 'Nothing on the ballot yet. Add the first place in the panel and the map fills in as votes come in.'
                      : 'No candidate places yet. The host can add some, or allow guests to suggest them.'}
                  </p>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* mobile: a bar that lifts the venues/itinerary panel up as a bottom sheet */}
      {/* kept in the page (hidden) while the sheet is up, so focus has somewhere to go back to */}
      {mode !== 'remote' && (
        <button type="button" onClick={() => setSheetOpen(true)} className={`${sheetOpen ? 'hidden' : 'flex'} items-center justify-between gap-2 rounded-[12px] border border-border bg-s1 px-4 py-3 text-left shadow-soft lg:hidden`}>
          <span className="flex items-center gap-2 text-[13.5px] font-semibold"><Route size={16} className="text-accent-text" /> {sub === 'itin' ? 'Itinerary' : 'Venue vote'}</span>
          <span className="flex items-center gap-1.5 text-[12.5px] text-dim">{places.length} {places.length === 1 ? 'place' : 'places'} <ChevronUp size={16} /></span>
        </button>
      )}

      {/* side panel — only for in-person events; a bottom sheet on mobile, a column on desktop */}
      {mode !== 'remote' && (
        <div
          ref={sheetRef}
          role={sheetOpen ? 'dialog' : undefined}
          aria-modal={sheetOpen ? true : undefined}
          aria-label={sheetOpen ? (sub === 'itin' ? 'Itinerary' : settled ? 'Venue' : 'Venue vote') : undefined}
          className={`flex flex-none flex-col lg:static lg:z-auto lg:flex lg:h-[580px] lg:w-[330px] lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none ${sheetOpen ? 'fixed inset-0 z-50 w-full bg-s1 px-3' : 'hidden'}`} style={{ paddingBottom: 'env(safe-area-inset-bottom)', ...(sheetOpen ? { paddingTop: 'calc(env(safe-area-inset-top) + 8px)' } : {}) }}>
          {/* runs on past the bottom edge in the panel's own colour, so the frame the pin
              lags behind a keyboard or the browser's bar shows more panel, not the page */}
          {sheetOpen && <div className="pointer-events-none absolute inset-x-0 top-full h-[100lvh] bg-s1 lg:hidden" aria-hidden />}
          <div className="mb-3 flex flex-none items-center gap-2">
            {/* whether the place is a ballot or a route is the host's decision, the
                same as in person or remote above it. Everyone else is shown the one
                that was chosen, and moves with it when the host changes their mind. */}
            {event.hostedByYou ? (
              <SegmentedControl label="Vote or route"
                size="sm"
                stretch
                className="flex-1"
                value={sub}
                onChange={(v) => { setSub(v as 'vote' | 'itin'); setFocusPin(null); persistLoc({ planMode: v === 'itin' ? 'itinerary' : 'vote' }) }}
                options={[{ v: 'vote', l: settled ? 'Venue' : 'Venue vote' }, { v: 'itin', l: 'Itinerary' }]}
              />
            ) : (
              <span className="flex h-8 min-w-0 flex-1 items-center text-[13.5px] font-semibold">
                {sub === 'itin' ? 'Itinerary' : settled ? 'Venue' : 'Venue vote'}
              </span>
            )}
            {sub === 'itin' && canEditItin && (
              // adding lives in a dropdown so the stop list keeps the room
              <Popover
                align="end"
                width={300}
                className="flex-none"
                trigger={(open) => (
                  <span className={`flex h-8 flex-none items-center gap-1 rounded-[9px] border px-2.5 text-[13px] font-semibold ${open ? 'border-accent bg-accent-bg text-accent-text' : 'border-border2 bg-s1 hover:bg-s2'}`}>
                    <Plus size={16} /> Add stop
                  </span>
                )}
              >
                {() => <AddStopList near={near} places={places} stops={stops} canAdd={canAddPlaces} onExisting={addStop} onNew={addNewPlaceAsStop} />}
              </Popover>
            )}
            {sub === 'vote' && event.hostedByYou && !locked && !settled && (
              <Popover
                align="end"
                width={236}
                label="Voting settings"
                trigger={(open) => (
                  <span className={`flex h-8 flex-none items-center gap-1 rounded-[9px] border px-2.5 text-[13px] font-semibold ${open ? 'border-accent bg-accent-bg text-accent-text' : 'border-border2 bg-s1 hover:bg-s2'}`}>
                    <SlidersHorizontal size={15} />
                  </span>
                )}
              >
                {() => (
                  <div className="flex flex-col gap-3 p-1">
                    <div>
                      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[.12em] text-faint">Votes per person</div>
                      <div className="flex flex-wrap items-center gap-2">
                        <SegmentedControl label="Votes per person"
                          size="sm"
                          value={customVotes ? 'custom' : String(maxVotes)}
                          onChange={(v) => {
                            if (v === 'custom') { setCustomVotes(true); changeMaxVotes(Math.max(4, maxVotes)) }
                            else { setCustomVotes(false); changeMaxVotes(Number(v)) }
                          }}
                          options={[{ v: '1', l: '1' }, { v: '2', l: '2' }, { v: '3', l: '3' }, { v: 'custom', l: 'Custom' }]}
                        />
                        {customVotes && (
                          <div className="flex items-center gap-1">
                            <button onClick={() => changeMaxVotes(maxVotes - 1)} disabled={maxVotes <= 1} className="grid h-7 w-7 place-items-center rounded-[7px] border border-border2 bg-s1 enabled:hover:bg-s2 disabled:opacity-30" aria-label="Fewer votes"><Minus size={13} /></button>
                            <input
                              type="number" min={1} max={voteCap} value={maxVotes}
                              onChange={(e) => { const n = parseInt(e.target.value, 10); if (!Number.isNaN(n)) changeMaxVotes(n) }}
                              className="h-7 w-11 rounded-[7px] border border-border bg-s1 px-1.5 text-center text-[13.5px] font-semibold text-text tabular-nums outline-none focus:border-accent"
                              aria-label="Votes per person"
                            />
                            <button onClick={() => changeMaxVotes(maxVotes + 1)} disabled={maxVotes >= voteCap} className="grid h-7 w-7 place-items-center rounded-[7px] border border-border2 bg-s1 enabled:hover:bg-s2 disabled:opacity-30" aria-label="More votes"><Plus size={13} /></button>
                            <span className="text-[12px] text-faint">of {voteCap}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="border-t border-border pt-2.5">
                      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[.12em] text-faint">Voting closes</div>
                      <div className="flex items-center gap-1.5">
                        <DateField label="Voting closes" value={voteDeadline} min={todayKey()} onChange={changeDeadline} className="h-11 min-w-0 flex-1 !bg-s1 sm:h-8" />
                        {voteDeadline && (
                          <button onClick={() => changeDeadline('')} title="Remove the deadline" aria-label="Remove the deadline" className="grid h-8 w-8 flex-none place-items-center rounded-[8px] border border-border2 text-dim hover:text-brick-text"><X size={14} /></button>
                        )}
                      </div>
                      <p className="mt-1.5 text-[12px] leading-[1.45] text-faint">Votes and ballot changes freeze after this day.</p>
                    </div>
                    <label className="flex cursor-pointer items-center gap-2 border-t border-border pt-2.5 text-[13px]">
                      <input type="checkbox" checked={guestsCanSuggest} onChange={toggleGuestsCanSuggest} className="h-3.5 w-3.5" style={{ accentColor: 'var(--accent)' }} />
                      Guests can add places
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 border-t border-border pt-2.5 text-[13px]">
                      <input type="checkbox" checked={hideVoters} onChange={toggleHideVoters} className="h-3.5 w-3.5" style={{ accentColor: 'var(--accent)' }} />
                      Hide votes
                    </label>
                  </div>
                )}
              </Popover>
            )}
            <button onClick={closeSheet} aria-label="Close" className="-mr-1.5 grid h-11 w-11 flex-none place-items-center rounded-lg text-dim hover:text-text lg:hidden"><X size={18} /></button>
          </div>

          {/* one line of how this tab works, gone once dismissed */}
          {!locked && !hintDismissed && (
            <div className="mb-2 flex items-start gap-2 rounded-[10px] border border-border bg-s2 px-3 py-2">
              <Info size={14} className="mt-0.5 flex-none text-accent-text" />
              <span className="min-w-0 flex-1 text-[12.5px] leading-[1.5] text-dim">
                {settled ? 'The host set the place. Availability still decides the time.' : sub === 'vote' ? 'Add places and vote. The host locks in the winner.' : 'Votes pick the places. The route puts them in order.'}
              </span>
              <button type="button" onClick={dismissHint} aria-label="Dismiss hint" className="relative before:absolute before:-inset-[5px] before:content-[''] flex-none text-faint hover:text-text"><X size={14} /></button>
            </div>
          )}

          {sub === 'vote' && (
            <div className="flex min-h-0 flex-1 flex-col gap-2">
              {canAddPlaces && <AddPlaceSearch near={near} onAdd={addPlace} taken={new Set(places.map((p) => p.id))} placeholder={settled ? 'Add or change the place…' : undefined} />}
              {places.length === 0 ? (
                <EmptyNote icon={Vote} text={settled ? 'No place set yet. The host adds it above.' : canAddPlaces ? 'No places on the ballot yet. Search above to add the first one.' : 'No places to vote on yet. The host can add some, or allow guests to.'} />
              ) : locked || settled ? null : (
                // always show the vote budget — first-timers need to know tapping the arrow votes
                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 px-0.5 text-[12.5px] text-dim">
                  <Vote size={15} className="flex-none text-accent-text" />
                  {maxVotes > 1 ? (
                    <span>{maxVotes} votes each, <span className={`font-semibold ${votesLeft ? 'text-accent-text' : 'text-brick-text'}`}>{votesLeft} left</span></span>
                  ) : (() => {
                    const mine = places.find((p) => votesOf(p.id).includes(YOU))
                    return mine
                      ? <span>1 vote each, yours is on <span className="font-semibold text-text">{mine.name}</span></span>
                      : <span>1 vote each, and you haven&apos;t voted yet</span>
                  })()}
                  {voteDeadline && (
                    votingClosed
                      ? <span className="rounded-[5px] border border-brick-border bg-brick-bg px-[6px] py-px text-[10.5px] font-semibold text-brick-text">Voting closed</span>
                      : <span className={`rounded-[5px] border px-[6px] py-px text-[10.5px] font-semibold ${(deadlineDu ?? 9) <= 2 ? 'border-ochre-border bg-ochre-bg text-ochre-text' : 'border-border bg-s2 text-dim'}`}>Closes {deadlineText(voteDeadline)}</span>
                  )}
                  {event.hostedByYou && (
                    <button ref={clearPlacesBtn} onClick={() => setConfirmClear('places')} className="ml-auto flex items-center gap-1 text-[12px] font-medium text-faint hover:text-brick-text">
                      <Trash2 size={13} /> Remove all
                    </button>
                  )}
                </div>
              )}
              {confirmClear === 'places' && (
                <div className="flex flex-wrap items-center gap-2 rounded-[10px] border border-brick-border bg-brick-bg px-2.5 py-2">
                  <TriangleAlert size={17} className="flex-none text-brick-text" />
                  <span className="min-w-0 flex-1 text-[12.5px] leading-[1.4] text-brick-text">
                    Remove all {places.length} places? Every vote{stops.length > 0 ? ' and the whole itinerary' : ''} goes with them.
                  </span>
                  <button type="button" autoFocus onClick={() => { setConfirmClear(null); clearPlacesBtn.current?.focus() }} className="flex h-7 flex-none items-center rounded-[7px] border border-brick-border bg-s1 px-2.5 text-[12.5px] font-semibold text-brick-text">Cancel</button>
                  <button onClick={clearAllPlaces} className="flex h-7 flex-none items-center rounded-[7px] px-2.5 text-[12.5px] font-semibold text-white" style={{ background: 'var(--brick)' }}>Remove all</button>
                </div>
              )}
              <div ref={voteFlip.scope} className="scroll-slim flex max-h-[55vh] min-h-0 flex-1 flex-col gap-2 overflow-auto py-0.5 pr-0.5 lg:max-h-none">
                {ranked.map((p, i) => {
                  const ids = votesOf(p.id)
                  const you = ids.includes(YOU)
                  const isLocked = locked && confirmedIds.has(p.id)
                  const isSet = settled && !locked // the venue as fact, before any lock-in
                  const lead = locked ? isLocked : !settled && p.id === leadingId
                  const adder = p.addedBy ? avatarOf(p.addedBy) : null
                  return (
                    <div key={p.id} data-flip-id={p.id} onClick={() => goToPin(p.id)} className={`relative flex cursor-pointer items-start gap-2.5 rounded-xl border p-2.5 ${isLocked || isSet ? 'border-teal-border bg-teal-bg/40' : lead ? 'border-accent-border bg-accent-bg/40' : 'border-border bg-s0'}`}>
                      <span className={`grid h-[30px] w-[30px] flex-none place-items-center rounded-full text-[13.5px] font-bold ${isLocked || isSet ? 'bg-teal-bg text-teal-text' : lead ? 'bg-accent text-on-accent' : 'bg-s2 text-dim'}`}>{isSet ? <MapPin size={15} /> : i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <div className="mb-0.5 flex items-center gap-1.5">
                          {/* the name is the keyboard's way to the pin; the card still takes a click anywhere */}
                          <button type="button" onClick={(e) => { e.stopPropagation(); goToPin(p.id) }} className="text-left text-[14px] font-semibold">{p.name}</button>
                          {isLocked && <span className="flex flex-none items-center gap-1 rounded-[5px] border border-teal-border bg-teal-bg px-[5px] py-px text-[10px] font-semibold text-teal-text"><Check size={10} /> Locked in</span>}
                          {isSet && <span className="flex flex-none items-center gap-1 rounded-[5px] border border-teal-border bg-teal-bg px-[5px] py-px text-[10px] font-semibold text-teal-text"><Check size={10} /> Set</span>}
                          {!locked && lead && <span className="flex-none rounded-[5px] border border-accent-border bg-accent-bg px-[5px] py-px text-[10px] font-semibold text-accent-text">Leading</span>}
                        </div>
                        {/* address wraps in full — no truncation */}
                        <div className="mb-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12px] leading-[1.45] text-dim">
                          <span>{p.place}{settled ? '' : ` (${ids.length} vote${ids.length === 1 ? '' : 's'})`}</span>
                          <a href={osmUrl(p)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-0.5 text-[11.5px] font-medium text-accent-text hover:underline">
                            <ExternalLink size={11} /> Map
                          </a>
                          {adder && (
                            <span className="inline-flex items-center gap-1 text-faint" title={`Added by ${adder.name}`}>
                              <Avatar initials={adder.initials} color={adder.color} size={14} font={7} /> added by {adder.you ? 'you' : adder.name.split(' ')[0]}
                            </span>
                          )}
                        </div>
                        {!hideVoters && !settled && (
                          <div className="flex" role={ids.length ? 'img' : undefined} aria-label={ids.length ? `Voted: ${namesLabel(ids.slice(0, 6).map((id) => avatarOf(id).name), ids.length - 6)}` : undefined}>
                            {ids.slice(0, 6).map((id) => { const a = avatarOf(id); return <span key={id} className="-mr-[5px]"><Avatar initials={a.initials} color={a.color} size={20} font={8.5} title={a.name} /></span> })}
                          </div>
                        )}
                      </div>
                      {!locked && (
                        <div className="flex flex-none items-center gap-1">
                          {!settled && <button
                            onClick={(e) => { e.stopPropagation(); toggleVote(p.id) }}
                            aria-pressed={you}
                            disabled={votingClosed || (!you && maxVotes > 1 && votesLeft === 0)}
                            title={votingClosed ? 'Voting is closed' : you ? 'Remove your vote' : votesLeft === 0 && maxVotes > 1 ? 'No votes left' : 'Vote for this place'}
                            className={`grid h-[34px] w-[34px] place-items-center rounded-[9px] border ${you ? 'border-accent bg-accent text-on-accent' : 'border-border2 bg-s1 text-text enabled:hover:bg-s2 disabled:opacity-40'}`}
                          >
                            {you ? <Check size={18} /> : <ArrowUp size={18} />}
                          </button>}
                          {event.hostedByYou && (
                            <button data-remove-trigger onClick={() => attemptRemovePlace(p.id)} title="Remove this place" aria-label={`Remove ${p.name}`} className="grid h-[34px] w-7 place-items-center rounded-[9px] text-faint hover:text-brick-text">
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      )}
                      {confirmRemove === p.id && (
                        <div className="absolute inset-0 z-10 flex items-center gap-2 rounded-xl border border-brick-border bg-brick-bg px-2.5">
                          <TriangleAlert size={17} className="flex-none text-brick-text" />
                          <span className="min-w-0 flex-1 text-[12.5px] leading-[1.4] text-brick-text">Remove {p.name}? Its {ids.length} vote{ids.length === 1 ? '' : 's'} will be lost.</span>
                          <button
                            type="button"
                            autoFocus // the confirm covers the trash button, so focus comes here, and goes back on Cancel
                            onClick={(e) => {
                              const trigger = e.currentTarget.closest('[data-flip-id]')?.querySelector<HTMLElement>('[data-remove-trigger]')
                              setConfirmRemove(null)
                              trigger?.focus()
                            }}
                            className="flex h-7 flex-none items-center rounded-[7px] border border-brick-border bg-s1 px-2.5 text-[12.5px] font-semibold text-brick-text"
                          >Cancel</button>
                          <button onClick={() => removePlace(p.id)} className="flex h-7 flex-none items-center rounded-[7px] px-2.5 text-[12.5px] font-semibold text-white" style={{ background: 'var(--brick)' }}>Remove</button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {sub === 'itin' && (
            <div className="flex min-h-0 flex-1 flex-col gap-2">
              {canEditItin && rankChanged && (
                <div className="rounded-[10px] border border-ochre-border bg-ochre-bg p-3">
                  <div className="flex items-start gap-2">
                    <RefreshCw size={15} className="mt-0.5 flex-none text-ochre-text" />
                    <p className="text-[13px] leading-[1.5] text-ochre-text">Votes have changed since this itinerary was built, and the ranking is different now.</p>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button onClick={buildFromVotes} className="flex h-7 items-center rounded-[7px] px-2.5 text-[12.5px] font-semibold text-white" style={{ background: 'var(--ochre)' }}>Rebuild from votes</button>
                    <button onClick={keepCurrentItin} className="flex h-7 items-center rounded-[7px] border border-ochre-border bg-s1 px-2.5 text-[12.5px] font-semibold text-ochre-text">Keep as is</button>
                  </div>
                </div>
              )}
              {stops.length === 0 ? (
                // empty is the one time adding gets the full space — build or add inline
                <div className="scroll-slim flex min-h-0 flex-col gap-2 overflow-auto">
                  <div className="flex-none rounded-xl border border-border bg-s0 p-4 text-center">
                    <span className="mx-auto mb-2.5 grid h-[38px] w-[38px] place-items-center rounded-[10px] border border-teal-border bg-teal-bg text-teal-text"><Route size={19} /></span>
                    <div className="text-[14px] font-semibold">No itinerary yet</div>
                    <p className="mx-auto mt-1 max-w-[250px] text-[13px] leading-[1.5] text-dim">
                      {locked
                        ? 'The plan was locked without stops. The host can reopen planning to build one.'
                        : canEditItin
                          ? 'Build one from the top-voted places, or add stops one at a time below.'
                          : 'The host puts the route together. Voting on places is how you steer it.'}
                    </p>
                    {canEditItin && (
                      <button
                        onClick={buildFromVotes}
                        disabled={places.length === 0}
                        className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-[9px] bg-accent px-3.5 text-[13.5px] font-semibold text-on-accent disabled:opacity-40"
                      >
                        <Route size={15} /> Build from top votes
                      </button>
                    )}
                  </div>
                  {canEditItin && <AddStopList near={near} places={places} stops={stops} canAdd={canAddPlaces} onExisting={addStop} onNew={addNewPlaceAsStop} />}
                </div>
              ) : (
                <>
                  {!locked && event.hostedByYou && (
                    confirmClear === 'stops' ? (
                      <div className="flex flex-none flex-wrap items-center gap-2 rounded-[10px] border border-brick-border bg-brick-bg px-2.5 py-2">
                        <TriangleAlert size={17} className="flex-none text-brick-text" />
                        <span className="min-w-0 flex-1 text-[12.5px] leading-[1.4] text-brick-text">Clear all {stops.length} stops? The places and votes stay.</span>
                        <button type="button" autoFocus onClick={() => { refocusClearStops.current = true; setConfirmClear(null) }} className="flex h-7 flex-none items-center rounded-[7px] border border-brick-border bg-s1 px-2.5 text-[12.5px] font-semibold text-brick-text">Cancel</button>
                        <button onClick={clearAllStops} className="flex h-7 flex-none items-center rounded-[7px] px-2.5 text-[12.5px] font-semibold text-white" style={{ background: 'var(--brick)' }}>Clear</button>
                      </div>
                    ) : (
                      <button
                        // the confirm takes this button's place; Cancel puts it back and focus with it
                        ref={(el) => { if (el && refocusClearStops.current) { refocusClearStops.current = false; el.focus() } }}
                        onClick={() => setConfirmClear('stops')}
                        className="flex flex-none items-center gap-1 self-end px-0.5 text-[12px] font-medium text-faint hover:text-brick-text">
                        <Trash2 size={13} /> Clear itinerary
                      </button>
                    )
                  )}
                  {/* one slim schedule line — the stop list below is the main content */}
                  <div className="flex flex-none flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-border bg-s0 px-2.5 py-2">
                    <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-dim">
                      <Clock size={13} /> Starts
                      {!canEditItin
                        ? <span className="text-[12.5px] font-semibold text-text tabular-nums">{fmtMinute(itinStartMin)}</span>
                        : <TimeSelect value={itinStartMin} onChange={changeStart} min={minStart} max={maxStart} title={`When the itinerary begins${bw ? ` — best free window ${fmtMinute(winStart!)} to ${fmtMinute(winEnd!)}, ${bw.count} of ${event.participants.length} free` : ''}`} />}
                    </span>
                    <span className="text-[12.5px] text-dim">
                      Ends ~{fmtMinuteDay(endMin)}, <span className={overDuration ? 'font-semibold text-ochre-text' : ''}>{fmtDuration(itinDuration)}</span>
                      {legs.length > 0 && <> with {fmtDuration(routeMinutes)} of travel</>}
                    </span>
                    <span className="ml-auto">
                      {!canEditItin ? (
                        <span className="flex flex-wrap items-center gap-1">
                          {travelModes.map((m) => { const Icon = MODE_ICON[m]; return (
                            <span key={m} title={MODE_LABEL[m]} className="flex items-center gap-1 rounded-full border border-accent-border bg-accent-bg px-1.5 py-0.5 text-[11px] font-medium text-accent-text"><Icon size={11} /></span>
                          ) })}
                        </span>
                      ) : (
                        // a set-once choice — tucked behind a popover so the schedule stays the focus
                        <Popover
                          align="end"
                          width={228}
                          trigger={(open) => (
                            <span className={`flex h-7 items-center gap-1.5 rounded-lg border px-[10px] text-[12px] font-medium ${open ? 'border-accent bg-accent-bg text-accent-text' : 'border-border bg-s1 text-dim hover:border-border2'}`}>
                              Getting around
                              <span className="flex items-center gap-0.5">
                                {travelModes.map((m) => { const Icon = MODE_ICON[m]; return <Icon key={m} size={11} /> })}
                              </span>
                            </span>
                          )}
                        >
                          {() => (
                            <div className="p-1">
                              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[.12em] text-faint">How people get between stops</div>
                              <p className="mb-2 text-[12px] leading-[1.5] text-dim">Driving for now, with times from the road network. Walking and transit are coming.</p>
                              <div className="flex flex-wrap gap-1">
                                {ALL_MODES.map((m) => { const on = travelModes.includes(m); const Icon = MODE_ICON[m]; return (
                                  <button key={m} onClick={() => toggleMode(m)} title={MODE_LABEL[m]} className={`flex items-center gap-1 rounded-full border px-2 py-1 text-[11.5px] font-medium ${on ? 'border-accent bg-accent-bg text-accent-text' : 'border-border bg-s1 text-faint hover:text-text'}`}>
                                    <Icon size={12} /> {MODE_LABEL[m]}
                                  </button>
                                ) })}
                              </div>
                            </div>
                          )}
                        </Popover>
                      )}
                    </span>
                    {(anyUnreachable || pastMidnight || overDuration || overWindow) && (
                      <div className={`flex w-full items-start gap-1.5 text-[12px] leading-[1.4] ${anyUnreachable || pastMidnight ? 'text-brick-text' : 'text-ochre-text'}`}>
                        <TriangleAlert size={12} className="mt-px flex-none" />
                        <span>
                          {/* the fact is worth knowing either way; the fix only reads
                              as help to the person who can actually make it */}
                          {anyUnreachable
                            ? 'Some legs have no route with the modes you allow.'
                            : pastMidnight
                              ? `Runs past midnight, ending ${fmtMinuteDay(endMin)}.${canEditItin ? ' An itinerary covers one day, so start earlier or trim a stop.' : ''}`
                            : overDuration
                              ? `Runs ${fmtDuration(itinDuration)}, longer than the ${fmtDuration(eventDuration)} set aside.${canEditItin ? ' Trim a stop or shorten time at a venue.' : ''}`
                              : `Runs past the best free window (ends ~${fmtMinute(endMin)}, window closes ${fmtMinute(winEnd!)}).`}
                        </span>
                      </div>
                    )}
                  </div>

                  <div ref={setStopsScope} className="scroll-slim flex max-h-[50vh] min-h-0 flex-1 flex-col gap-2 overflow-auto py-0.5 pr-0.5 lg:max-h-none">
                    {stops.map((s, i) => {
                      const p = placeAt(s.placeId)
                      if (!p) return null
                      const leg = i < legs.length ? legs[i] : null
                      return (
                        <Fragment key={s.uid}>
                          <div
                            data-flip-id={s.uid}
                            data-reorder-item
                            className={`flex items-start gap-2 rounded-xl border bg-s0 p-2.5 ${stopReorder.dragIndex === i ? 'border-accent-border opacity-60 shadow-soft' : 'border-border'}`}
                          >
                            {canEditItin && <button {...stopReorder.handleProps(i)} aria-label="Drag to reorder" className="mt-0.5 flex-none text-faint hover:text-dim"><GripVertical size={17} /></button>}
                            <span className="mt-px grid h-6 w-6 flex-none place-items-center rounded-full bg-accent text-[12.5px] font-bold text-on-accent">{i + 1}</span>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <button type="button" onClick={() => goToPin(s.uid)} className="text-left text-[14px] font-semibold hover:underline">{p.name}</button>
                                {stops.filter((x) => x.placeId === s.placeId).length > 1 && <span className="flex-none rounded-[5px] border border-border2 bg-s2 px-[5px] py-px text-[9.5px] font-semibold text-dim">revisit</span>}
                              </div>
                              <div className="text-[12px] leading-[1.45] text-dim">{p.place} ({votesOf(s.placeId).length} vote{votesOf(s.placeId).length === 1 ? '' : 's'})</div>
                              {/* scheduled arrive–depart + dwell stepper */}
                              <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                                <span className="flex items-center gap-1 text-[12px] font-semibold text-accent-text"><Clock size={12} /> {fmtMinuteDay(schedule[i].arrive)} – {fmtMinuteDay(schedule[i].depart)}</span>
                                <span className="flex items-center gap-1 text-[12px] text-dim">
                                  {canEditItin && <button onClick={() => changeDwell(i, s.dwell - 15)} disabled={s.dwell <= 15} className="relative before:absolute before:-inset-[5px] before:content-[''] grid h-[15px] w-[15px] place-items-center rounded border border-border enabled:hover:bg-s2 disabled:opacity-30" aria-label="Less time"><Minus size={10} /></button>}
                                  {fmtDuration(s.dwell)} here
                                  {canEditItin && <button onClick={() => changeDwell(i, s.dwell + 15)} className="relative before:absolute before:-inset-[5px] before:content-[''] grid h-[15px] w-[15px] place-items-center rounded border border-border hover:bg-s2" aria-label="More time"><Plus size={10} /></button>}
                                </span>
                              </div>
                            </div>
                            {canEditItin && (
                              <div className="flex flex-none items-center">
                                <button onClick={() => moveStop(i, -1)} disabled={i === 0} className="grid h-6 w-6 place-items-center rounded-[6px] text-dim enabled:hover:text-text disabled:opacity-30" aria-label="Move up"><ChevronUp size={17} /></button>
                                <button onClick={() => moveStop(i, 1)} disabled={i === stops.length - 1} className="grid h-6 w-6 place-items-center rounded-[6px] text-dim enabled:hover:text-text disabled:opacity-30" aria-label="Move down"><ChevronDown size={17} /></button>
                                <button onClick={() => removeStop(i)} className="grid h-6 w-6 place-items-center rounded-[6px] text-faint hover:text-brick-text" aria-label="Remove stop"><X size={16} /></button>
                              </div>
                            )}
                          </div>
                          {leg && <TravelLeg est={leg.est} fastest={leg.fast} />}
                        </Fragment>
                      )
                    })}
                  </div>

                </>
              )}
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  )
}

// travel connector between two stops — every allowed mode with its time, fastest highlighted
function TravelLeg({ est, fastest }: { est: ModeEstimate[]; fastest: ModeEstimate | null }) {
  return (
    <div className="flex items-stretch gap-2 pl-3">
      <div className="flex w-6 flex-none justify-center">
        <span className="my-0.5 w-px" style={{ background: 'repeating-linear-gradient(var(--border2) 0 3px, transparent 3px 6px)' }} />
      </div>
      <div className="flex flex-wrap items-center gap-1 py-1.5">
        {est.length === 0 ? (
          <span className="flex items-center gap-1 rounded-full border border-brick-border bg-brick-bg px-2 py-0.5 text-[12px] text-brick-text"><TriangleAlert size={11} /> No allowed route</span>
        ) : est.map((e) => {
          const Icon = MODE_ICON[e.mode]
          // "fastest" only means something when there was a choice
          const best = est.length > 1 && !!fastest && e.mode === fastest.mode
          return (
            <span
              key={e.mode}
              title={`${MODE_LABEL[e.mode]}, ${fmtDuration(e.minutes)}${best ? ' (fastest)' : ''}`}
              className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[12px] ${best ? 'border-accent bg-accent text-on-accent font-semibold' : est.length === 1 ? 'border-accent-border bg-accent-bg font-medium text-accent-text' : 'border-border bg-s1 text-dim'}`}
            >
              <Icon size={12} /> {fmtDuration(e.minutes)}
            </span>
          )
        })}
      </div>
    </div>
  )
}

/* search-to-add for the ballot (host, or guests once allowed) — same Photon/Nominatim flow as the wizard */
function AddPlaceSearch({ onAdd, taken, near, placeholder = 'Add a place to the ballot…' }: { onAdd: (p: EventPlace) => void; taken: Set<string>; near?: LatLng; placeholder?: string }) {
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
        setResults(await searchPlaces(term, ctrl.signal, near))
      } catch (err) {
        if ((err as Error).name !== 'AbortError') setResults([])
      } finally { setSearching(false) }
    }, 350)
    return () => { ctrl.abort(); clearTimeout(t) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term, near?.lat, near?.lng])

  const shown = results.filter((r) => !taken.has(r.id))
  function pick(p: EventPlace) { onAdd(p); setQuery('') }

  return (
    <div className="relative">
      <div className="flex h-9 items-center gap-2 rounded-[10px] border border-border bg-s2 px-3 focus-within:border-accent">
        <Search size={15} className="flex-none text-faint" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search for a place" placeholder={placeholder} className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-faint" />
      </div>
      {term && (
        <div className="scroll-slim absolute left-0 right-0 top-full z-20 mt-1 max-h-[240px] overflow-auto overscroll-contain rounded-[10px] border border-border bg-s1 p-1 shadow-soft">
          {term.length < 3 ? (
            <div className="px-2.5 py-2 text-[12.5px] text-faint">Keep typing to search for a place…</div>
          ) : (
            <>
              {searching && <div className="flex items-center gap-2 px-2.5 py-2 text-[12.5px] text-faint"><Loader2 size={13} className="animate-spin" /> Searching…</div>}
              {!searching && shown.map((r) => (
                <button key={r.id} type="button" onClick={() => pick(r)} className="flex w-full items-center gap-2 rounded-[7px] px-2.5 py-2 text-left hover:bg-s2">
                  <MapPin size={15} className="flex-none text-dim" />
                  <span className="min-w-0 flex-1"><OverflowText className="text-[13.5px] font-medium">{r.name}</OverflowText><OverflowText className="text-[12px] text-faint">{r.place}</OverflowText></span>
                  <Plus size={15} className="flex-none text-accent-text" />
                </button>
              ))}
              {!searching && shown.length === 0 && <div className="px-2.5 py-1.5 text-[12.5px] text-faint">No new matches. It may already be on the ballot.</div>}
              {!searching && (
                <button type="button" onClick={() => pick({ id: `custom:${term.toLowerCase()}`, name: term, place: 'Custom place' })} className="mt-0.5 flex w-full items-center gap-2 rounded-[7px] border-t border-border px-2.5 py-2 text-left hover:bg-s2">
                  <Plus size={15} className="flex-none text-accent-text" />
                  <span className="min-w-0 truncate text-[13.5px]">Add “<span className="font-semibold">{term}</span>” as a custom place</span>
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

/* candidates + a search, shared by the Add stop dropdown and the empty itinerary */
function AddStopList({ places, stops, canAdd, near, onExisting, onNew }: {
  places: EventPlace[]
  stops: ItinStop[]
  canAdd: boolean
  near?: LatLng
  onExisting: (placeId: string) => void
  onNew: (p: EventPlace) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      {places.length > 0 && (
        <div className="scroll-slim flex max-h-[168px] flex-col gap-1 overflow-auto pr-0.5">
          {places.map((p) => {
            const count = stops.filter((s) => s.placeId === p.id).length
            return (
              <button key={p.id} onClick={() => onExisting(p.id)} className="flex items-start gap-2 rounded-[9px] border border-border bg-s1 px-2.5 py-1.5 text-left hover:border-border2">
                <MapPin size={15} className="mt-0.5 flex-none text-dim" />
                <span className="min-w-0 flex-1"><OverflowText className="text-[13.5px] font-medium leading-[1.4]">{p.name}</OverflowText><OverflowText className="text-[12px] text-faint">{p.place}</OverflowText></span>
                <span className="mt-0.5 flex flex-none items-center gap-1 text-[12.5px] font-semibold text-accent-text"><Plus size={15} /> {count > 0 ? `Again${count > 1 ? ` (${count})` : ''}` : 'Add'}</span>
              </button>
            )
          })}
        </div>
      )}
      {canAdd
        ? <AddPlaceSearch near={near} onAdd={onNew} taken={new Set(places.map((p) => p.id))} placeholder="Search a new place to add…" />
        : places.length === 0 && <EmptyNote icon={MapPin} text="No places to add yet. The host can add candidate places." />}
    </div>
  )
}

function EmptyNote({ icon: Icon, text }: { icon: typeof Vote; text: string }) {
  return (
    <div className="flex items-start gap-2 rounded-[10px] border border-border bg-s2 px-3 py-2.5">
      <Icon size={16} className="mt-0.5 flex-none text-accent-text" />
      <span className="text-[13px] leading-[1.5] text-dim">{text}</span>
    </div>
  )
}
