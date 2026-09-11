'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { cachedRoute, fetchRoute, ROUTE_CHANGED, routeKey, type LatLng, type RoadRoute } from '@/lib/geo'

// the road route through an ordered list of points, from the shared cache. Missing
// answers are fetched once; every mounted reader re-renders when one lands, so the
// Location tab's clock and the Attendance tab's clock never disagree.
const subscribe = (cb: () => void) => {
  window.addEventListener(ROUTE_CHANGED, cb)
  return () => window.removeEventListener(ROUTE_CHANGED, cb)
}

export function useRoute(points: LatLng[]): RoadRoute | null {
  const key = routeKey(points)
  const route = useSyncExternalStore(subscribe, () => cachedRoute(points) ?? null, () => null)
  useEffect(() => {
    if (points.length >= 2 && cachedRoute(points) === undefined) void fetchRoute(points)
    // the key is the identity of the list; the array itself is rebuilt every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return route
}
