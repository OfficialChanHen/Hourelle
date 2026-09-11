// Travel-time estimates between two stops. Driving is the only mode offered today:
// its minutes come from OSRM's free road router (see lib/geo.ts), whose public
// server only routes cars, and the model below only fills in when the router is
// unavailable. The other modes stay in the model, gated to the ranges where they
// make sense, for the day a walking/transit router is added — OFFERED is the switch.

export type TravelMode = 'walk' | 'bus' | 'drive' | 'train' | 'flight'
export type ModeEstimate = { mode: TravelMode; minutes: number }

// speed km/h · overhead min (parking, waits, security) · min/max km the mode makes sense
const MODEL: { mode: TravelMode; speed: number; overhead: number; min?: number; max?: number }[] = [
  { mode: 'walk', speed: 4.8, overhead: 0, max: 8 },
  { mode: 'bus', speed: 22, overhead: 8, min: 0.6 },
  { mode: 'drive', speed: 38, overhead: 3 }, // always available — the fallback mode
  { mode: 'train', speed: 65, overhead: 14, min: 4 },
  { mode: 'flight', speed: 700, overhead: 150, min: 250 },
]

export const MODE_LABEL: Record<TravelMode, string> = {
  walk: 'Walk', bus: 'Bus', drive: 'Drive', train: 'Train', flight: 'Flight',
}

// the modes the app offers right now (see the note at the top)
const OFFERED: TravelMode[] = ['drive']
export const ALL_MODES: TravelMode[] = MODEL.map((m) => m.mode).filter((m) => OFFERED.includes(m))

// `allowed` limits which modes may be used (e.g. no flights, transit only). Omit for all.
export function estimateModes(distanceKm: number, allowed?: TravelMode[]): ModeEstimate[] {
  return MODEL
    .filter((m) => !allowed || allowed.includes(m.mode))
    .filter((m) => (m.min === undefined || distanceKm >= m.min) && (m.max === undefined || distanceKm <= m.max))
    .map((m) => ({ mode: m.mode, minutes: Math.max(1, Math.round(m.overhead + (distanceKm / m.speed) * 60)) }))
    .sort((a, b) => a.minutes - b.minutes)
}

export function fastestMode(estimates: ModeEstimate[]): ModeEstimate | null {
  return estimates.reduce<ModeEstimate | null>((best, e) => (!best || e.minutes < best.minutes ? e : best), null)
}

export function fmtDuration(min: number): string {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60), m = min % 60
  return m ? `${h}h ${m}m` : `${h}h`
}
