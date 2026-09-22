'use client'

/* ── the real map: Leaflet over OpenStreetMap tiles ──
   Pins are the same teardrop the drawing used, now anchored to coordinates; the
   route is the road OSRM found (or a straight dashed line while it is still loading
   or when routing is unavailable). Loaded with next/dynamic and ssr:false by whoever
   renders it, because Leaflet touches `window` at import time. */

import { useEffect, useMemo } from 'react'
import L from 'leaflet'
import { gsap } from 'gsap'
import { MapContainer, Marker, Polyline, Popup, TileLayer, ZoomControl, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { TILE_ATTRIBUTION, TILE_URL, type LatLng } from '@/lib/geo'

// `name` is what the pin is called out loud: the label in its head is a vote count
// or a stop number, which tells a screen reader nothing about where it is
export type MapPin = LatLng & { id: string; label: string; lead?: boolean; name?: string }

const PIN_W = 32, PIN_H = 42

// the map pin: a classic marker with the count sitting in its head. Colors are the
// map's own fixed palette — the tiles are light in both themes, so the pin never
// reads the page theme.
function pinIcon(label: string, lead: boolean, focused: boolean): L.DivIcon {
  const bg = lead ? '#2E4A3C' : '#5E7B69'
  const size = label.length > 2 ? 10.5 : 13
  return L.divIcon({
    className: `hourelle-pin${focused ? ' hourelle-pin-focused' : ''}`,
    iconSize: [PIN_W, PIN_H],
    iconAnchor: [PIN_W / 2, PIN_H - 1],
    popupAnchor: [0, -(PIN_H - 4)],
    // two rings round the head: the pulse GSAP runs when the pin gains focus, and
    // the steady ring the focused pin keeps (shown by CSS)
    html: `<svg width="${PIN_W}" height="${PIN_H}" viewBox="0 0 32 42" aria-hidden="true">`
      + `<circle class="hourelle-pin-pulse" cx="16" cy="15.5" r="13.5" fill="none" stroke="${bg}" stroke-width="2.5" opacity="0"/>`
      + `<circle class="hourelle-pin-ring" cx="16" cy="15.5" r="16" fill="none" stroke="${bg}" stroke-width="2" opacity="0"/>`
      + `<path d="M16 41C16 41 2.5 25 2.5 15.5A13.5 13.5 0 0 1 29.5 15.5C29.5 25 16 41 16 41Z" fill="${bg}" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>`
      + `<text x="16" y="16" text-anchor="middle" dominant-baseline="central" font-size="${size}" font-weight="700" fill="#fff">${label}</text>`
      + '</svg>',
  })
}

// the click pulse: a ring that swells out of the pin's head and fades
function pulsePin(m: L.Marker) {
  const ring = m.getElement()?.querySelector('.hourelle-pin-pulse')
  if (!ring) return
  gsap.fromTo(ring, { attr: { r: 13.5 }, opacity: 0.7 }, { attr: { r: 24 }, opacity: 0, duration: 0.75, ease: 'power2.out', overwrite: true })
}

// keep every pin (and the route) in view whenever the set of pins changes
function FitBounds({ points }: { points: LatLng[] }) {
  const map = useMap()
  const key = points.map((p) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join('|')
  useEffect(() => {
    if (points.length === 0) return
    if (points.length === 1) { map.setView([points[0].lat, points[0].lng], 14, { animate: false }); return }
    map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number])), { padding: [44, 44], maxZoom: 15, animate: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map])
  return null
}

