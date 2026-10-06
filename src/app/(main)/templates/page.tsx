import Link from 'next/link'
import { Route, Map, PartyPopper, Presentation, Repeat, Utensils, Dices, CookingPot, ArrowRight, type LucideIcon } from 'lucide-react'
import { Cover } from '@/components/ui/Cover'
import { PhotoFrame } from '@/components/ui/PhotoFrame'
import { Keepsake, shelfLooks } from '@/components/ui/Keepsake'
import { SoftShapes } from '@/components/ui/SoftShapes'
import { FaceSticker } from '@/components/ui/FaceSticker'

// each template dresses as the event it becomes: its own cover in a hand-laid frame,
// lying straight. No faces: nobody is invited to a template yet. Ordered by how often
// people actually plan these: everyday social first, work after.
const TEMPLATES: { key: string; icon: LucideIcon; src?: string; from: string; to: string; title: string; body: string }[] = [
  { key: 'dinner', icon: Utensils, src: 'preset:dusk', from: '', to: '', title: 'Dinner & Drinks', body: 'A casual night out. Find a day, pick a place, see who’s in.'},
  { key: 'game-night', icon: Dices, src: 'preset:evening', from: '', to: '', title: 'Game Night', body: 'Cards or a board, someone’s table. Find the night that works.'},
  { key: 'birthday', icon: PartyPopper, src: 'preset:party', from: '', to: '', title: 'Birthday Party', body: 'One night, one spot. See who can come in a couple of taps.'},
  { key: 'potluck', icon: CookingPot, src: 'preset:harvest', from: '', to: '', title: 'Potluck', body: 'Everyone brings a dish. Find a day and a kitchen that fits.'},
  { key: 'trip', icon: Map, src: 'preset:meadow', from: '', to: '', title: 'Weekend Trip', body: 'Pick the dates together, vote on where to go, and share the costs.'},
  { key: 'offsite', icon: Route, src: 'preset:coast', from: '', to: '', title: 'Team Offsite', body: 'A few days away. Find the dates, vote on where to go, and plan each stop.'},
  { key: 'one-on-one', icon: Repeat, src: 'preset:garden', from: '', to: '', title: 'Recurring 1:1', body: 'A regular time for two people that stays in sync with both calendars.'},
  { key: 'conference', icon: Presentation, src: 'preset:city', from: '', to: '', title: 'Conference Or Summit', body: 'Lots of people and a full agenda. Keep track of who shows up to what.'},
]

export default function TemplatesPage() {
  const looks = shelfLooks(TEMPLATES.map((t) => `template-${t.key}`))
  return (
    <div className="mx-auto max-w-[1240px] px-6 pb-[92px] pt-[34px] sm:px-[26px]">
      <div className="relative isolate -mt-[34px] mb-12 pb-7 pt-[34px]">
        <SoftShapes variant="plan" />
        <h1 className="mb-1.5 font-serif font-normal text-[36px] leading-[1.02] tracking-[-0.01em] sm:text-[40px]">Templates</h1>
        <p className="max-w-[560px] text-[14px] leading-[1.55] text-dim">
          Pick the kind of get-together for a head start. Every detail stays yours to change.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
        {TEMPLATES.map((t, i) => {
          const Icon = t.icon
          const look = looks[i]
          return (
            <PhotoFrame key={t.key} tilt={0} tape={false} pad={look.pad} className="h-full [&>div]:flex [&>div]:h-full [&>div]:flex-col">
                <Link href={`/create?template=${t.key}`} className="group flex flex-1 flex-col">
                  <div className="relative mb-3">
                    <Cover src={t.src} from={t.from} to={t.to} className="h-[104px]" rounded="rounded-lg" />
                    <Keepsake look={look} />
                  </div>
                  <div className="flex flex-1 flex-col px-1 pb-1">
                    <h2 className="mb-1 flex items-center gap-2 font-serif text-[21px] leading-[1.15] tracking-[-0.01em]">
                      <Icon size={17} className="flex-none text-dim" aria-hidden /> {t.title}
                    </h2>
                    <p className="mb-3 text-[13px] leading-[1.5] text-dim">{t.body}</p>
                    <span className="mt-auto flex items-center gap-1.5 text-[13.5px] font-semibold text-accent-text">
                      Use template <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </Link>
            </PhotoFrame>
          )
        })}
        {/* the way out of every template gallery: an empty frame, waiting for your own */}
        <PhotoFrame tilt={0} tape={false} className="h-full [&>div]:flex [&>div]:h-full [&>div]:flex-col">
          <Link href="/create" className="group flex flex-1 flex-col">
            <div className="mb-3 grid h-[104px] place-items-center rounded-lg border-2 border-dashed border-border2">
              <FaceSticker size={64} tilt={-6} flippable={false} />
            </div>
            <div className="flex flex-1 flex-col px-1 pb-1">
              <h2 className="mb-1 font-serif text-[21px] leading-[1.15] tracking-[-0.01em]">Start blank</h2>
              <p className="mb-3 text-[13px] leading-[1.5] text-dim">No template, just the wizard. Every choice stays open.</p>
              <span className="mt-auto flex items-center gap-1.5 text-[13.5px] font-semibold text-accent-text">
                Start a plan <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
              </span>
            </div>
          </Link>
        </PhotoFrame>
      </div>
    </div>
  )
}
