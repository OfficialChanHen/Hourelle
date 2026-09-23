import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { EventBack } from '@/components/EventBack'
import { SupportCard } from '@/components/ui/Support'

/* ── about: why Hourelle exists, what it holds to, and how it treats what you give it ── */

const PRINCIPLES: { title: string; text: string }[] = [
  { title: 'Answering never needs an account.', text: 'A link and a name are enough. The people you invite should not have to sign up for anything to tell you when they are free.' },
  { title: 'The group informs, the host decides.', text: 'Everyone answers, the picture becomes clear, and one person locks it in. Nothing is left hanging on a vote nobody closes.' },
  { title: 'Time zones are never a surprise.', text: 'Every time is shown with its zone, and anyone can see the plan in their own.' },
  { title: 'The whole plan, not just the hour.', text: 'Where to go, who is coming, what it costs, and the reminders before the day: all of it lives on the same page as the time.' },
  { title: 'Private by default.', text: 'An event is visible to the people holding its link and to no one else, and nothing you put in it is sold.' },
  { title: 'Free to host.', text: 'Planning something with people is not a premium feature. Hosting is free and stays free.' },
]

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-[680px] px-4 pb-[92px] pt-[34px] sm:px-[26px]">
      <EventBack fallback={{ href: '/profile', label: 'Profile' }} />
      <p className="text-[11px] font-semibold uppercase tracking-[.15em] text-faint">About</p>
      <h1 className="mt-2 font-serif font-normal text-[40px] leading-[1.06] tracking-[-0.01em]">
        Find the hour everyone can meet.
      </h1>
      <p className="mt-4 text-[15px] leading-[1.65] text-dim">
        Hourelle is an independent service for settling plans with other people: when, where, and
        who is coming. One link goes out, everyone answers in a minute, and the host locks in the plan.
      </p>

      <h2 className="mt-9 font-serif font-normal text-[26px] leading-[1.15] tracking-[-0.01em]">Why it exists</h2>
      <p className="mt-3 text-[14.5px] leading-[1.7] text-dim">
        Most plans die in the thread. Someone suggests a weekend, half the group answers, the place
        comes up three days later, and by the time a date is settled nobody remembers who said they
        were in. The tools that help stop at the time: they show a grid, and leave the place, the
        headcount, and the reminders to the chat.
      </p>
      <p className="mt-3 text-[14.5px] leading-[1.7] text-dim">
        Hourelle carries a plan from the first message to the day itself. The grid finds the hour,
        the map and the ballot find the place, the roster says who is coming, and the reminders go
        out on their own. It is built for the dinner for six as much as the offsite for sixty, and
        for the person who ends up organising both.
      </p>

      <h2 className="mt-9 font-serif font-normal text-[26px] leading-[1.15] tracking-[-0.01em]">What it holds to</h2>
      <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-s1">
        {PRINCIPLES.map((p, i) => (
          <div key={p.title} className={`px-5 py-4 ${i > 0 ? 'border-t border-border' : ''}`}>
            <div className="text-[14px] font-semibold">{p.title}</div>
            <p className="mt-1 text-[13.5px] leading-[1.6] text-dim">{p.text}</p>
          </div>
        ))}
      </div>

      <h2 className="mt-9 font-serif font-normal text-[26px] leading-[1.15] tracking-[-0.01em]">How your data is handled</h2>
      <div className="mt-4 rounded-2xl border border-border bg-s1 px-5 py-4">
        <ul className="flex flex-col gap-2.5 text-[13.5px] leading-[1.6] text-dim">
          <li><span className="font-semibold text-text">What is kept.</span> Your account (name and email), the events you host or take part in, and what you answered in them: free time, votes, RSVPs, messages.</li>
          <li><span className="font-semibold text-text">Who can see it.</span> Anyone holding an event’s link can see that event. Only the host can change its details or lock it in, and the database enforces this, not just the screen.</li>
          <li><span className="font-semibold text-text">Guests.</span> A guest gives a name and, if they choose, an email. Nothing exists for them beyond their place on that event.</li>
          <li><span className="font-semibold text-text">Logged out.</span> Nothing you do leaves this browser. The demos are samples and are never uploaded.</li>
          <li><span className="font-semibold text-text">Removal.</span> A host can delete an event for everyone, anyone can leave one, and an account can be deleted from its profile page.</li>
          <li><span className="font-semibold text-text">No tracking.</span> No analytics, no advertising, no third-party scripts. Map tiles are fetched from OpenStreetMap when the Location tab is open.</li>
        </ul>
        <p className="mt-3 text-[13px] text-dim">
          The full terms are in the <Link href="/privacy" className="font-semibold text-accent-text hover:underline">Privacy Policy</Link> and the <Link href="/terms" className="font-semibold text-accent-text hover:underline">Terms and Conditions</Link>.
        </p>
      </div>

      <h2 className="mt-9 font-serif font-normal text-[26px] leading-[1.15] tracking-[-0.01em]">The project</h2>
      <div className="mt-4 rounded-2xl border border-border bg-s1 px-5 py-4 text-[13.5px] leading-[1.65] text-dim">
        <p>
          Hourelle is in early access and is made by one person. Questions, problems and ideas are
          welcome through the <Link href="/help" className="font-semibold text-accent-text hover:underline">Help page</Link>,
          and the answer comes from the person who built it.
        </p>
        <p className="mt-2.5">
          The code is published in the open. Its README explains how the service is put together:{' '}
          <Link href="https://github.com/OfficialChanHen/Hourelle" target="_blank" className="inline-flex items-center gap-1 font-semibold text-accent-text hover:underline">
            Hourelle on GitHub <ExternalLink size={12} className="text-faint" />
          </Link>.
        </p>
      </div>

      <SupportCard />

      <p className="mt-6 text-[12.5px] leading-[1.6] text-faint">
        Map data © OpenStreetMap contributors. Hourelle is an independent project and is not affiliated with Google, Microsoft, or OpenStreetMap.
      </p>
    </div>
  )
}
