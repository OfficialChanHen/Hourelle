'use client'

import { useEffect, useState } from 'react'
import { Compass, X } from 'lucide-react'
import { answerTourAsk, startTour, tourAskPending } from '@/lib/prefs'
import { AUTH_SETTLED, authSettled, currentAccount } from '@/lib/session'

/* The one question a guest gets, the moment they arrive at a plan new to them:
   want a quick tour? "Show me around" starts the tour on this very plan; "No
   thanks" or the close button put it away. It is asked per arrival, not per device,
   so a second guest on a shared browser is asked too, and someone returning to their
   own entry is not (see askAboutTour).

   A small note in the page, not a modal: a guest's first job is marking their times,
   and nothing may stand between them and the grid. It sits above the tabs, so it
   covers nothing and the grid stays right there.

   It is the guest's offer only. An account was asked the same thing on the welcome
   steps, so a signed-in person is never asked twice, and the question waits for auth
   to answer before believing nobody is signed in. */
export function AskTour({ eventId }: { eventId: string }) {
  const [open, setOpen] = useState(false)

  // read after mount, so the server render and the first paint agree
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null
    const check = () => {
      if (t || !authSettled()) return
      t = setTimeout(() => {
        if (tourAskPending(eventId) && !currentAccount().signedIn && window.innerWidth >= 360) setOpen(true)
      }, 300)
    }
    check()
    window.addEventListener(AUTH_SETTLED, check)
    return () => { if (t) clearTimeout(t); window.removeEventListener(AUTH_SETTLED, check) }
  }, [eventId])

  if (!open) return null
  const choose = (tour: boolean) => {
    answerTourAsk()
    setOpen(false)
    if (tour) startTour()
  }
  return (
    <section aria-label="First time here?" className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border bg-s1 py-2 pl-3 pr-1.5">
      <Compass size={17} className="flex-none text-accent-text" aria-hidden />
      <p className="min-w-0 flex-1 text-[13.5px] text-dim">First time here? A one-minute tour shows you around.</p>
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => choose(true)} className="flex h-11 items-center rounded-full px-3.5 text-[13.5px] font-semibold text-accent-text hover:bg-s2 sm:h-9">
          Show me around
        </button>
        <button type="button" onClick={() => choose(false)} aria-label="No thanks" title="No thanks" className="grid h-11 w-11 place-items-center rounded-full text-dim hover:bg-s2 sm:h-9 sm:w-9">
          <X size={16} aria-hidden />
        </button>
      </div>
    </section>
  )
}
