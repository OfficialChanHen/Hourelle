'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { getEvent, guestSessionId } from '@/lib/events'
import { useAccess } from '@/hooks/useAccess'

/* ── the walls ──
   Two kinds of visitor are kept to their own rooms, and a door that is not theirs
   sends them on rather than showing a wall.
   A guest (joined by invite, no account) has the plans this browser joined, any
   invite they are sent, the demos, and the pages the header and footer link to
   (About, Pricing, Help, Privacy, Terms). Anything else, typed in or bookmarked,
   goes to sign-up: that is the way to the rest.
   A visitor with no session at all has the same public pages and invites, and is
   sent to the landing page from anywhere else; it says what an account is for and
   has both doors on it. */
export function AccessBoundary({ children }: { children: React.ReactNode }) {
  const { ready, signedIn, guestEventId } = useAccess()
  const pathname = usePathname()
  const router = useRouter()

  // rooms anyone may enter: the demos, an invite, and pages that hold nothing personal
  const eventId = /^\/events\/([^/]+)/.exec(pathname)?.[1]
  const isJoin = /^\/events\/[^/]+\/join/.test(pathname)
  const isDemo = !!eventId && !!getEvent(eventId)?.demo
  const publicRoom = pathname === '/demos' || pathname === '/help' || pathname === '/about' || pathname === '/pricing' || pathname === '/privacy' || pathname === '/terms' || isJoin || isDemo
  // a guest's own plans: the one they are in now, and any other this browser joined
  const guestRoom = !!eventId && (eventId === guestEventId || !!guestSessionId(eventId))

  const allowed = signedIn || publicRoom || (!!guestEventId && guestRoom)

  useEffect(() => {
    if (!ready || allowed) return
    router.replace(guestEventId ? '/auth/signin?mode=up' : '/')
  }, [ready, allowed, guestEventId, router])

  if (allowed) return <>{children}</>

  // the server render cannot know who this is, and a door that is not theirs is
  // about to send them on: a quiet skeleton either way, never the page itself
  return (
    <div className="mx-auto max-w-[1240px] px-[26px] pt-[34px]">
      <div className="h-9 w-56 animate-pulse rounded-lg bg-s2" />
      <div className="mt-3 h-4 w-80 animate-pulse rounded bg-s2" />
      <div className="mt-8 grid grid-cols-1 gap-[13px] sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => <div key={i} className="h-40 animate-pulse rounded-2xl bg-s2" />)}
      </div>
    </div>
  )
}
