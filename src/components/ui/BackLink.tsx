'use client'

/* The way back up, one level. The chevron and the destination's name, nothing else:
   a back control that names where it goes is the one people trust enough to use.

   `onlyWithAccount` is for the pages anyone can reach — Help and About sit in the
   footer, so a visitor lands on them without an account, and pointing them at a
   page that would turn them away is worse than showing no link at all. */

import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { useAccess } from '@/hooks/useAccess'

export function BackLink({ href, label, onlyWithAccount = false, className = '' }: {
  href: string
  label: string
  onlyWithAccount?: boolean
  className?: string
}) {
  const { ready, signedIn } = useAccess()
  if (onlyWithAccount && !(ready && signedIn)) return null
  return (
    <Link
      href={href}
      // 44px of touch on a phone, the tighter desktop height above it; the negative
      // left margin puts the chevron on the same optical line as the title below
      className={`-ml-1.5 mb-2 inline-flex h-11 items-center gap-1 rounded-[9px] pl-1.5 pr-2.5 text-[13.5px] font-medium text-dim hover:bg-s2 hover:text-text sm:mb-3 sm:h-9 ${className}`}
    >
      <ChevronLeft size={16} className="flex-none" />{label}
    </Link>
  )
}
