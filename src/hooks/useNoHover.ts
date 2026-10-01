'use client'

import { useSyncExternalStore } from 'react'

/* A screen with no hover: a phone or a tablet, where a finger is the pointer. Read
   on the client only; the server and the first client render say false, so the
   markup always hydrates the same and a touch screen catches up right after. */
const QUERY = '(hover: none), (pointer: coarse)'

function subscribe(fn: () => void) {
  const mq = window.matchMedia(QUERY)
  mq.addEventListener('change', fn)
  return () => mq.removeEventListener('change', fn)
}

export function useNoHover(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => false)
}
