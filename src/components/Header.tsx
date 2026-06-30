'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ThemeToggle } from './ThemeToggle'
import { Avatar } from './ui/Avatar'

const TABS = [
  { href: '/home', label: 'Home' },
  { href: '/events', label: 'Events' },
  { href: '/templates', label: 'Templates' },
]

export function Header() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1240px] items-center gap-5 px-6 lg:px-8">
        {/* serif wordmark */}
        <Link href="/home" className="flex items-baseline gap-2 pr-1">
          <span className="font-serif text-[26px] leading-none tracking-[-0.01em] text-text">Aline</span>
          <span className="hidden h-1.5 w-1.5 translate-y-[-2px] rounded-full bg-accent sm:block" />
        </Link>

        {/* nav tabs — filled accent box when active, no underlines */}
        <nav className="hidden items-center gap-1 md:flex">
          {TABS.map((t) => {
            const active = pathname === t.href || pathname.startsWith(t.href + '/')
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`rounded-lg px-3.5 py-1.5 text-[13.5px] font-semibold transition-colors ${
                  active
                    ? 'bg-accent text-on-accent'
                    : 'text-dim hover:bg-s2 hover:text-text'
                }`}
              >
                {t.label}
              </Link>
            )
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2.5">
          <ThemeToggle />
          {/* Create event is ALWAYS a button, never a nav tab */}
          <Link
            href="/create"
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-[13px] font-semibold text-on-accent shadow-soft transition-transform hover:-translate-y-px"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            <span className="hidden sm:inline">New event</span>
          </Link>
          <button type="button" className="rounded-full ring-1 ring-border" aria-label="Your account">
            <Avatar initials="JM" color="sage" size="lg" />
          </button>
        </div>
      </div>
    </header>
  )
}
