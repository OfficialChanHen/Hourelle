'use client'

// Phase 4: the one component that runs the sync layer. Mounted once in the root
// layout, renders nothing. On load it pulls the cloud into the local cache, then
// keeps a realtime subscription open for the rest of the visit. With no backend
// configured both calls are no-ops and this component does nothing at all.

import { useEffect } from 'react'
import { startRealtime, syncFromCloud } from '@/lib/remote'

export function BackendSync() {
  useEffect(() => {
    void syncFromCloud()
    return startRealtime()
  }, [])
  return null
}
