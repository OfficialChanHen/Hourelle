'use client'

// Draws nothing; remembers which list page you were last on so an event's back link
// can name where it goes (see lib/nav). Mounted once in the main layout.

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { noteListPage } from '@/lib/nav'

export function RouteTrail() {
  const pathname = usePathname()
  useEffect(() => { noteListPage(pathname) }, [pathname])
  return null
}
