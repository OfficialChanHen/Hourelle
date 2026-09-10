'use client'

// Who is looking, in the terms the chrome and the gates care about.
//   signedIn      a real account (or, with no backend, the stub — nobody can sign in,
//                 so this browser is simply the owner of its own data)
//   guestEventId  a guest session: the one event this browser joined by invite
//   visitor       neither — sees the landing page, sign-in, and the demos, nothing else
// `ready` flips after mount: the server render knows none of this, so nothing
// account-shaped is decided (or shown) until the browser has had a look.

import { useEffect, useState } from 'react'
import { backendOn } from '@/lib/db'
import { useAccount } from './useAccount'
import { useGuestMode } from './useGuestMode'

export function useAccess() {
  const account = useAccount()
  const guestEventId = useGuestMode()
  const [ready, setReady] = useState(false)
  useEffect(() => setReady(true), [])
  const signedIn = account.signedIn || !backendOn
  return { ready, account, signedIn, guestEventId, visitor: ready && !signedIn && !guestEventId }
}
