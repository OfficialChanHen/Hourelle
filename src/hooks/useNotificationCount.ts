'use client'

import { useSyncExternalStore } from 'react'
import { NOTIFICATIONS_CHANGED, unseenNotificationCount } from '@/lib/notifications'

// re-reads on route changes (the nav re-renders) and the moment the notifications
// page marks everything seen (it dispatches NOTIFICATIONS_CHANGED)
const subscribe = (onChange: () => void) => {
  window.addEventListener(NOTIFICATIONS_CHANGED, onChange)
  return () => window.removeEventListener(NOTIFICATIONS_CHANGED, onChange)
}
const onServer = () => 0

// how many notifications you haven't looked at — drives the number on the bell
export function useNotificationCount(): number {
  return useSyncExternalStore(subscribe, unseenNotificationCount, onServer)
}
