'use client'

// Step 7: the last mile of realtime.
// The sync layer already rewrites the local cache when someone else's change
// arrives over the websocket, and announces it with EVENTS_SYNCED — but until now
// nothing listened, so the new data only appeared on the next navigation. This hook
// is the listener: give it a re-read and open screens follow the cloud live.
//
// The callback is held in a ref so callers can pass an inline arrow function without
// re-subscribing on every render.

import { useEffect, useRef } from 'react'
import { EVENTS_SYNCED } from '@/lib/remote'

export function useLiveEvents(onChange: () => void) {
  const latest = useRef(onChange)
  latest.current = onChange

  useEffect(() => {
    const handler = () => latest.current()
    window.addEventListener(EVENTS_SYNCED, handler)
    return () => window.removeEventListener(EVENTS_SYNCED, handler)
  }, [])
}
