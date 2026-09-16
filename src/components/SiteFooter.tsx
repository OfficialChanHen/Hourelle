import Link from 'next/link'
import { MessageCircle } from 'lucide-react'

// One footer for the whole site: the front door has it, and so does every app page.
// On phones the bottom padding keeps it clear of the tab bar; the pages above it
// already reserve their own room, so this only pads itself.
export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex w-full max-w-[1240px] flex-wrap items-center gap-x-5 gap-y-2 px-[22px] pb-[88px] pt-6 text-[12.5px] text-faint md:pb-6">
        <Link href="/" className="font-serif text-[16px] leading-none text-dim hover:text-text">Hourelle</Link>
        <Link href="/about" className="hover:text-dim">About</Link>
        <Link href="/help" className="hover:text-dim">Help &amp; contact</Link>
        <Link href="/demos" className="hover:text-dim">Demos</Link>
        <Link href="https://github.com/OfficialChanHen/Aline" target="_blank" className="hover:text-dim">GitHub</Link>
        <span className="ml-auto flex items-center gap-1.5"><MessageCircle size={12} /> Guests never need an account.</span>
      </div>
    </footer>
  )
}
