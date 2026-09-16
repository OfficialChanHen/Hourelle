/* ── the map's three outside services, each behind one small function ──
   Search: Photon (komoot's OSM autocomplete, no key), Nominatim as the fallback.
   Routing: OSRM's public server (driving only, no key), for real road minutes and
   the line the route actually follows. Tiles: OpenStreetMap by default, or any
   provider's URL template from NEXT_PUBLIC_MAP_TILE_URL once traffic warrants a key.
   Everything here is browser-only; nothing is called during a server render. */

import type { EventPlace } from './events'

export type LatLng = { lat: number; lng: number }

/* ── tiles ── */
export const TILE_URL = process.env.NEXT_PUBLIC_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
export const TILE_ATTRIBUTION = process.env.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION
  || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

/* ── geometry ── */
// straight-line distance in km; the honest floor under every travel estimate
export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng)
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)))
}

export function coordsOf(p: Pick<EventPlace, 'lat' | 'lng'> | undefined | null): LatLng | null {
  return p && typeof p.lat === 'number' && typeof p.lng === 'number' && Number.isFinite(p.lat) && Number.isFinite(p.lng)
    ? { lat: p.lat, lng: p.lng }
    : null
}

/* ── place search ── */
type PhotonFeature = {
  geometry: { coordinates: [number, number] }
  properties: { osm_type?: string; osm_id?: number; name?: string; housenumber?: string; street?: string; district?: string; city?: string; county?: string; state?: string; country?: string; osm_value?: string }
}
type NominatimHit = {
  place_id: number; name?: string; display_name: string; lat: string; lon: string; osm_type?: string; osm_id?: number
  address?: { house_number?: string; road?: string; neighbourhood?: string; suburb?: string; city?: string; town?: string; village?: string; state?: string; country?: string }
}

// a rough centre of the places an event already has: search results near it come first
export function centroidOf(places: Pick<EventPlace, 'lat' | 'lng'>[]): LatLng | undefined {
  const pts = places.map(coordsOf).filter((c): c is LatLng => !!c)
  if (pts.length === 0) return undefined
  return { lat: pts.reduce((a, c) => a + c.lat, 0) / pts.length, lng: pts.reduce((a, c) => a + c.lng, 0) / pts.length }
}

// the second line under a result: the most local three parts that exist. A result
// named by its street already says the street, so the line starts at the district.
function localityOf(p: PhotonFeature['properties'], namedByStreet: boolean): string {
  const street = namedByStreet ? '' : [p.housenumber, p.street].filter(Boolean).join(' ')
  const parts = [street, p.district, p.city ?? p.county, p.state, p.country].filter((x): x is string => !!x)
  return parts.slice(0, 3).join(', ')
}

async function photonSearch(term: string, signal: AbortSignal, near?: LatLng): Promise<EventPlace[]> {
  // the bias is what makes a house number resolve to the street round the corner
  // rather than a famous one elsewhere
  const bias = near ? `&lat=${near.lat.toFixed(5)}&lon=${near.lng.toFixed(5)}&location_bias_scale=0.4` : ''
  const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(term)}&limit=10&lang=en${bias}`, { signal, headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`photon ${res.status}`)
  const data = (await res.json()) as { features?: PhotonFeature[] }
  const seen = new Set<string>()
  const out: EventPlace[] = []
  for (const f of data.features ?? []) {
    const p = f.properties
    const [lng, lat] = f.geometry.coordinates
    const streetName = [p.housenumber, p.street].filter(Boolean).join(' ')
    const name = p.name?.trim() || streetName || p.city || p.state
    if (!name) continue
    // Photon and Nominatim describe the same OSM object; one id shape for both so a
    // place found either way dedupes on the ballot
    const id = p.osm_type && p.osm_id ? `osm:${p.osm_type[0].toUpperCase()}${p.osm_id}` : `pt:${lat.toFixed(5)},${lng.toFixed(5)}`
    const place = localityOf(p, !p.name?.trim() && !!streetName) || 'Unknown area'
    // the same park often comes back as both its outline and its point: one entry
    const dupe = `${name}|${place}`.toLowerCase()
    if (seen.has(id) || seen.has(dupe)) continue
    seen.add(id); seen.add(dupe)
    out.push({ id, name, place, lat, lng })
  }
  return out
}

async function nominatimSearch(term: string, signal: AbortSignal, near?: LatLng): Promise<EventPlace[]> {
  // a ~50 km box around the event is a preference, not a fence (bounded=0)
  const d = 0.25
  const box = near ? `&viewbox=${(near.lng - d).toFixed(4)},${(near.lat + d).toFixed(4)},${(near.lng + d).toFixed(4)},${(near.lat - d).toFixed(4)}&bounded=0` : ''
  const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&addressdetails=1${box}&q=${encodeURIComponent(term)}`, { signal, headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`nominatim ${res.status}`)
  const data = (await res.json()) as NominatimHit[]
  return data.map((d) => {
    const parts = d.display_name.split(', ')
    const id = d.osm_type && d.osm_id ? `osm:${d.osm_type[0].toUpperCase()}${d.osm_id}` : String(d.place_id)
    const a = d.address
    // an address answer names itself by number and street ("2450 Mission Street"),
    // then the neighbourhood and city; a named place keeps its name
    // one building can carry a run of numbers ("2448;2450"): show the run
    const street = a?.house_number && a?.road ? `${a.house_number.split(';').join('–')} ${a.road}` : ''
    const name = d.name && d.name.trim() ? d.name : street || parts[0]
    const locality = [a?.neighbourhood ?? a?.suburb, a?.city ?? a?.town ?? a?.village, a?.state].filter((x): x is string => !!x)
    return {
      id, name,
      place: (locality.length ? locality : (d.name ? parts : parts.slice(1))).slice(0, 3).join(', '),
      lat: parseFloat(d.lat), lng: parseFloat(d.lon),
    }
  })
}

