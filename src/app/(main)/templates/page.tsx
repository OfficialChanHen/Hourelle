import Link from 'next/link'
import { Route, Map, PartyPopper, Presentation, Repeat, Utensils, Dices, CookingPot, ArrowRight, Plus, type LucideIcon } from 'lucide-react'
import { Cover } from '@/components/ui/Cover'
import { personColors, type PersonColor } from '@/lib/colors'

// each template dresses as the event it becomes: its own cover on top and an icon
// chip in its own decorative hue — identity colors, never semantic ones. Ordered by
// how often people actually plan these: everyday social first, work after.
const TEMPLATES: { key: string; icon: LucideIcon; src?: string; from: string; to: string; chip: PersonColor; title: string; body: string }[] = [
  { key: 'dinner', icon: Utensils, src: 'preset:dusk', from: '', to: '', chip: 'coral', title: 'Dinner & Drinks', body: 'A casual night out. Find a day, pick a place, see who’s in.' },
  { key: 'game-night', icon: Dices, src: 'preset:evening', from: '', to: '', chip: 'purple', title: 'Game Night', body: 'Cards or a board, someone’s table. Find the night that works.' },
  { key: 'birthday', icon: PartyPopper, from: '#EAD6D3', to: '#DFC2BD', chip: 'pink', title: 'Birthday Party', body: 'One night, one spot. See who can come in a couple of taps.' },
  { key: 'potluck', icon: CookingPot, src: 'preset:harvest', from: '', to: '', chip: 'amber', title: 'Potluck', body: 'Everyone brings a dish. Find a day and a kitchen that fits.' },
  { key: 'trip', icon: Map, src: 'preset:meadow', from: '', to: '', chip: 'green', title: 'Weekend Trip', body: 'Pick the dates together, vote on where to go, and share the costs.' },
  { key: 'offsite', icon: Route, src: 'preset:coast', from: '', to: '', chip: 'blue', title: 'Team Offsite', body: 'A few days away. Find the dates, vote on where to go, and plan each stop.' },
  { key: 'one-on-one', icon: Repeat, src: 'preset:garden', from: '', to: '', chip: 'teal', title: 'Recurring 1:1', body: 'A regular time for two people that stays in sync with both calendars.' },
  { key: 'conference', icon: Presentation, from: '#E2DED3', to: '#D2CCBC', chip: 'gray', title: 'Conference Or Summit', body: 'Lots of people and a full agenda. Keep track of who shows up to what.' },
]

export default function TemplatesPage() {
  return (
    <div className="mx-auto max-w-[1240px] px-[26px] pb-[104px] pt-[34px]">
      <div className="mb-[18px]">
        <h1 className="mb-1.5 font-serif font-normal text-[36px] leading-[1.02] tracking-[-0.01em]">Templates</h1>
        <div className="text-[13.5px] text-dim">
          Pick one to get a head start, then change the details, invites, and dates to fit.
        </div>
      </div>
      <div className="grid grid-cols-1 gap-[13px] sm:grid-cols-2 lg:grid-cols-3">
        {TEMPLATES.map((t) => {
          const Icon = t.icon
          const c = personColors[t.chip]
          return (
            <Link
              key={t.key}
              href={`/create?template=${t.key}`}
              className="group flex flex-col overflow-hidden rounded-[13px] border border-border bg-s1 transition-all hover:-translate-y-0.5 hover:border-border2"
            >
              <Cover src={t.src} from={t.from} to={t.to} className="h-[64px]" />
              <div className="flex flex-1 flex-col p-4 pt-0">
                {/* the chip straddles the cover like an avatar on an event page */}
                <span
                  className="z-[1] -mt-[19px] mb-2.5 grid h-[38px] w-[38px] place-items-center rounded-[10px] ring-4 ring-s1"
                  style={{ background: c.bg, color: c.text }}
                >
                  <Icon size={20} />
                </span>
                <div className="mb-1 text-[15px] font-semibold">{t.title}</div>
                <div className="mb-3 text-[13px] leading-[1.5] text-dim">{t.body}</div>
                <span className="mt-auto flex items-center gap-1.5 text-[13px] font-semibold text-accent-text">
                  Use template <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            </Link>
          )
        })}
        {/* the way out of every template gallery: none of these, thanks */}
        <Link
          href="/create"
          className="group flex flex-col rounded-[13px] border border-dashed border-border2 bg-s0 p-4 transition-all hover:-translate-y-0.5 hover:border-accent-border"
        >
          <span className="mb-3 grid h-[38px] w-[38px] place-items-center rounded-[10px] border border-border bg-s1 text-dim">
            <Plus size={20} />
          </span>
          <div className="mb-1 text-[15px] font-semibold">Start blank</div>
          <div className="mb-3 text-[13px] leading-[1.5] text-dim">No template, just the wizard. Every choice stays open.</div>
          <span className="mt-auto flex items-center gap-1.5 text-[13px] font-semibold text-accent-text">
            Create an event <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
          </span>
        </Link>
      </div>
    </div>
  )
}
