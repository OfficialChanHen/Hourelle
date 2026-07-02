import Link from 'next/link'
import { Route, Map, PartyPopper, Presentation, Repeat, Utensils, ArrowRight, type LucideIcon } from 'lucide-react'

type Tone = 'teal' | 'accent' | 'ochre'
const toneCls: Record<Tone, string> = {
  teal: 'bg-teal-bg border-teal-border text-teal-text',
  accent: 'bg-accent-bg border-accent-border text-accent-text',
  ochre: 'bg-ochre-bg border-ochre-border text-ochre-text',
}

const TEMPLATES: { icon: LucideIcon; tone: Tone; title: string; body: string }[] = [
  { icon: Route, tone: 'teal', title: 'Team offsite', body: 'Multi-day with availability grid, location vote, and a multi-stop itinerary.' },
  { icon: Map, tone: 'accent', title: 'Weekend trip', body: 'Pick dates together, vote on a destination, and split a shared budget.' },
  { icon: PartyPopper, tone: 'ochre', title: 'Birthday party', body: 'One evening, one place. Collect RSVPs and a head-count fast.' },
  { icon: Presentation, tone: 'accent', title: 'Conference / summit', body: 'Many attendees, sessions, and a venue. Track attendance per session.' },
  { icon: Repeat, tone: 'teal', title: 'Recurring 1:1', body: 'A standing slot between two people, synced to both calendars.' },
  { icon: Utensils, tone: 'ochre', title: 'Dinner & drinks', body: "Casual meetup — find a night, pick a spot, see who's in." },
]

export default function TemplatesPage() {
  return (
    <div className="mx-auto max-w-[1240px] px-[26px] pb-[104px] pt-[34px]">
      <div className="mb-[18px]">
        <h1 className="mb-1.5 font-serif text-[32px] leading-[1.02] tracking-[-0.01em]">Templates</h1>
        <div className="text-[12px] text-dim">
          Start from a pre-built flow — pick one and customize the details, invites, and dates.
        </div>
      </div>
      <div className="grid grid-cols-1 gap-[13px] sm:grid-cols-2 lg:grid-cols-3">
        {TEMPLATES.map((t) => {
          const Icon = t.icon
          return (
            <Link
              key={t.title}
              href="/create"
              className="group rounded-[13px] border border-border bg-s1 p-4 transition-all hover:-translate-y-0.5 hover:border-border2"
            >
              <span className={`mb-3 grid h-[38px] w-[38px] place-items-center rounded-[10px] border ${toneCls[t.tone]}`}>
                <Icon size={18} />
              </span>
              <div className="mb-1 text-[13.5px] font-semibold">{t.title}</div>
              <div className="mb-3 text-[11.5px] leading-[1.5] text-dim">{t.body}</div>
              <span className="flex items-center gap-1.5 text-[11.5px] font-semibold text-accent-text">
                Use template <ArrowRight size={13} />
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
