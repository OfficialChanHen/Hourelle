'use client'

import { useSyncExternalStore } from 'react'

/* Is the screen wide (1024px and up)? The rule it serves: hand-laid things (photo
   frames, sticky notes, sticker faces) tilt on a wide screen and lie straight on a
   phone, where they stack one under another. The layout around them stays loose
   either way. Server render and first paint read as a phone, so nothing tilts
   before the screen is known. */
const WIDE = '(min-width: 1024px)'
function subscribe(fn: () => void) {
  const mq = window.matchMedia(WIDE)
  mq.addEventListener('change', fn)
  return () => mq.removeEventListener('change', fn)
}
export function useWide(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(WIDE).matches, () => false)
}
