'use client'

// The one header a visitor ever sees — on the landing page and on every page the
// app lets a visitor into (the demos, an invite, help, about). One component so
// the two can never drift: same logo, same three links, same two doors (both on every width: a phone still needs both).

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ThemeToggle } from './ThemeToggle'
import { useHideOnScroll } from '@/hooks/useHideOnScroll'
import { Wordmark } from '@/components/ui/Em'
import { PencilHover, PencilUnderline } from '@/components/ui/Pencil'

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
    <header data-chrome className={`sticky top-0 z-40 border-b border-border bg-s0/90 backdrop-blur-md transition-transform duration-300 has-[:focus-visible]:translate-y-0 md:translate-y-0 ${hidden ? '-translate-y-full' : 'translate-y-0'}`}>
      <div className="mx-auto flex h-[58px] w-full max-w-[1240px] items-center gap-[22px] px-[22px]">
        <Link href="/" className="flex items-center">
          <Wordmark className="text-[24.5px] tracking-[.01em]" />
        </Link>
        <nav className="hidden items-center gap-[3px] text-[14px] md:flex">
          {LINKS.map((l) => {
            const active = l.match(pathname)
            return (
              // the page you are on: the accent pencil underline and heavier words; the
              // others sketch a light graphite line under a mouse or keyboard focus
              <Link key={l.href} href={l.href} aria-current={active ? 'page' : undefined} className={`rounded-full px-[13px] py-2 ${active ? 'font-semibold text-text' : 'font-medium text-dim hover:text-text'}`}>
                {active ? <PencilUnderline>{l.label}</PencilUnderline> : <PencilHover>{l.label}</PencilHover>}
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
              <Link href="/auth/signin" className="flex h-[34px] items-center whitespace-nowrap rounded-full px-[13px] text-[14px] font-medium text-dim hover:bg-s3 hover:text-text">
                Log in
              </Link>
              <Link href="/auth/signin?mode=up" className="flex h-[34px] items-center whitespace-nowrap rounded-full bg-accent px-[14px] text-[14px] font-semibold text-on-accent">
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
