'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, CalendarDays, Plus, Bell, User, LayoutGrid, LogIn } from 'lucide-react'
import { useNotificationCount } from '@/hooks/useNotificationCount'
import { useAccess } from '@/hooks/useAccess'
import { useIsIOS } from '@/hooks/useIsIOS'
import { useHideOnScroll } from '@/hooks/useHideOnScroll'
import { getEvent } from '@/lib/events'

// Mobile bottom navigation — Home · Events · center + (create) · Notifications · Profile.
// Fixed to the viewport bottom (the one place fixed positioning is right); pages reserve
// pb-[104px] so their content clears it. Hidden from md up, where the top Header nav takes over.
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
  const { ready, guestEventId, visitor } = useAccess()
  const ios = useIsIOS()
  // reading compresses the bar, scrolling back up regrows it (the Reddit move)
  const compressed = useHideOnScroll()
  // two items, the raised create FAB, then two more
  const [left, right] = [ITEMS.slice(0, 2), ITEMS.slice(2)]

  // a visitor's bar: the demos and the door in — and nothing at all until the
  // browser knows who this is
  if (!ready) return null
  if (visitor) {
    return (
      <nav
        className={`fixed inset-x-0 bottom-0 z-40 md:hidden ${ios ? 'liquid-glass' : 'border-t border-border bg-s0/95 backdrop-blur-md'}`}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="Primary"
      >
        <div className="mx-auto flex h-[64px] max-w-[560px] items-stretch">
          <TabItem href="/demos" label="Demos" icon={LayoutGrid} active={pathname.startsWith('/demos') || pathname.startsWith('/events/')} />
          <TabItem href="/auth/signin" label="Sign in" icon={LogIn} active={false} />
        </div>
      </nav>
    )
  }

  // iOS wears the native look: frosted glass, one flat row (create sits inline,
  // nothing pokes above the bar), shrinking as you scroll down and growing back up
  if (ios) {
    const guestTitle = guestEventId ? getEvent(guestEventId)?.title ?? 'Event' : null
    const items = guestEventId
      ? [
          { href: `/events/${guestEventId}`, label: guestTitle!, icon: CalendarDays, active: pathname.startsWith('/events/'), count: 0 },
          { href: '/auth/signin', label: 'Sign in', icon: User, active: false, count: 0 },
        ]
      : [
          { href: '/home', label: 'Home', icon: Home, active: isActive('/home'), count: 0 },
          { href: '/events', label: 'Events', icon: CalendarDays, active: isActive('/events'), count: 0 },
          { href: '/create', label: 'Create', icon: Plus, active: isActive('/create'), count: 0 },
          { href: '/notifications', label: 'Alerts', icon: Bell, active: isActive('/notifications'), count: notifCount },
          { href: '/profile', label: 'Profile', icon: User, active: isActive('/profile'), count: 0 },
        ]
    return (
      <nav
        className="liquid-glass fixed inset-x-0 bottom-0 z-40 md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="Primary"
      >
        <div
          className="mx-auto flex max-w-[560px] items-stretch overflow-hidden transition-all duration-300"
          style={{ height: compressed ? 44 : 64 }}
        >
          {items.map((t) => (
            <TabItem key={t.href} href={t.href} label={t.label} icon={t.icon} active={t.active} count={t.count} compact={compressed} />
          ))}
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
          <TabItem href="/auth/signin" label="Sign in" icon={User} active={false} />
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
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`flex flex-1 flex-col items-center justify-center text-[12px] font-semibold ${compact ? 'gap-0' : 'gap-1'} ${active ? 'text-accent-text' : 'text-faint'}`}
    >
      <span className="relative">
        <Icon size={22} strokeWidth={active ? 2.4 : 2} />
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
