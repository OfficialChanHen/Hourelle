'use client'

import { usePathname } from 'next/navigation'
import { BackLink } from '@/components/ui/BackLink'
import { useAccess } from '@/hooks/useAccess'
import { menuOrigin, placeName } from '@/lib/nav'
import { getEvent } from '@/lib/events'
import { APP_NAME } from '@/lib/brand'

/* ── the way back to where the account menu was opened ──
   Profile, Settings, Help and About are a click from the avatar menu on any page,
   so their back link leads to that page (a plan keeps its tab) rather than to
   Profile. Only an account has the menu: a guest reaches Help and About from the
   footer, which carries its own way back to their plan (EventBack), so the trail is
   never read for anyone else. Read once mounted, since it lives in sessionStorage. */
export function useMenuBack(): { href: string; label: string } | null {
  const pathname = usePathname()
  const { ready, signedIn } = useAccess()
  // `ready` is false on the server and the first paint, so reading here never mismatches
  const from = ready && signedIn ? menuOrigin(pathname) : null
  if (!from) return null
  const plan = /^\/events\/([^/?#]+)/.exec(from)?.[1]
  return { href: from, label: placeName(from, { about: `About ${APP_NAME}`, plan: plan ? getEvent(plan)?.title : null }) }
}

/** The back link on an account page: to where the menu was opened, else `fallback`. */
export function AccountBack({ fallback }: { fallback?: { href: string; label: string } }) {
  const back = useMenuBack() ?? fallback
  return back ? <BackLink href={back.href} label={back.label} /> : null
}
