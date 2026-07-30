'use client'

import { useSyncExternalStore } from 'react'
import { GUEST_MODE_CHANGED, guestModeEventId } from '@/lib/events'

// which event this browser joined as a guest, or null when it's the owner's.
// Live: joining, claiming, and leaving all announce themselves, and the storage
// event covers other tabs.
export function useGuestMode(): string | null {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener(GUEST_MODE_CHANGED, cb)
      window.addEventListener('storage', cb)
      return () => {
        window.removeEventListener(GUEST_MODE_CHANGED, cb)
        window.removeEventListener('storage', cb)
      }
    },
    guestModeEventId,
    () => null,
  )
}
