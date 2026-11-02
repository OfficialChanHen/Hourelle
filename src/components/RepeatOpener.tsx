'use client'

import { useEffect } from 'react'
import { useAccount } from '@/hooks/useAccount'
import { backendOn } from '@/lib/db'
import { cloudSynced, EVENTS_SYNCED } from '@/lib/remote'
import { openDueRepeats } from '@/lib/repeat'
import { copyCoverInto } from '@/lib/covers'
import { canEmail, sendInvites } from '@/lib/mail'
import { patchEvent } from '@/lib/events'
import { pushFlash } from '@/components/ui/FlashToast'

/* Opens the next plan for each repeating plan of yours that is over (lib/repeat.ts).
   It waits for the first pull from the cloud, so a plan another device already
   repeated is known before this one decides; then the new plan gets its own copy of
   the cover and its email invites, the way the create wizard does it. Draws nothing. */
export function RepeatOpener() {
  const account = useAccount()
  const ready = account.signedIn || !backendOn
  useEffect(() => {
    if (!ready) return
    const run = () => {
      if (!cloudSynced()) return
      const made = openDueRepeats()
      for (const ev of made) {
        if (ev.image) void copyCoverInto(ev.id, ev.image).then((url) => { if (url) patchEvent(ev.id, { image: url }) })
        if (canEmail(account.signedIn) && ev.participants.some((p) => p.guest && p.email)) void sendInvites(ev.id)
      }
      if (made.length === 1) pushFlash(`The next ${made[0].title} is open.`)
      else if (made.length > 1) pushFlash(`The next ${made.length} repeating plans are open.`)
    }
    run()
    window.addEventListener(EVENTS_SYNCED, run)
    return () => window.removeEventListener(EVENTS_SYNCED, run)
  }, [ready, account.signedIn])
  return null
}
