'use client'

import { useSyncExternalStore } from 'react'

/* The window's width, kept current on resize. Server render reads as a phone. */
function subscribe(fn: () => void) {
  window.addEventListener('resize', fn)
  return () => window.removeEventListener('resize', fn)
}
export function useViewportWidth(): number {
  return useSyncExternalStore(subscribe, () => window.innerWidth, () => 390)
}
