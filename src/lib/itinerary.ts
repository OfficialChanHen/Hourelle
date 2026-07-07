import { estimateModes, fastestMode, ALL_MODES, type TravelMode, type ModeEstimate } from './travel'
import type { EventPlace } from './events'

// deterministic pin spots on the fake map, by place index (stable regardless of ranking)
export const PIN_SLOTS = [
  { left: '27%', top: '60%' }, { left: '55%', top: '38%' }, { left: '70%', top: '72%' },
  { left: '38%', top: '22%' }, { left: '16%', top: '34%' }, { left: '82%', top: '28%' },
  { left: '48%', top: '80%' }, { left: '64%', top: '14%' },
]
// ~0.6 km per map-percent — puts a metro-area offsite in walk/drive/transit range
const KM_PER_PCT = 0.6

// where a place sits on the fake map (stable by its index in the candidate list)
export function slotFor(places: EventPlace[], id: string) {
  return PIN_SLOTS[Math.max(0, places.findIndex((p) => p.id === id)) % PIN_SLOTS.length]
}
// straight-line distance between two places, in km
export function legKm(places: EventPlace[], a: string, b: string) {
  const pa = slotFor(places, a), pb = slotFor(places, b)
  return Math.hypot(parseFloat(pa.left) - parseFloat(pb.left), parseFloat(pa.top) - parseFloat(pb.top)) * KM_PER_PCT
}

export type ItinStopInput = { placeId: string; dwell: number }
export type ScheduledStop<T extends ItinStopInput = ItinStopInput> = T & { arrive: number; depart: number }
export type ItinLeg = { est: ModeEstimate[]; fast: ModeEstimate | null; minutes: number }

/**
 * The single source of truth for itinerary timing — both the Location tab (which edits it live)
 * and the Attendance tab (which reads it back) run stops through this so their clocks agree.
 * Flows dwell + fastest-allowed travel through the day; leg minutes are 0 when no allowed mode
 * can make the hop (also surfaced via `anyUnreachable`).
 */
export function computeItinerary<T extends ItinStopInput>(
  places: EventPlace[], stops: T[], startMin: number, travelModes: TravelMode[],
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
    const est = estimateModes(legKm(places, s.placeId, stops[i + 1].placeId), modes)
    const fast = fastestMode(est)
    return { est, fast, minutes: fast?.minutes ?? 0 }
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
