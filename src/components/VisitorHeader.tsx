'use client'

// The one header a visitor ever sees — on the landing page and on every page the
// app lets a visitor into (the demos, an invite, help, about). One component so
// the two can never drift: same logo, same three links, same two doors.

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarDays } from 'lucide-react'
import { ThemeToggle } from './ThemeToggle'
import { useHideOnScroll } from '@/hooks/useHideOnScroll'

const LINKS = [
  { href: '/#how', label: 'How it works', match: () => false },
  { href: '/#features', label: 'What it does', match: () => false },
  { href: '/demos', label: 'Demos', match: (p: string) => p.startsWith('/demos') || p.startsWith('/events/') },
]

export function VisitorHeader({ ready = true }: { ready?: boolean }) {
  const pathname = usePathname()
  // phones: reading scrolls the header away, scrolling back up (or being at the top)
  // brings it back. Desktop keeps it planted (md:translate-y-0 outranks the hide).
  const hidden = useHideOnScroll()
  return (
    <header className={`sticky top-0 z-40 border-b border-border bg-s0/90 backdrop-blur-md transition-transform duration-300 md:translate-y-0 ${hidden ? '-translate-y-full' : 'translate-y-0'}`}>
      <div className="mx-auto flex h-[58px] w-full max-w-[1240px] items-center gap-[22px] px-[22px]">
        <Link href="/" className="flex items-center gap-[9px]">
          <span className="grid h-[26px] w-[26px] place-items-center rounded-[7px] bg-accent text-on-accent">
            <CalendarDays size={17} />
          </span>
          <span className="font-serif text-[24.5px] leading-none tracking-[.01em]">Aline</span>
        </Link>
        <nav className="hidden items-center gap-[3px] text-[14px] md:flex">
          {LINKS.map((l) => {
            const active = l.match(pathname)
            return (
              <Link key={l.href} href={l.href} className={`rounded-[9px] px-[13px] py-2 font-medium transition-colors ${active ? 'bg-accent text-on-accent' : 'text-dim hover:bg-s3 hover:text-text'}`}>
                {l.label}
              </Link>
            )
          })}
        </nav>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {/* nothing account-shaped until the browser knows who this is */}
          {ready && (
            <>
              <Link href="/auth/signin" className="hidden h-[34px] items-center rounded-[9px] px-[13px] text-[14px] font-medium text-dim hover:bg-s3 hover:text-text sm:flex">
                Sign in
              </Link>
              <Link href="/auth/signin?mode=up" className="flex h-[34px] items-center rounded-[9px] bg-accent px-[14px] text-[14px] font-semibold text-on-accent">
                Create an account
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
