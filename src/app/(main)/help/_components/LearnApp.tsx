'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Compass, Lightbulb } from 'lucide-react'
import { useFromEvent } from '@/components/EventBack'
import { useAccount } from '@/hooks/useAccount'
import { getEvent, viewOf } from '@/lib/events'
import { resetPracticeEvent } from '@/lib/practice'
import { resetHint, resetHints, setTourWanted } from '@/lib/prefs'

/* ── learning the app, for everyone who can use it ──
   The tour and the hints lived in Settings, which is an account's page, so a guest
   who skipped the tour, or wanted it again, had no way back to it. Help is open to
   anyone, so they live here.

   Which tour depends on who is asking and where from:

     came from an event they were invited to  the tour of that event. A guest has no
       account and hosts nothing, so this is the only tour a guest can take, and its
       stops are a guest's: marking times, the ballot, the chat. Anything they try is
       real, which is fine: it is their event and their answer.
     signed in  a practice event of their own, made fresh, with the host's stops.
       A host is never toured round a real event of theirs, where "try it" would mean
       locking in a real plan in front of real guests.

   An invitee with an account who came from an event gets both. A visitor with
   neither has nothing a tour could run on, so the row is left out; the clips above
   are theirs. The hints are per device and anyone can bring them back. */
const btn = 'flex h-11 flex-none items-center gap-1.5 rounded-[9px] border border-border2 bg-s1 px-3 text-[13px] font-semibold text-dim hover:bg-s2 hover:text-text sm:h-9'

function Learn() {
  const router = useRouter()
  const account = useAccount()
  const { id: fromId } = useFromEvent()
  // the event they came from, and whether it is one they host (hosts get the practice
  // event instead). Read after mount: the event is on this device, not the server.
  const [invited, setInvited] = useState<{ id: string; title: string } | null>(null)
  useEffect(() => {
    const raw = fromId ? getEvent(fromId) : null
    const ev = raw ? viewOf(raw) : null
    setInvited(ev && !ev.demo && !ev.hostedByYou && ev.participants.some((p) => p.you) ? { id: ev.id, title: ev.title } : null)
  }, [fromId])
  const [hintsBack, setHintsBack] = useState(false)

  // read `invited` inside the call, not asserted outside it: the React Compiler
  // memoises this on what it reads, and a bare `invited!.id` is read on every render
  const tourHere = () => { if (!invited) return; resetHint('tour'); setTourWanted(true); router.push(`/events/${invited.id}`) }
  const tourPractice = () => { resetHint('tour'); setTourWanted(true); router.push(`/events/${resetPracticeEvent()}`) }
  const canPractice = account.signedIn

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-s1">
      {(invited || canPractice) && (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5 px-5 py-4">
          <div className="min-w-0">
            <div className="text-[14px] font-medium">The tour</div>
            <div className="mt-0.5 text-[12.5px] text-dim">
              {invited
                ? <>A minute round <span className="font-semibold text-text">{invited.title}</span>, trying each thing as you go.</>
                : 'A few minutes on a practice event of your own, made fresh each time.'}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {invited && <button type="button" onClick={tourHere} className={btn}><Compass size={14} /> Tour this event</button>}
            {canPractice && <button type="button" onClick={tourPractice} className={btn}><Compass size={14} /> {invited ? 'Practice event' : 'Take the tour'}</button>}
          </div>
        </div>
      )}
      <div className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5 px-5 py-4 ${invited || canPractice ? 'border-t border-border' : ''}`}>
        <div className="min-w-0">
          <div className="text-[14px] font-medium">Hints</div>
          <div className="mt-0.5 text-[12.5px] text-dim">{hintsBack ? 'They will show again.' : 'The one-line notes on the grid, the map and the lock-in.'}</div>
        </div>
        <button type="button" onClick={() => { resetHints(); setHintsBack(true) }} className={btn}>
          <Lightbulb size={14} /> Show them again
        </button>
      </div>
    </div>
  )
}

export function LearnApp() {
  return <Suspense fallback={null}><Learn /></Suspense>
}
