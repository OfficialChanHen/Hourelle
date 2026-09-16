import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { FeedbackForm } from './_components/FeedbackForm'
import { BackLink } from '@/components/ui/BackLink'

/* ── help & contact: the questions people actually hit, answered in plain words,
   then a real way to reach a person ── */

type QA = { q: string; a: React.ReactNode }
const GROUPS: { title: string; items: QA[] }[] = [
  {
    title: 'Getting started',
    items: [
      { q: 'How do I plan something?', a: 'Log in, name the plan, and pick a stretch of days. That is enough to get a link. Everything else, the place, the budget, the time window, can be added later or never.' },
      { q: 'How do people join?', a: 'Copy the invite link from the event page or its card and send it anywhere. Whoever opens it adds their name and they are in. They can mark when they are free, vote on places, say if they are coming, and chat.' },
      { q: 'What does "Lock it in" do?', a: 'It turns the plan into fact: the chosen day, time, and place go out to everyone, and the event moves to the RSVP stretch where people say if they are coming. You can reopen planning later, which clears the RSVPs.' },
      { q: 'What is the difference between a time poll and a day poll?', a: 'A time poll asks when during the day people are free, in slots. A day poll asks which whole days work, one tap each. Ranges longer than four weeks become day polls on their own, since trips are picked by day, not by hour.' },
    ],
  },
  {
    title: 'Guests and invites',
    items: [
      { q: 'Do guests need an account?', a: 'No. A name is enough. Adding an email is recommended: with it, a guest can pick their answers back up on another device, and if they ever make an account with that email, every event they answered comes with them.' },
      { q: 'Someone joined twice. Now what?', a: 'Open the event, go to Event details, and use the menu on the duplicate entry: Merge into someone else. Their free time, votes, and messages fold into the other entry, and the double goes away. Nothing they answered is lost.' },
      { q: 'What is a personal link?', a: 'When you invite people by email, each one gets a link of their own. Opening it lands them already named, no form. Copy it from that person’s menu on the Event details tab.' },
      { q: 'Can a guest see everything?', a: 'Everything except the host’s controls. The budget is visible but only the host can change it; the same goes for the dates, the description, and locking the plan in.' },
    ],
  },
  {
    title: 'Your account and your data',
    items: [
      { q: 'Where does my data live?', a: 'With an account, your events are stored on Hourelle’s servers so they follow you between devices. Logged out, everything stays in this browser only. Demos are samples and never leave your device.' },
      { q: 'Who can see my event?', a: 'Anyone with its link. Links are long and random, so they cannot be guessed, but they can be forwarded. Share them the way you would share a private document.' },
      { q: 'How do I delete an event?', a: 'The host deletes it from the Event details tab, and it is gone for everyone. Anyone else can leave, which only removes it from their own list.' },
      { q: 'How do I delete my account?', a: 'Send a note through the form below from the email on the account. The account, its profile, and the events it hosts are removed.' },
    ],
  },
  {
    title: 'When something looks wrong',
    items: [
      { q: 'My change did not save', a: 'A small note at the bottom of the page says when the server refused a change, usually because only the host may make it. Reload to see the plan as everyone else sees it.' },
      { q: 'The times look off', a: 'Every time shows its timezone in a small pill. Check that the event’s timezone matches where the event happens; you can switch to your own zone with the toggle above the grid.' },
      { q: 'I did not get an email', a: 'Check spam first. Magic links and password resets expire after a short while, so ask for a fresh one if the link says it has expired.' },
    ],
  },
]

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-[760px] px-4 pb-[104px] pt-[34px] sm:px-[26px]">
      <BackLink href="/profile" label="Profile" onlyWithAccount />
      <h1 className="font-serif font-normal text-[33.5px] leading-[1.04] tracking-[-0.01em]">Help &amp; contact</h1>
      <p className="mt-1.5 text-[13.5px] text-dim">Short answers first, a person after that.</p>

      {GROUPS.map((g) => (
        <section key={g.title}>
          <p className="mb-2 mt-7 text-[11px] font-semibold uppercase tracking-[.13em] text-faint">{g.title}</p>
          <div className="overflow-hidden rounded-2xl border border-border bg-s1">
            {g.items.map((f, i) => (
              <details key={f.q} className={`group ${i > 0 ? 'border-t border-border' : ''}`}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-[14px] font-semibold hover:bg-s2 [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span className="flex-none text-faint transition-transform group-open:rotate-45" aria-hidden>+</span>
                </summary>
                <p className="px-5 pb-4 text-[13.5px] leading-[1.6] text-dim">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      ))}

      <p className="mb-2 mt-9 text-[11px] font-semibold uppercase tracking-[.13em] text-faint">Report a problem or send an idea</p>
      <FeedbackForm />

      <p className="mb-2 mt-7 text-[11px] font-semibold uppercase tracking-[.13em] text-faint">Elsewhere</p>
      <div className="rounded-2xl border border-border bg-s1 px-5 py-4 text-[13.5px] leading-[1.6] text-dim">
        Hourelle is built in the open. The code, the issue tracker, and the release notes are on{' '}
        <Link href="https://github.com/OfficialChanHen/Hourelle" target="_blank" className="inline-flex items-center gap-1 font-semibold text-accent-text hover:underline">
          GitHub <ExternalLink size={12} className="text-faint" />
        </Link>.
      </div>
    </div>
  )
}
