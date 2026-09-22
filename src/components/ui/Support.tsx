import Link from 'next/link'
import { Coffee } from 'lucide-react'

/* Hourelle is free to host and free to join, and stays that way. The one ask is a
   coffee, for whoever feels like it. The link is the Buy Me a Coffee page, overridable
   from the environment. */
export const SUPPORT_URL = process.env.NEXT_PUBLIC_SUPPORT_URL || 'https://www.buymeacoffee.com/ChanHen'

/** The quiet footer link. */
export function SupportLink() {
  if (!SUPPORT_URL) return null
  return (
    <Link href={SUPPORT_URL} target="_blank" rel="noopener" className="flex items-center gap-1.5 hover:text-dim">
      <Coffee size={12} /> Buy me a coffee
    </Link>
  )
}

/** The card on the About page: the why, and the one button. */
export function SupportCard() {
  if (!SUPPORT_URL) return null
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-2xl border border-border bg-s1 px-5 py-4">
      <div className="min-w-[220px] flex-1">
        <p className="text-[14px] font-semibold">Free to host, free to join</p>
        <p className="mt-1 text-[13.5px] leading-[1.6] text-dim">
          Hourelle costs nothing. If it saved you a group chat or two, a coffee keeps the servers and the reminders going.
        </p>
      </div>
      {/* the official button, so it is recognised at a glance; an image from their CDN, no script */}
      <Link href={SUPPORT_URL} target="_blank" rel="noopener" className="flex-none">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy me a coffee" width={163} height={45} className="h-[45px] w-auto rounded-[8px]" />
      </Link>
    </div>
  )
}
