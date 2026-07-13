import Link from 'next/link'
import { Route, Map, PartyPopper, Presentation, Repeat, Utensils, ArrowRight, type LucideIcon } from 'lucide-react'

type Tone = 'teal' | 'accent' | 'ochre'
const toneCls: Record<Tone, string> = {
  teal: 'bg-teal-bg border-teal-border text-teal-text',
  accent: 'bg-accent-bg border-accent-border text-accent-text',
  ochre: 'bg-ochre-bg border-ochre-border text-ochre-text',
}

const TEMPLATES: { key: string; icon: LucideIcon; tone: Tone; title: string; body: string }[] = [
  { key: 'offsite', icon: Route, tone: 'teal', title: 'Team offsite', body: 'A few days away. Find the dates, vote on where to go, and plan each stop.' },
  { key: 'trip', icon: Map, tone: 'accent', title: 'Weekend trip', body: 'Pick the dates together, vote on where to go, and share the costs.' },
  { key: 'birthday', icon: PartyPopper, tone: 'ochre', title: 'Birthday party', body: 'One night, one spot. See who can come in a couple of taps.' },
  { key: 'conference', icon: Presentation, tone: 'accent', title: 'Conference or summit', body: 'Lots of people and a full agenda. Keep track of who shows up to what.' },
  { key: 'one-on-one', icon: Repeat, tone: 'teal', title: 'Recurring 1:1', body: 'A regular time for two people that stays in sync with both calendars.' },
  { key: 'dinner', icon: Utensils, tone: 'ochre', title: 'Dinner & drinks', body: 'A casual night out. Find a day, pick a place, see who’s in.' },
]

export default function TemplatesPage() {
  return (
    <div className="mx-auto max-w-[1240px] px-[26px] pb-[104px] pt-[34px]">
      <div className="mb-[18px]">
        <h1 className="mb-1.5 font-serif text-[36px] leading-[1.02] tracking-[-0.01em]">Templates</h1>
        <div className="text-[13.5px] text-dim">
          Pick one to get a head start, then change the details, invites, and dates to fit.
        </div>
      </div>
      <div className="grid grid-cols-1 gap-[13px] sm:grid-cols-2 lg:grid-cols-3">
        {TEMPLATES.map((t) => {
          const Icon = t.icon
          return (
            <Link
              key={t.key}
              href={`/create?template=${t.key}`}
              className="group rounded-[13px] border border-border bg-s1 p-4 transition-all hover:-translate-y-0.5 hover:border-border2"
            >
              <span className={`mb-3 grid h-[38px] w-[38px] place-items-center rounded-[10px] border ${toneCls[t.tone]}`}>
                <Icon size={20} />
              </span>
              <div className="mb-1 text-[15px] font-semibold">{t.title}</div>
              <div className="mb-3 text-[13px] leading-[1.5] text-dim">{t.body}</div>
              <span className="flex items-center gap-1.5 text-[13px] font-semibold text-accent-text">
                Use template <ArrowRight size={15} />
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
