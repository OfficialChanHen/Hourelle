'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { useFromEvent } from './EventBack'

/* The footer's own pages, carrying the event they were followed from (see
   EventBack), so every one of them can offer the way back to it. */
const PAGES = [
  { href: '/about', label: 'About' },
  { href: '/help', label: 'Help & contact' },
  { href: '/demos', label: 'Demos' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
]

function Links({ from }: { from: string | null }) {
  return (
    <>
      {PAGES.map((p) => (
        <Link key={p.href} href={from ? `${p.href}?from=${encodeURIComponent(from)}` : p.href} className="hover:text-dim">{p.label}</Link>
      ))}
    </>
  )
}
function Carrying() {
  return <Links from={useFromEvent().id} />
}

export function FooterLinks() {
  return <Suspense fallback={<Links from={null} />}><Carrying /></Suspense>
}