const isAbort = (e: unknown) => (e as Error)?.name === 'AbortError'

/** Search-as-you-type for places, biased towards `near` (the event's own places).
 *  Photon answers every query; a query with a house number also asks Nominatim, the
 *  more exact address geocoder, and its answers lead. Rejects only on abort. */
export async function searchPlaces(term: string, signal: AbortSignal, near?: LatLng): Promise<EventPlace[]> {
  const addressy = /\d/.test(term)
  const [ph, nm] = await Promise.allSettled([
    photonSearch(term, signal, near),
    addressy ? nominatimSearch(term, signal, near) : Promise.resolve<EventPlace[]>([]),
  ])
  if (signal.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' })
  const photon = ph.status === 'fulfilled' ? ph.value : []
  let nominatim = nm.status === 'fulfilled' ? nm.value : []
  // Photon down: Nominatim is the fallback for every query, not only addresses
  if (ph.status === 'rejected' && !isAbort(ph.reason) && !addressy) {
    try { nominatim = await nominatimSearch(term, signal, near) } catch (e) { if (isAbort(e)) throw e }
  }
  const seen = new Set<string>()
  const out: EventPlace[] = []
  for (const r of addressy ? [...nominatim, ...photon] : [...photon, ...nominatim]) {
    const dupe = `${r.name}|${r.place}`.toLowerCase()
    if (seen.has(r.id) || seen.has(dupe)) continue
    seen.add(r.id); seen.add(dupe)
    out.push(r)
  }
  return out
}

/* ── routing ── */
export type RoadLeg = { minutes: number; km: number }
export type RoadRoute = { legs: RoadLeg[]; line: LatLng[] }

// one fetch per distinct point list for the life of the page: the Location tab and the
// Attendance tab read the same answer, so their clocks agree
const routeCache = new Map<string, RoadRoute | null>()
const inflight = new Map<string, Promise<RoadRoute | null>>()
export const ROUTE_CHANGED = 'hourelle:route-changed'

export function routeKey(points: LatLng[]): string {
  return points.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join(';')
}
export function cachedRoute(points: LatLng[]): RoadRoute | null | undefined {
  return routeCache.get(routeKey(points))
}

/** Real driving legs and geometry for an ordered list of points, from OSRM's public
 *  server. Resolves null when the server can't route it (or is down); callers fall
 *  back to straight-line estimates. Cached per point list. */
export function fetchRoute(points: LatLng[]): Promise<RoadRoute | null> {
  if (points.length < 2) return Promise.resolve(null)
  const key = routeKey(points)
  const hit = routeCache.get(key)
  if (hit !== undefined) return Promise.resolve(hit)
  const pending = inflight.get(key)
  if (pending) return pending
  const coords = points.map((p) => `${p.lng},${p.lat}`).join(';')
  const p = (async () => {
    try {
      const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=false`, { headers: { Accept: 'application/json' } })
      if (!res.ok) throw new Error(`osrm ${res.status}`)
      const data = (await res.json()) as { code: string; routes?: { legs: { duration: number; distance: number }[]; geometry: { coordinates: [number, number][] } }[] }
      const r = data.code === 'Ok' ? data.routes?.[0] : undefined
      const route: RoadRoute | null = r
        ? { legs: r.legs.map((l) => ({ minutes: Math.max(1, Math.round(l.duration / 60)), km: l.distance / 1000 })), line: r.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })) }
        : null
      routeCache.set(key, route)
      return route
    } catch {
      // a failed lookup is not remembered: the next render may find the server back
      return null
    } finally {
      inflight.delete(key)
      if (typeof window !== 'undefined') window.dispatchEvent(new Event(ROUTE_CHANGED))
    }
  })()
  inflight.set(key, p)
  return p
}
