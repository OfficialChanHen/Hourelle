'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { useFromEvent } from './EventBack'

/* The footer's own pages, carrying the event they were followed from (see
   EventBack), so every one of them can offer the way back to it. */
export type FooterPage = { href: string; label: string }

// a row a finger can hit on a phone; a plain line of text on a wide screen
const linkCls = 'flex min-h-11 items-center text-[14px] text-dim hover:text-text sm:min-h-0 sm:py-[5px] sm:text-[13.5px]'

function Links({ pages, from }: { pages: FooterPage[]; from: string | null }) {
  return (
    <ul>
      {pages.map((p) => (
        <li key={p.href}>
          <Link href={from ? `${p.href}?from=${encodeURIComponent(from)}` : p.href} className={linkCls}>{p.label}</Link>
        </li>
      ))}
    </ul>
  )
}
function Carrying({ pages }: { pages: FooterPage[] }) {
  return <Links pages={pages} from={useFromEvent().id} />
}

export function FooterLinks({ pages }: { pages: FooterPage[] }) {
  return <Suspense fallback={<Links pages={pages} from={null} />}><Carrying pages={pages} /></Suspense>
}
