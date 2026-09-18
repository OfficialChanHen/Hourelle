'use client'

// Phase 4: the one component that runs the sync layer. Mounted once in the root
// layout, renders nothing. On load it pulls the cloud into the local cache, then
// keeps a realtime subscription open for the rest of the visit. With no backend
// configured both calls are no-ops and this component does nothing at all.

import { useEffect } from 'react'
import { EVENTS_SYNCED, forgetCloudEvents, resyncOnReturn, startRealtime, syncFromCloud } from '@/lib/remote'
import { ACCOUNT_CHANGED, currentAccount, startAuth } from '@/lib/session'
import { adoptMine } from '@/lib/events'
import { SyncNotice } from './SyncNotice'

export function BackendSync() {
  useEffect(() => {
    void syncFromCloud()
    const stopRealtime = startRealtime()
    // a device that was asleep or offline pulls again when it comes back, since the
    // socket carries nothing from while it was down
    const stopResync = resyncOnReturn()
    // one auth subscription for the visit: it fires on sign-in, sign-out, token
    // refresh, and once at startup with whatever session was restored from storage
    const stopAuth = startAuth()
    // the identity decides which events are pulled, so a change in identity pulls
    // again: signing in brings the account's events, signing out takes them away
    let lastId = currentAccount().id
    const onAccount = () => {
      const acc = currentAccount()
      if (acc.id === lastId) return
      lastId = acc.id
      if (acc.signedIn) { adoptMine(); void syncFromCloud() } // guest entries on this browser become the account's now
      else forgetCloudEvents()
    }
    // after every pull, guest entries made with the account's email become the
    // account's — how events answered before sign-up follow the person in
    const onSynced = () => { adoptMine() }
    window.addEventListener(ACCOUNT_CHANGED, onAccount)
    window.addEventListener(EVENTS_SYNCED, onSynced)
    return () => {
      stopRealtime(); stopAuth(); stopResync()
      window.removeEventListener(ACCOUNT_CHANGED, onAccount)
      window.removeEventListener(EVENTS_SYNCED, onSynced)
    }
  }, [])
  // the only thing this component ever draws: a refused write, when one happens
  return <SyncNotice />
}
