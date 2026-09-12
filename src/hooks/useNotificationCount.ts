'use client'

import { useSyncExternalStore } from 'react'
import { NOTIFICATIONS_CHANGED, unseenNotificationCount } from '@/lib/notifications'
import { EVENTS_SYNCED } from '@/lib/remote'

// re-reads on route changes (the nav re-renders), the moment the notifications page
// marks everything seen, and whenever the cloud changes an event — a plan locked in
// on someone else's device is a notification here, and the bell should say so
// without waiting for the next navigation
const subscribe = (onChange: () => void) => {
  window.addEventListener(NOTIFICATIONS_CHANGED, onChange)
  window.addEventListener(EVENTS_SYNCED, onChange)
  return () => {
    window.removeEventListener(NOTIFICATIONS_CHANGED, onChange)
    window.removeEventListener(EVENTS_SYNCED, onChange)
  }
}
const onServer = () => 0

// how many notifications you haven't looked at — drives the number on the bell
export function useNotificationCount(): number {
  return useSyncExternalStore(subscribe, unseenNotificationCount, onServer)
}
