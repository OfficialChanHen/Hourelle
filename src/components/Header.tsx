'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarDays, Plus, Bell, UserRound, LogOut } from 'lucide-react'
import { ThemeToggle } from './ThemeToggle'
import { Popover } from './ui/Popover'
import { useNotificationCount } from '@/hooks/useNotificationCount'
import { useGuestMode } from '@/hooks/useGuestMode'
import { getEvent, YOU } from '@/lib/events'

const TABS = [
  { href: '/home', label: 'Home' },
  { href: '/events', label: 'Events' },
  { href: '/templates', label: 'Templates' },
  { href: '/demos', label: 'Demos' },
]

export function Header() {
  const pathname = usePathname()
  const notifCount = useNotificationCount()
  const guestEventId = useGuestMode()

  // a guest's header: their event by name, the theme (profile is gated), and the
  // one action the rest of the app is asking for
  if (guestEventId) {
    const title = getEvent(guestEventId)?.title ?? 'Back to the event'
    return (
      <header className="sticky top-0 z-40 border-b border-border bg-s0/90 backdrop-blur-md">
        <div className="mx-auto flex h-[54px] max-w-[1240px] items-center gap-3 px-[22px]">
          <Link href={`/events/${guestEventId}`} className="flex items-center gap-[9px]">
            <span className="grid h-[26px] w-[26px] place-items-center rounded-[7px] bg-accent text-on-accent">
              <CalendarDays size={17} />
            </span>
            <span className="font-serif text-[24.5px] leading-none tracking-[.01em]">Aline</span>
          </Link>
          <div className="flex-1" />
          <ThemeToggle />
          <Link
            href={`/events/${guestEventId}`}
            className="hidden h-[34px] max-w-[220px] items-center rounded-[9px] border border-border2 bg-s1 px-3.5 text-[13.5px] font-semibold text-dim hover:bg-s2 hover:text-text sm:flex"
          >
            <span className="truncate">{title}</span>
          </Link>
          <Link href="/auth/signin" className="flex h-[34px] items-center rounded-[9px] bg-accent px-[14px] text-[14px] font-semibold text-on-accent">
            Sign in
          </Link>
        </div>
      </header>
    )
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-s0/90 backdrop-blur-md">
      <div className="mx-auto flex h-[54px] max-w-[1240px] items-center gap-[22px] px-[22px]">
        {/* logo — icon box + serif wordmark */}
        <Link href="/home" className="flex items-center gap-[9px]">
          <span className="grid h-[26px] w-[26px] place-items-center rounded-[7px] bg-accent text-on-accent">
            <CalendarDays size={17} />
          </span>
          <span className="font-serif text-[24.5px] leading-none tracking-[.01em]">Aline</span>
        </Link>

        {/* nav — filled accent box when active, no underlines */}
        <nav className="hidden items-center gap-[3px] text-[14px] md:flex">
          {TABS.map((t) => {
            const active = pathname === t.href || pathname.startsWith(t.href + '/')
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`rounded-[9px] px-[13px] py-2 transition-colors ${
                  active ? 'bg-accent font-medium text-on-accent' : 'font-medium text-dim hover:bg-s3 hover:text-text'
                }`}
              >
                {t.label}
              </Link>
            )
          })}
        </nav>

        <div className="flex-1" />

        {/* actions duplicate the mobile bottom tab bar, so on mobile the header is just the logo.
            Always the full form, home included — someone scrolled deep into their list wants a
            new event, not a smooth ride back to the top composer */}
        <Link
          href="/create"
          className="hidden h-[34px] items-center gap-[7px] rounded-[9px] bg-accent px-[14px] text-[14px] font-semibold text-on-accent md:flex"
        >
          <Plus size={17} />
          <span>New event</span>
        </Link>

        {/* two icons, each meaning what it shows: the bell is alerts, the avatar is you.
            Theme moved into the avatar menu — a header row of icon buttons is noise */}
        <div className="hidden items-center gap-2 md:flex">
          <Link
            href="/notifications"
            aria-label="Notifications"
            title="Notifications"
            className={`relative grid h-[30px] w-[30px] place-items-center rounded-lg border ${
              pathname.startsWith('/notifications')
                ? 'border-accent-border bg-accent-bg text-accent-text'
                : 'border-border text-dim hover:text-text'
            }`}
          >
            <Bell size={17} />
            {/* how many you haven't looked at — opening the page clears it */}
            {notifCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 grid h-[16px] min-w-[16px] place-items-center rounded-full bg-accent px-1 text-[10px] font-bold leading-none text-on-accent ring-2 ring-s0">
                {notifCount > 9 ? '9+' : notifCount}
              </span>
            )}
          </Link>

          {/* the avatar opens the account menu — the pattern every app trains */}
          <Popover
            align="end"
            width={236}
            trigger={(open) => (
              <span
                aria-label="Account menu"
                title="Account"
                className={`grid h-[30px] w-[30px] cursor-pointer place-items-center rounded-full text-[12.5px] font-semibold ring-2 transition-shadow ${open ? 'ring-accent-border' : 'ring-transparent hover:ring-border2'}`}
                style={{ background: '#F3EAD9', color: '#5A431C' }}
              >
                JM
              </span>
            )}
          >
            {(close) => (
              <div className="p-0.5">
                <div className="border-b border-border px-2.5 pb-2.5 pt-2">
                  <div className="text-[13.5px] font-semibold">{YOU.name}</div>
                  <div className="truncate text-[12px] text-dim">jordan@example.com</div>
                </div>
                <Link href="/profile" onClick={close} className="mt-1 flex items-center gap-2.5 rounded-[7px] px-2.5 py-2 text-[13px] font-medium hover:bg-s2">
                  <UserRound size={15} className="text-dim" /> Profile
                </Link>
                <div className="flex items-center justify-between rounded-[7px] px-2.5 py-1.5 text-[13px] font-medium">
                  <span>Theme</span>
                  <ThemeToggle />
                </div>
                <div className="mt-1 border-t border-border pt-1">
                  <Link href="/auth/signin" onClick={close} className="flex items-center gap-2.5 rounded-[7px] px-2.5 py-2 text-[13px] font-medium text-brick-text hover:bg-brick-bg/50">
                    <LogOut size={15} /> Sign out
                  </Link>
                </div>
              </div>
            )}
          </Popover>
        </div>
      </div>
    </header>
  )
}
