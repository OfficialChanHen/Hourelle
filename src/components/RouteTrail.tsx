'use client'

// Draws nothing; remembers which list page you were last on so an event's back link
// can name where it goes, and forgets a visitor's invite once they wander off it
// (see lib/nav). Mounted once in the root layout, so it sees every page.

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { keepInviteOn, noteListPage } from '@/lib/nav'

export function RouteTrail() {
  const pathname = usePathname()
  useEffect(() => { noteListPage(pathname); keepInviteOn(pathname) }, [pathname])
  return null
}
