'use client'

// Phase 4: the one component that runs the sync layer. Mounted once in the root
// layout, renders nothing. On load it pulls the cloud into the local cache, then
// keeps a realtime subscription open for the rest of the visit. With no backend
// configured both calls are no-ops and this component does nothing at all.

import { useEffect } from 'react'
import { startRealtime, syncFromCloud } from '@/lib/remote'
import { startAuth } from '@/lib/session'

export function BackendSync() {
  useEffect(() => {
    void syncFromCloud()
    const stopRealtime = startRealtime()
    // one auth subscription for the visit: it fires on sign-in, sign-out, token
    // refresh, and once at startup with whatever session was restored from storage
    const stopAuth = startAuth()
    return () => { stopRealtime(); stopAuth() }
  }, [])
  return null
}
