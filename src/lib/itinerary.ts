import { estimateModes, fastestMode, ALL_MODES, type TravelMode, type ModeEstimate } from './travel'
import { coordsOf, haversineKm, type RoadLeg } from './geo'
import type { EventPlace } from './events'

// fallback spots for places with no coordinates (custom places typed by hand, events
// saved before the real map): deterministic by index, so estimates stay stable
export const PIN_SLOTS = [
  { left: '27%', top: '60%' }, { left: '55%', top: '38%' }, { left: '70%', top: '72%' },
  { left: '38%', top: '22%' }, { left: '16%', top: '34%' }, { left: '82%', top: '28%' },
  { left: '48%', top: '80%' }, { left: '64%', top: '14%' },
]
// ~0.6 km per slot-percent — puts a metro-area offsite in walk/drive/transit range
const KM_PER_PCT = 0.6

function slotFor(places: EventPlace[], id: string) {
  return PIN_SLOTS[Math.max(0, places.findIndex((p) => p.id === id)) % PIN_SLOTS.length]
}
// straight-line distance between two places, in km — real when both have coordinates
export function legKm(places: EventPlace[], a: string, b: string) {
  const ca = coordsOf(places.find((p) => p.id === a)), cb = coordsOf(places.find((p) => p.id === b))
  if (ca && cb) return haversineKm(ca, cb)
  const pa = slotFor(places, a), pb = slotFor(places, b)
  return Math.hypot(parseFloat(pa.left) - parseFloat(pb.left), parseFloat(pa.top) - parseFloat(pb.top)) * KM_PER_PCT
}

export type ItinStopInput = { placeId: string; dwell: number }
export type ScheduledStop<T extends ItinStopInput = ItinStopInput> = T & { arrive: number; depart: number }
export type ItinLeg = { est: ModeEstimate[]; fast: ModeEstimate | null; minutes: number; road: boolean }

/**
 * The single source of truth for itinerary timing — both the Location tab (which edits it live)
 * and the Attendance tab (which reads it back) run stops through this so their clocks agree.
 * Flows dwell + fastest-allowed travel through the day; leg minutes are 0 when no allowed mode
 * can make the hop (also surfaced via `anyUnreachable`).
 * `roads`, when given (one entry per leg, from OSRM via useRoute), supplies real road
 * distance for every mode and real driving minutes; otherwise the straight-line model runs.
 */
export function computeItinerary<T extends ItinStopInput>(
  places: EventPlace[], stops: T[], startMin: number, travelModes: TravelMode[], roads?: RoadLeg[] | null,
): {
  schedule: ScheduledStop<T>[]
  legs: ItinLeg[]
  routeMinutes: number
  modesUsed: TravelMode[]
  anyUnreachable: boolean
  endMin: number
} {
  const modes = travelModes.length ? travelModes : [...ALL_MODES]
  const legs: ItinLeg[] = stops.slice(0, -1).map((s, i) => {
    const road = roads?.[i] ?? null
    const km = road ? road.km : legKm(places, s.placeId, stops[i + 1].placeId)
    // driving gets the router's minutes plus the model's parking overhead; the other
    // modes run the model over road distance instead of the straight line
    const est = estimateModes(km, modes)
      .map((e) => (road && e.mode === 'drive' ? { ...e, minutes: Math.max(1, road.minutes + 3) } : e))
      .sort((a, b) => a.minutes - b.minutes)
    const fast = fastestMode(est)
    return { est, fast, minutes: fast?.minutes ?? 0, road: !!road }
  })
  const schedule: ScheduledStop<T>[] = []
  const startAt = (idx: number) => startMin + stops.slice(0, idx).reduce((sum, s, k) => sum + s.dwell + (k < legs.length ? legs[k].minutes : 0), 0)
  for (let i = 0; i < stops.length; i++) {
    const arrive = startAt(i)
    schedule.push({ ...stops[i], arrive, depart: arrive + stops[i].dwell })
  }
  const routeMinutes = legs.reduce((s, l) => s + l.minutes, 0)
  const modesUsed = [...new Set(legs.map((l) => l.fast?.mode).filter(Boolean))] as TravelMode[]
  const anyUnreachable = legs.some((l) => !l.fast)
  const endMin = schedule.length ? schedule[schedule.length - 1].depart : startMin
  return { schedule, legs, routeMinutes, modesUsed, anyUnreachable, endMin }
}
