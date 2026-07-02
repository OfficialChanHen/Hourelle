'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarDays, Plus, MoreHorizontal } from 'lucide-react'
import { ThemeToggle } from './ThemeToggle'

const TABS = [
  { href: '/home', label: 'Home' },
  { href: '/events', label: 'Events' },
  { href: '/templates', label: 'Templates' },
]

export function Header() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-s0/90 backdrop-blur-md">
      <div className="mx-auto flex h-[54px] max-w-[1240px] items-center gap-[22px] px-[22px]">
        {/* logo — icon box + serif wordmark */}
        <Link href="/home" className="flex items-center gap-[9px]">
          <span className="grid h-[26px] w-[26px] place-items-center rounded-[7px] bg-accent text-on-accent">
            <CalendarDays size={15} />
          </span>
          <span className="font-serif text-[22px] leading-none tracking-[.01em]">Aline</span>
        </Link>

        {/* nav — filled accent box when active, no underlines */}
        <nav className="hidden items-center gap-[3px] text-[12.5px] md:flex">
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

        <Link
          href="/create"
          className="flex h-[34px] items-center gap-[7px] rounded-[9px] bg-accent px-[14px] text-[12.5px] font-semibold text-on-accent"
        >
          <Plus size={15} />
          New event
        </Link>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            className="grid h-[30px] w-[30px] place-items-center rounded-full text-[11px] font-semibold"
            style={{ background: '#F3EAD9', color: '#5A431C' }}
            aria-label="Your account"
          >
            JM
          </button>
          <button className="grid h-[30px] w-[30px] place-items-center rounded-lg border border-border text-dim hover:text-text" aria-label="More">
            <MoreHorizontal size={16} />
          </button>
        </div>
      </div>
    </header>
  )
}
