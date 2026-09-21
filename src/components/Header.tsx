'use client'


/* ── the app header ──
   One component, four headers, chosen by who is looking:
     visitor        the landing page's header, so the two can never drift apart
     welcome steps  the name and the mark alone, since there is nowhere to go yet
     guest          the logo, the theme, and the one action their event is asking for
     account        the full bar: tabs, New event, alerts and the avatar menu

   On phones the bar rolls away as you read and comes back when you scroll up;
   desktop keeps it planted. Nothing account-shaped renders until `ready`, because
   the server cannot know which of the four this is. */

import { useRef } from 'react'
import { useSwingOnNew } from '@/hooks/useAttention'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useRouter } from 'next/navigation'
import { CalendarDays, Plus, Bell, UserRound, LogIn, LogOut, Settings, CircleHelp, Info } from 'lucide-react'
import { ThemeToggle } from './ThemeToggle'
import { VisitorHeader } from './VisitorHeader'
import { Popover, PopoverItem, PopoverSep } from './ui/Popover'
import { useNotificationCount } from '@/hooks/useNotificationCount'
import { useAccess } from '@/hooks/useAccess'
import { useHideOnScroll } from '@/hooks/useHideOnScroll'
import { initialsOf } from '@/lib/events'
import { signOut } from '@/lib/session'
import { personColors } from '@/lib/colors'

const TABS = [
  { href: '/home', label: 'Home' },
  { href: '/events', label: 'Events' },
  { href: '/templates', label: 'Templates' },
  { href: '/demos', label: 'Demos' },
]

export function Header() {
  const pathname = usePathname()
  const router = useRouter()
  const notifCount = useNotificationCount()
  const bellRef = useRef<SVGSVGElement>(null)
  useSwingOnNew(bellRef, notifCount)
  const { ready, guestEventId, visitor, account } = useAccess()
  const avatar = personColors[account.color] ?? personColors.gray
  // phones: reading scrolls the header away, scrolling back up recalls it.
  // Desktop keeps it planted (md:translate-y-0 outranks the hide).
  const hidden = useHideOnScroll()
  const chrome = `sticky top-0 z-40 border-b border-border bg-s0/90 backdrop-blur-md transition-transform duration-300 md:translate-y-0 ${hidden ? '-translate-y-full' : 'translate-y-0'}`

  // a visitor's header is the landing page's header — one component, so the two
  // never drift. Until the browser knows who this is, the same bar minus the doors.
  if (visitor || !ready) return <VisitorHeader ready={ready} />

  // the welcome steps: nothing to go to yet, so the bar is the name and the mark alone
  if (pathname.startsWith('/welcome')) {
    return (
      <header className={chrome}>
        <div className="mx-auto flex h-[54px] max-w-[1240px] items-center px-[22px]">
          <span className="flex items-center gap-[9px]">
            <span className="grid h-[26px] w-[26px] place-items-center rounded-[7px] bg-accent text-on-accent">
              <CalendarDays size={17} />
            </span>
            <span className="font-serif text-[24.5px] leading-none tracking-[.01em]">Hourelle</span>
          </span>
        </div>
      </header>
    )
  }

  // a guest's header: the logo goes to the front door like everyone else's (the
  // tab bar and the event page itself are the way back to their event), then the
  // theme (profile is gated) and the one action the rest of the app is asking for
  if (guestEventId) {
    return (
      <header className={chrome}>
        <div className="mx-auto flex h-[54px] max-w-[1240px] items-center gap-3 px-[22px]">
          <Link href="/" className="flex items-center gap-[9px]">
            <span className="grid h-[26px] w-[26px] place-items-center rounded-[7px] bg-accent text-on-accent">
              <CalendarDays size={17} />
            </span>
            <span className="font-serif text-[24.5px] leading-none tracking-[.01em]">Hourelle</span>
          </Link>
          <div className="flex-1" />
          <ThemeToggle />
          <Link href="/auth/signin" className="flex h-[34px] items-center whitespace-nowrap rounded-[9px] bg-accent px-[14px] text-[14px] font-semibold text-on-accent">
            Log in
          </Link>
        </div>
      </header>
    )
  }

  return (
    <header className={chrome}>
      <div className="mx-auto flex h-[54px] max-w-[1240px] items-center gap-[22px] px-[22px]">
        {/* logo — icon box + serif wordmark */}
        <Link href="/home" className="flex items-center gap-[9px]">
          <span className="grid h-[26px] w-[26px] place-items-center rounded-[7px] bg-accent text-on-accent">
            <CalendarDays size={17} />
          </span>
          <span className="font-serif text-[24.5px] leading-none tracking-[.01em]">Hourelle</span>
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
          data-tour="create"
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
            {/* the bell itself swings when a notification is added; the badge holds still */}
            <Bell ref={bellRef} size={17} />
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
                style={{ background: avatar.bg, color: avatar.text }}
              >
                {initialsOf(account.name)}
              </span>
            )}
          >
            {(close) => (
              <>
                {/* identity leads — the menu is "you", everything under it acts as you */}
                <div className="mb-1 border-b border-border px-2.5 pb-2.5 pt-1.5">
                  <div className="text-[13.5px] font-semibold">{account.name}</div>
                  <div className="truncate text-[12px] text-dim">
                    {account.signedIn ? account.email : 'Not logged in'}
                  </div>
                </div>
                <PopoverItem href="/profile" onClick={close} icon={<UserRound size={15} />}>Profile</PopoverItem>
                <PopoverItem href="/settings" onClick={close} icon={<Settings size={15} />}>Settings</PopoverItem>
                <PopoverSep />
                <PopoverItem href="/help" onClick={close} icon={<CircleHelp size={15} />}>Help &amp; contact</PopoverItem>
                <PopoverItem href="/about" onClick={close} icon={<Info size={15} />}>About Hourelle</PopoverItem>
                <PopoverSep />
                {account.signedIn ? (
                  <PopoverItem
                    onClick={() => { close(); void signOut().then(() => router.push('/')) }}
                    icon={<LogOut size={15} />}
                    tone="brick"
                  >
                    Log out
                  </PopoverItem>
                ) : (
                  <PopoverItem href="/auth/signin" onClick={close} icon={<LogIn size={15} />}>Log in</PopoverItem>
                )}
              </>
            )}
          </Popover>
        </div>
      </div>
    </header>
  )
}
