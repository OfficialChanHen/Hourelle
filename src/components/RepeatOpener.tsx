'use client'

import { useEffect } from 'react'
import { backendOn } from '@/lib/db'
import { cloudSynced, EVENTS_SYNCED, syncFromCloud } from '@/lib/remote'
import { isDue, openDueRepeatsHere } from '@/lib/repeat'
import { listEvents } from '@/lib/events'
import { pushFlash } from '@/components/ui/FlashToast'

// asked once per page load per plan, so a server that said no is not asked again
const asked = new Set<string>()

/* Repeating plans (lib/repeat.ts): once one is over, its next copy opens. With a
   backend the server makes it, daily on its own; this asks it about the plans in view
   so it happens the next time anyone on the plan opens the app, then pulls the copy
   in. With no backend there is no server, so this browser makes the copy itself.
   Draws nothing. */
export function RepeatOpener() {
  useEffect(() => {
    const say = (titles: string[]) => {
      if (titles.length === 1) pushFlash(`The next ${titles[0]} is open.`)
      else if (titles.length > 1) pushFlash(`${titles.length} repeating plans are open again.`)
    }
    const run = () => {
      if (!backendOn) { say(openDueRepeatsHere().map((e) => e.title)); return }
      if (!cloudSynced()) return
      const ids = listEvents().filter((e) => isDue(e) && !asked.has(e.id)).map((e) => e.id)
      if (!ids.length) return
      ids.forEach((id) => asked.add(id))
      void fetch('/api/repeats', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ids }) })
        .then((r) => (r.ok ? r.json() : { opened: [] }))
        .then(async (r: { opened?: { title: string }[] }) => {
          if (!r.opened?.length) return
          await syncFromCloud()
          say(r.opened.map((o) => o.title))
        })
        .catch(() => {})
    }
    run()
    window.addEventListener(EVENTS_SYNCED, run)
    return () => window.removeEventListener(EVENTS_SYNCED, run)
  }, [])
  return null
}
