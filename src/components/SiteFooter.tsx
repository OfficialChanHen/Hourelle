import Link from 'next/link'
import { MessageCircle } from 'lucide-react'
import { SupportLink } from './ui/Support'
import { FooterLinks, type FooterPage } from './FooterLinks'

// One footer for the whole site: the front door has it, and so does every app page.
// The name and the promise on one side, the pages in two short labelled groups on
// the other, and a ruled line under both. On a phone the groups sit side by side
// under the name rather than wrapping as one ragged line, and every link is a row a
// finger can hit. The bottom padding keeps it clear of the tab bar; the pages above
// it already reserve their own room, so this only pads itself.
const GROUPS: { title: string; pages: FooterPage[] }[] = [
  { title: 'Explore', pages: [{ href: '/about', label: 'About' }, { href: '/demos', label: 'Demos' }, { href: '/help', label: 'Help & contact' }] },
  { title: 'Legal', pages: [{ href: '/privacy', label: 'Privacy' }, { href: '/terms', label: 'Terms' }] },
]

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-s0">
      <div className="mx-auto w-full max-w-[1240px] px-[22px] pb-[88px] pt-9 md:pb-8 md:pt-12">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between sm:gap-12">
          <div className="min-w-0 max-w-[360px]">
            <Link href="/" className="font-serif text-[28px] leading-none text-text">Hourelle</Link>
            <p className="mt-3 text-[14px] leading-[1.55] text-dim">Find the hour everyone can meet.</p>
            <SupportLink />
          </div>
          {/* followed from an event, each of these carries it, so the page can offer the way back */}
          <nav aria-label="Footer" className="grid grid-cols-2 gap-x-8 sm:gap-x-16">
            {GROUPS.map((g) => (
              <div key={g.title} className="min-w-0">
                <h2 className="mb-1.5 text-[11px] font-semibold uppercase tracking-[.13em] text-faint sm:mb-2.5">{g.title}</h2>
                <FooterLinks pages={g.pages} />
              </div>
            ))}
          </nav>
        </div>
        <div className="mt-9 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-border pt-5 text-[12px] text-faint md:mt-11">
          <span>© {new Date().getFullYear()} Hourelle</span>
          <span className="flex items-center gap-1.5"><MessageCircle size={12} aria-hidden /> Guests never need an account.</span>
        </div>
      </div>
    </footer>
  )
}
