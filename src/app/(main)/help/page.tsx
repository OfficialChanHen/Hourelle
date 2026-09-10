import Link from 'next/link'
import { ExternalLink } from 'lucide-react'

/* ── help & contact: the questions people actually hit, answered in plain words ── */

const FAQ: { q: string; a: React.ReactNode }[] = [
  {
    q: 'How do people join my event?',
    a: 'Copy the invite link from the event page or its card and send it anywhere. Whoever opens it adds their name and they are in. They can mark when they are free, vote on places, RSVP, and chat.',
  },
  {
    q: 'Do guests need an account?',
    a: 'No. A name is enough. Adding an email is optional; with it, a guest gets reminders and can pick their answers back up on another device.',
  },
  {
    q: 'What does "Lock it in" do?',
    a: 'It turns the plan into fact: the chosen day, time, and place go out to everyone, and the event moves to its RSVP stretch where people say if they are coming. You can reopen planning later, which clears the RSVPs.',
  },
  {
    q: 'What is the difference between a time poll and a day poll?',
    a: 'A time poll asks when during the day people are free, in slots. A day poll asks which whole days work, one tap each. Ranges longer than four weeks become day polls automatically, since trips are picked by day, not by hour.',
  },
  {
    q: 'Who can see and edit the budget?',
    a: 'Everyone in the event can see it. Only the host can change it.',
  },
  {
    q: 'Where does my data live?',
    a: 'On this device, in your browser. There are no accounts and no server yet, so clearing the browser storage clears your events. Accounts and syncing are on the way.',
  },
]

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-[760px] px-4 pb-[104px] pt-[34px] sm:px-[26px]">
      <h1 className="font-serif font-normal text-[33.5px] leading-[1.04] tracking-[-0.01em]">Help &amp; contact</h1>
      <p className="mt-1.5 text-[13.5px] text-dim">Short answers first, a human after that.</p>

      <p className="mb-2 mt-7 text-[11px] font-semibold uppercase tracking-[.13em] text-faint">Common questions</p>
      <div className="overflow-hidden rounded-2xl border border-border bg-s1">
        {FAQ.map((f, i) => (
          <div key={f.q} className={`px-5 py-4 ${i > 0 ? 'border-t border-border' : ''}`}>
            <p className="text-[14px] font-semibold">{f.q}</p>
            <p className="mt-1 text-[13.5px] leading-[1.6] text-dim">{f.a}</p>
          </div>
        ))}
      </div>

      <p className="mb-2 mt-7 text-[11px] font-semibold uppercase tracking-[.13em] text-faint">Contact</p>
      <div className="rounded-2xl border border-border bg-s1 px-5 py-4">
        <p className="text-[13.5px] leading-[1.6] text-dim">
          Found a bug, or something reads wrong? The project is built in the open. Issues and ideas are welcome.
        </p>
        <Link
          href="https://github.com/OfficialChanHen/Aline/issues"
          target="_blank"
          className="mt-3 inline-flex h-9 items-center gap-2 rounded-[10px] border border-border2 bg-s1 px-3.5 text-[13.5px] font-semibold hover:bg-s2"
        >
          Open an issue on GitHub <ExternalLink size={13} className="text-faint" />
        </Link>
        <p className="mt-3 text-[12.5px] leading-[1.55] text-faint">
          In-app support lands here once accounts exist.
        </p>
      </div>
    </div>
  )
}
