'use client'

import { useSyncExternalStore } from 'react'
import { daysUntil, listEvents, phaseOf } from '@/lib/events'

// nothing pushes updates — the value recomputes whenever the nav re-renders
// (route changes), which is exactly as fresh as it needs to be
const subscribe = () => () => {}
const onServer = () => false

// true when something needs attention this week: a confirmed event coming up,
// or a voting deadline about to close — drives the little dot on the Alerts bell
export function useReminderDot(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => listEvents().some((e) => {
      const phase = phaseOf(e)
      if (e.confirmed && ['today', 'soon'].includes(phase)) return true
      if (phase === 'planning' && e.voteDeadline) {
        const du = daysUntil(e.voteDeadline)
        return du !== null && du >= 0 && du <= 7
      }
      return false
    }),
    onServer,
  )
}
