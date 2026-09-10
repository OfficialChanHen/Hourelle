import Link from 'next/link'
import { ExternalLink } from 'lucide-react'

/* ── about: what this is, where your data lives, and who carried the pixels ── */
export default function AboutPage() {
  return (
    <div className="mx-auto max-w-[680px] px-4 pb-[104px] pt-[34px] sm:px-[26px]">
      <p className="text-[11px] font-semibold uppercase tracking-[.15em] text-faint">About</p>
      <h1 className="mt-2 font-serif font-normal text-[40px] leading-[1.06] tracking-[-0.01em]">
        Find the day everyone can make.
      </h1>
      <p className="mt-4 text-[15px] leading-[1.65] text-dim">
        Aline plans things with people: one link collects when everyone is free, where they want
        to go, and who is coming. A grid for the times, a map and a ballot for the place, a route
        for multi-stop days, and a running chat beside all of it. When the answer is clear, the
        host locks it in and everyone gets the plan.
      </p>

      <div className="mt-8 rounded-2xl border border-border bg-s1 px-5 py-4">
        <p className="text-[14px] font-semibold">Your data stays with you</p>
        <p className="mt-1 text-[13.5px] leading-[1.6] text-dim">
          There are no accounts yet. Every event on this browser lives on this device and nowhere
          else. Accounts and syncing across devices are on the way; until then, the invite link is
          how plans travel.
        </p>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-s1">
        <div className="flex items-center justify-between px-5 py-3.5">
          <span className="text-[13.5px] text-dim">Version</span>
          <span className="text-[13.5px] font-semibold">Early preview</span>
        </div>
        <div className="flex items-center justify-between border-t border-border px-5 py-3.5">
          <span className="text-[13.5px] text-dim">Type</span>
          <span className="text-[13.5px] font-semibold">Instrument Serif &amp; Instrument Sans</span>
        </div>
        <div className="flex items-center justify-between border-t border-border px-5 py-3.5">
          <span className="text-[13.5px] text-dim">Place search</span>
          <span className="text-[13.5px] font-semibold">Links to OpenStreetMap</span>
        </div>
        <div className="flex items-center justify-between border-t border-border px-5 py-3.5">
          <span className="text-[13.5px] text-dim">Source</span>
          <Link href="https://github.com/OfficialChanHen/Aline" target="_blank" className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-accent-text hover:underline">
            GitHub <ExternalLink size={12} className="text-faint" />
          </Link>
        </div>
      </div>
    </div>
  )
}
