'use client'

import { useRef } from 'react'
import { useSwingOnNew } from '@/hooks/useAttention'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, CalendarDays, Plus, Bell, User, LayoutGrid, LogIn } from 'lucide-react'
import { useNotificationCount } from '@/hooks/useNotificationCount'
import { useAccess } from '@/hooks/useAccess'
import { getEvent } from '@/lib/events'

// Mobile bottom navigation — Home · Events · center + (create) · Notifications · Profile.
// Fixed to the viewport bottom (the one place fixed positioning is right); pages reserve
// pb-[104px] so their content clears it. Hidden from md up, where the top Header nav takes
// over. One solid bar on every phone: the header is the chrome that comes and goes with
// the scroll, the bar stays put so the way around is always in reach.
const ITEMS = [
  { href: '/home', label: 'Home', icon: Home },
  { href: '/events', label: 'Events', icon: CalendarDays },
  { href: '/notifications', label: 'Notifications', icon: Bell },
  { href: '/profile', label: 'Profile', icon: User },
] as const

export function MobileTabBar() {
  const pathname = usePathname()
  const notifCount = useNotificationCount()
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')
  const welcome = pathname.startsWith('/welcome')
  const { ready, guestEventId, visitor } = useAccess()
  // two items, the raised create FAB, then two more
  const [left, right] = [ITEMS.slice(0, 2), ITEMS.slice(2)]

  // a visitor's bar: the demos and the door in — and nothing at all until the
  // browser knows who this is
  if (!ready || welcome) return null
  if (visitor) {
    return (
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-s0/95 backdrop-blur-md md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="Primary"
      >
        <div className="mx-auto flex h-[64px] max-w-[560px] items-stretch">
          <TabItem href="/demos" label="Demos" icon={LayoutGrid} active={pathname.startsWith('/demos') || pathname.startsWith('/events/')} />
          <TabItem href="/auth/signin" label="Log in" icon={LogIn} active={false} />
        </div>
      </nav>
    )
  }

  // a guest's bar: the event they joined, by name, and the door to an account —
  // nothing else to tab to
  if (guestEventId) {
    const title = getEvent(guestEventId)?.title ?? 'Event'
    return (
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-s0/95 backdrop-blur-md md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="Primary"
      >
        <div className="mx-auto flex h-[64px] max-w-[560px] items-stretch">
          <TabItem href={`/events/${guestEventId}`} label={title} icon={CalendarDays} active={pathname.startsWith('/events/')} />
          <TabItem href="/auth/signin" label="Log in" icon={User} active={false} />
        </div>
      </nav>
    )
  }

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-s0/95 backdrop-blur-md md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Primary"
    >
      <div className="mx-auto flex h-[64px] max-w-[560px] items-stretch">
        {left.map((t) => <TabItem key={t.href} {...t} active={isActive(t.href)} />)}

        {/* center create FAB — pokes above the bar with a bg-colored ring cutout */}
        <div className="flex flex-1 items-start justify-center">
          <Link
            href="/create"
            aria-label="Create event"
            data-tour="create"
            className="-mt-5 grid h-[54px] w-[54px] place-items-center rounded-full bg-accent text-on-accent shadow-soft ring-4 ring-bg active:scale-95"
          >
            <Plus size={26} />
          </Link>
        </div>

        {right.map((t) => <TabItem key={t.href} {...t} active={isActive(t.href)} count={t.href === '/notifications' ? notifCount : 0} />)}
      </div>
    </nav>
  )
}

function TabItem({ href, label, icon: Icon, active, count = 0, compact = false }: {
  href: string; label: string; icon: typeof Home; active: boolean; count?: number
  // the compressed bar keeps icons only — labels fold away until scrolling up regrows it
  compact?: boolean
}) {
  const iconRef = useRef<SVGSVGElement>(null)
  useSwingOnNew(iconRef, count)
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`flex flex-1 flex-col items-center justify-center text-[12px] font-semibold ${compact ? 'gap-0' : 'gap-1'} ${active ? 'text-accent-text' : 'text-faint'}`}
    >
      <span className="relative">
        {/* the icon swings when its count goes up (only the bell ever has one) */}
        <Icon ref={iconRef} size={22} strokeWidth={active ? 2.4 : 2} />
        {count > 0 && (
          <span className="absolute -right-2 -top-1.5 grid h-[15px] min-w-[15px] place-items-center rounded-full bg-accent px-1 text-[9.5px] font-bold leading-none text-on-accent ring-2 ring-s0">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </span>
      {!compact && <span className="max-w-[120px] truncate">{label}</span>}
    </Link>
  )
}
