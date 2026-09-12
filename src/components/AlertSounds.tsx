'use client'

/* Draws nothing; listens for the two things worth a sound.
   Mounted once in the root layout, so a message or a notification is heard on any
   page — and heard once, however many bells and tab bars are on screen.

   Nothing sounds on the first pass: the baseline is whatever was already there when
   the page opened, so arriving at a busy event is silent and only what happens next
   is announced. */

import { useEffect, useRef } from 'react'
import { EVENTS_SYNCED } from '@/lib/remote'
import { NOTIFICATIONS_CHANGED, unseenNotificationCount } from '@/lib/notifications'
import { guestSessionId, listEvents } from '@/lib/events'
import { currentAccount } from '@/lib/session'
import { playMessage, playNotification, primeSound, watchingChat } from '@/lib/sound'

export function AlertSounds() {
  const seenAt = useRef<number | null>(null)   // newest message this browser knows of
  const seenCount = useRef<number | null>(null) // unseen notifications at the last look

  useEffect(() => {
    primeSound()

    function check() {
      const events = listEvents()
      const me = currentAccount().id

      // ── a message from someone else ──
      let newest = 0
      let heard = false
      for (const e of events) {
        const asGuest = guestSessionId(e.id)
        for (const m of e.messages) {
          const at = m.at ?? 0
          if (at > newest) newest = at
          if (seenAt.current === null || at <= seenAt.current) continue
          if (m.system) continue            // "Sam joined" is the room, not a person
          if (m.you || m.id === me || m.id === asGuest) continue // your own line
          if (watchingChat() === e.id) continue // you are looking straight at it
          heard = true
        }
      }
      const first = seenAt.current === null
      seenAt.current = Math.max(newest, seenAt.current ?? 0)
      if (heard) playMessage()

      // ── a notification that was not there before ──
      const count = unseenNotificationCount()
      if (!first && seenCount.current !== null && count > seenCount.current) playNotification()
      seenCount.current = count
    }

    check() // take the baseline
    window.addEventListener(EVENTS_SYNCED, check)
    window.addEventListener(NOTIFICATIONS_CHANGED, check)
    return () => {
      window.removeEventListener(EVENTS_SYNCED, check)
      window.removeEventListener(NOTIFICATIONS_CHANGED, check)
    }
  }, [])

  return null
}
