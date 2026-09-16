import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { BackLink } from '@/components/ui/BackLink'

/* ── about: what this is, how it treats your data, and what it is built on ── */

const ROWS: { k: string; v: React.ReactNode }[] = [
  { k: 'Version', v: 'Early access' },
  { k: 'Accounts', v: 'Google, or email and password. Guests never need one.' },
  { k: 'Storage', v: 'Supabase (Postgres), with row-level security on every table' },
  { k: 'Maps', v: 'Leaflet, with OpenStreetMap tiles and place search' },
  { k: 'Type', v: 'Lora for headings, Instrument Sans for everything else' },
  { k: 'Source', v: <Link href="https://github.com/OfficialChanHen/Aline" target="_blank" className="inline-flex items-center gap-1.5 font-semibold text-accent-text hover:underline">GitHub <ExternalLink size={12} className="text-faint" /></Link> },
]

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-[680px] px-4 pb-[104px] pt-[34px] sm:px-[26px]">
      <BackLink href="/profile" label="Profile" onlyWithAccount />
      <p className="text-[11px] font-semibold uppercase tracking-[.15em] text-faint">About</p>
      <h1 className="mt-2 font-serif font-normal text-[40px] leading-[1.06] tracking-[-0.01em]">
        Find the day everyone can make.
      </h1>
      <p className="mt-4 text-[15px] leading-[1.65] text-dim">
        Hourelle plans things with people: one link collects when everyone is free, where they want
        to go, and who is coming. A grid for the times, a map and a ballot for the place, a route
        for multi-stop days, and a running chat beside all of it. When the answer is clear, the
        host locks it in and everyone gets the plan.
      </p>

      <div className="mt-8 rounded-2xl border border-border bg-s1 px-5 py-4">
        <p className="text-[14px] font-semibold">How your data is handled</p>
        <ul className="mt-2 flex flex-col gap-2 text-[13.5px] leading-[1.6] text-dim">
          <li><span className="font-semibold text-text">What is stored.</span> Your account (name, email), the events you host or take part in, and what you answered in them: free time, votes, RSVPs, messages.</li>
          <li><span className="font-semibold text-text">Who can see it.</span> Anyone holding an event’s link can see that event. Only the host can change its details or lock it in; the database enforces this, not just the screen.</li>
          <li><span className="font-semibold text-text">Guests.</span> A guest gives a name and, if they choose, an email. Nothing is created on the server for them beyond their place on that event.</li>
          <li><span className="font-semibold text-text">Logged out.</span> Nothing you do leaves this browser. The demos are samples and are never uploaded.</li>
          <li><span className="font-semibold text-text">Removal.</span> Hosts can delete an event for everyone; anyone can leave one. To delete an account, write through the <Link href="/help" className="font-semibold text-accent-text hover:underline">Help page</Link>.</li>
          <li><span className="font-semibold text-text">No tracking.</span> No analytics, no advertising, no third-party scripts. Map tiles are fetched from OpenStreetMap when the Location tab is open.</li>
        </ul>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-s1">
        {ROWS.map((r, i) => (
          <div key={r.k} className={`flex items-center justify-between gap-4 px-5 py-3.5 ${i > 0 ? 'border-t border-border' : ''}`}>
            <span className="flex-none text-[13.5px] text-dim">{r.k}</span>
            <span className="text-right text-[13.5px] font-semibold">{r.v}</span>
          </div>
        ))}
      </div>

      <p className="mt-6 text-[12.5px] leading-[1.6] text-faint">
        Map data © OpenStreetMap contributors. Hourelle is an independent project and is not affiliated with Google, Microsoft, or Supabase.
      </p>
    </div>
  )
}
