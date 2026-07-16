'use client'

import { useSyncExternalStore } from 'react'
import { listEvents, phaseOf } from '@/lib/events'

// nothing pushes updates — the value recomputes whenever the nav re-renders
// (route changes), which is exactly as fresh as it needs to be
const subscribe = () => () => {}
const onServer = () => false

// true when a confirmed event is today or within the week — drives the little
// dot on the Alerts bell
export function useReminderDot(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => listEvents().some((e) => e.confirmed && ['today', 'soon'].includes(phaseOf(e))),
    onServer,
  )
}
