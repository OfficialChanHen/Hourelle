import Link from 'next/link'
import { Route, Map, PartyPopper, Presentation, Repeat, Utensils, Dices, CookingPot, ArrowRight, type LucideIcon } from 'lucide-react'
import { Cover } from '@/components/ui/Cover'
import { PhotoFrame } from '@/components/ui/PhotoFrame'
import { PeekCard } from '@/components/ui/PeekCard'
import { Keepsake, lookOf, type Look } from '@/components/ui/Keepsake'
import { SoftShapes } from '@/components/ui/SoftShapes'
import { FaceSticker } from '@/components/ui/FaceSticker'
import { personColors, type PersonColor } from '@/lib/colors'
import { faceFor } from '@/lib/faces'
import type { Participant } from '@/lib/events'

// each template dresses as the event it becomes: its own cover in a hand-laid frame,
// and the faces of the kind of group it is for peeking over the top (`group`: two for
// a 1:1, a full row for a party). Ordered by how often people actually plan these:
// everyday social first, work after.
const TEMPLATES: { key: string; icon: LucideIcon; src?: string; from: string; to: string; title: string; body: string; group: number }[] = [
  { key: 'dinner', icon: Utensils, src: 'preset:dusk', from: '', to: '', title: 'Dinner & Drinks', body: 'A casual night out. Find a day, pick a place, see who’s in.', group: 5 },
  { key: 'game-night', icon: Dices, src: 'preset:evening', from: '', to: '', title: 'Game Night', body: 'Cards or a board, someone’s table. Find the night that works.', group: 4 },
  { key: 'birthday', icon: PartyPopper, src: 'preset:party', from: '', to: '', title: 'Birthday Party', body: 'One night, one spot. See who can come in a couple of taps.', group: 6 },
  { key: 'potluck', icon: CookingPot, src: 'preset:harvest', from: '', to: '', title: 'Potluck', body: 'Everyone brings a dish. Find a day and a kitchen that fits.', group: 6 },
  { key: 'trip', icon: Map, src: 'preset:meadow', from: '', to: '', title: 'Weekend Trip', body: 'Pick the dates together, vote on where to go, and share the costs.', group: 4 },
  { key: 'offsite', icon: Route, src: 'preset:coast', from: '', to: '', title: 'Team Offsite', body: 'A few days away. Find the dates, vote on where to go, and plan each stop.', group: 6 },
  { key: 'one-on-one', icon: Repeat, src: 'preset:garden', from: '', to: '', title: 'Recurring 1:1', body: 'A regular time for two people that stays in sync with both calendars.', group: 2 },
  { key: 'conference', icon: Presentation, src: 'preset:city', from: '', to: '', title: 'Conference Or Summit', body: 'Lots of people and a full agenda. Keep track of who shows up to what.', group: 6 },
]

/* example people for a template's group: drawn faces in the identity colours, the
   same every visit (seeded from the template). Decorative: they show the size of the
   group, nobody real. */
const NAMES = ['Sam', 'Ava', 'Noor', 'Ben', 'Kai', 'Liv', 'Ezra', 'Mia']
const COLORS = Object.keys(personColors) as PersonColor[]
function groupOf(key: string, n: number): Participant[] {
  return Array.from({ length: n }, (_, i) => {
    const name = NAMES[(i + key.length) % NAMES.length]
    return { id: `${key}-${i}`, name, initials: name[0], color: COLORS[(i * 3 + key.length) % COLORS.length], rsvp: 'pending', face: faceFor(`${key}:${i}`) }
  })
}

export default function TemplatesPage() {
  const looks: Look[] = []
  TEMPLATES.forEach((t, i) => looks.push(lookOf(`template-${t.key}`, i, looks[i - 1])))
  return (
    <div className="mx-auto max-w-[1240px] px-6 pb-[92px] pt-[34px] sm:px-[26px]">
      <div className="relative isolate -mt-[34px] mb-12 pb-7 pt-[34px]">
        <SoftShapes variant="plan" />
        <h1 className="mb-1.5 font-serif font-normal text-[36px] leading-[1.02] tracking-[-0.01em] sm:text-[40px]">Templates</h1>
        <p className="max-w-[560px] text-[14px] leading-[1.55] text-dim">
          Pick the kind of get-together for a head start. Every detail stays yours to change.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
        {TEMPLATES.map((t, i) => {
          const Icon = t.icon
          const look = looks[i]
          return (
            <PeekCard key={t.key} people={groupOf(t.key, t.group)} size={38} restShow={26} upShow={33} tilt={look.tilt} className="h-full">
              <PhotoFrame tilt={look.tilt} tape={false} pad={look.pad} className="h-full [&>div]:flex [&>div]:h-full [&>div]:flex-col">
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
            </PeekCard>
          )
        })}
        {/* the way out of every template gallery: an empty frame, waiting for your own */}
        <PhotoFrame tilt={1.2} tape={false} className="h-full sm:mt-[42px] [&>div]:flex [&>div]:h-full [&>div]:flex-col">
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