// the map lives in a flex box that can resize (sheet opens, panel stacks); Leaflet only
// measures its container once, so watch it
function Resizer() {
  const map = useMap()
  useEffect(() => {
    const el = map.getContainer()
    const ro = new ResizeObserver(() => map.invalidateSize({ animate: false }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [map])
  return null
}

// the wheel zooms only after a click or keyboard focus on the map, and stops when
// the pointer leaves — so a page scroll that passes over the map keeps scrolling.
// Pinch-to-zoom on touch screens is Leaflet's default and stays on.
function WheelAfterClick() {
  const map = useMap()
  useEffect(() => {
    const el = map.getContainer()
    const on = () => map.scrollWheelZoom.enable()
    const off = () => map.scrollWheelZoom.disable()
    map.on('click', on)
    el.addEventListener('focus', on)
    el.addEventListener('blur', off)
    el.addEventListener('mouseleave', off)
    return () => { map.off('click', on); el.removeEventListener('focus', on); el.removeEventListener('blur', off); el.removeEventListener('mouseleave', off) }
  }, [map])
  return null
}

// open the popup of whichever pin the list focused (a tap on a venue card, the leader)
function OpenPopup({ id, markers }: { id: string | null; markers: Map<string, L.Marker> }) {
  const map = useMap()
  useEffect(() => {
    if (!id) return
    // markers join the map in their own effects, a beat after they exist, and React's
    // dev-only StrictMode remounts a new marker once more right after (which closes
    // its popup). So: work on frame boundaries, wait for the marker to be on the map,
    // and after opening confirm for a few frames that it stayed open.
    let tries = 0, opened = 0, raf = 0
    const attempt = () => {
      const m = markers.get(id) as (L.Marker & { _map?: unknown }) | undefined
      if (m && m._map) {
        if (!m.isPopupOpen()) m.openPopup()
        if (opened === 0) pulsePin(m)
        if (++opened < 4) raf = requestAnimationFrame(attempt)
        return
      }
      if (!m && tries > 3) { map.closePopup(); return }
      if (tries++ < 30) raf = requestAnimationFrame(attempt)
    }
    raf = requestAnimationFrame(attempt)
    return () => cancelAnimationFrame(raf)
  }, [id, markers, map])
  return null
}

// a request from the list beside the map: centre on this pin. The counter makes a
// repeat click on the same place pan again.
export type PanRequest = { id: string; n: number }

function PanTo({ req, markers }: { req: PanRequest | null; markers: Map<string, L.Marker> }) {
  const map = useMap()
  useEffect(() => {
    if (!req) return
    let tries = 0, raf = 0
    const attempt = () => {
      const m = markers.get(req.id) as (L.Marker & { _map?: unknown }) | undefined
      if (m && m._map) { map.panTo(m.getLatLng(), { animate: true, duration: 0.45 }); return }
      if (tries++ < 30) raf = requestAnimationFrame(attempt)
    }
    raf = requestAnimationFrame(attempt)
    return () => cancelAnimationFrame(raf)
  }, [req, markers, map])
  return null
}

export function EventMap({ pins, route, dashed = false, focusId = null, panTo = null, onFocus, renderPopup, className = '' }: {
  pins: MapPin[]
  panTo?: PanRequest | null
  // an ordered line to draw through the stops (road geometry, or the stops themselves)
  route?: LatLng[]
  dashed?: boolean
  focusId?: string | null
  onFocus?: (id: string | null) => void
  renderPopup?: (id: string) => React.ReactNode
  className?: string
}) {
  const markers = useMemo(() => new Map<string, L.Marker>(), [])
  const fitPoints = useMemo<LatLng[]>(() => (route && route.length > 1 ? [...pins, ...route] : pins), [pins, route])
  const center: [number, number] = pins.length ? [pins[0].lat, pins[0].lng] : [37.7749, -122.4194]
  return (
    <MapContainer center={center} zoom={13} scrollWheelZoom={false} className={`hourelle-map absolute inset-0 z-0 ${className}`} attributionControl zoomControl={false}>
      <ZoomControl position="bottomright" />
      <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} maxZoom={19} />
      <Resizer />
      <WheelAfterClick />
      <FitBounds points={fitPoints} />
      {route && route.length > 1 && (
        <Polyline positions={route.map((p) => [p.lat, p.lng] as [number, number])} pathOptions={{ color: '#3E6B54', weight: 4, opacity: 0.9, dashArray: dashed ? '8 8' : undefined, lineCap: 'round' }} />
      )}
      {pins.map((p) => (
        <Marker
          key={p.id}
          position={[p.lat, p.lng]}
          icon={pinIcon(p.label, !!p.lead, p.id === focusId)}
          // Leaflet gives every marker role="button" and a tab stop, and the pin's own
          // SVG is decorative, so without this the keyboard lands on a control that
          // announces nothing at all. `alt` is what Leaflet writes onto the element.
          alt={p.name ? `${p.name}${p.lead ? ', leading' : ''}` : `Place ${p.label}`}
          title={p.name ?? undefined}
          ref={(m) => { if (m) markers.set(p.id, m); else markers.delete(p.id) }}
          // a close only clears focus when it is the focused pin closing — opening
          // another pin's popup closes this one too, and that must not reset focus
          eventHandlers={{ click: () => onFocus?.(p.id), popupclose: () => { if (focusId === p.id) onFocus?.(null) } }}
          zIndexOffset={(p.lead ? 500 : 0) + (p.id === focusId ? 1000 : 0)}
        >
          {renderPopup && <Popup closeButton={false} autoPan className="hourelle-popup">{renderPopup(p.id)}</Popup>}
        </Marker>
      ))}
      <OpenPopup id={focusId} markers={markers} />
      <PanTo req={panTo} markers={markers} />
    </MapContainer>
  )
}
