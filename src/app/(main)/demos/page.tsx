'use client'

import { useEffect, useState } from 'react'
import { StoredEventCard } from '@/components/ui/StoredEventCard'
import { rich } from '@/components/ui/rich'
import { listDemos, sameDayLabelFor, type AppEvent } from '@/lib/events'
import { EventBack } from '@/components/EventBack'
import { ShelfHeader } from '@/components/ui/ShelfHeader'
import { shelfLooks, type Look } from '@/components/ui/Keepsake'

/* ── the demo shelf: example events, grouped by the question they answer ──
   Every demo is a finished plan to walk through: the grid, the ballot, the roster
   and the chat are all there. Each card says what it is for and what to look at. */

type Group = { key: string; eyebrow: string; title: string; sub: string; tone: string; picks: Record<string, string> }

const GROUPS: Group[] = [
  {
    key: 'when', eyebrow: 'Finding a time', tone: 'text-teal-text',
    title: 'When can everyone make it?',
    sub: 'The availability grid in its shapes: whole days, half hours, and quarter hours.',
    picks: {
      'cabin-trip': 'A **weekend trip** run as a **day poll**: whole days are the question, not hours. Look for the **longest run** everyone can make.',
      'design-team-dinner': 'A **dinner** on a **30-minute grid** with a **deadline** to settle by. Look for the **best window**, and who has not replied yet.',
      'coffee-catch-up': 'A **1:1** at a café that is **already set**, so only the time is open. Look for the half hour that fits on a **15-minute grid**.',
    },
  },
  {
    key: 'where', eyebrow: 'Picking a place', tone: 'text-ochre-text',
    title: 'Where should it happen?',
    sub: 'A ballot on a map, and what a vote turns into once it is won.',
    picks: {
      'priyas-birthday': 'A **birthday** with Friday night booked and **one vote each** on the restaurant. Look for how the **leader** changes as the votes move.',
      'harvest-potluck': 'A **potluck** open to anyone, with **three votes each** on the park and a **closing date**. Look for the **cap on spots** and the **minimum to go ahead**.',
      'q3-offsite': 'A **team offsite** whose votes turned into a **three-stop route** with **travel time** between them. Look for the **itinerary**, and who makes every stop.',
    },
  },
  {
    key: 'who', eyebrow: "Who's coming", tone: 'text-accent-text',
    title: 'Once it is locked in, who is coming?',
    sub: 'The RSVP round, then the headcount through the day.',
    picks: {
      'board-game-night': 'A **game night** with the date and place **fixed from the start**. You are invited and have not replied. Look for the **RSVP deadline** and the **roster**.',
      'indie-makers-conference': 'A **conference** in one room all day. Look for **attendance** through the day, and who **arrives late or leaves early**.',
    },
  },
]

export default function DemosPage() {
  const [demos, setDemos] = useState<AppEvent[] | null>(null)
  useEffect(() => { setDemos(listDemos()) }, [])
  const sameDay = demos ? sameDayLabelFor(demos) : () => undefined
  const byId = new Map((demos ?? []).map((d) => [d.id, d]))
  // each photo's hand-laid detail, taken in turn across the shelves so every row
  // shows several kinds; the cards lie straight
  const ids = GROUPS.flatMap((g) => Object.keys(g.picks))
  const looks = new Map<string, Look>(shelfLooks(ids).map((l, i) => [ids[i], l]))

  return (
    <div className="mx-auto max-w-[1240px] px-6 pb-[92px] pt-[34px] sm:px-[26px]">
      <ShelfHeader title="Demos" before={<EventBack />}>
        <p className="mt-1.5 max-w-[640px] text-[14px] leading-[1.6] text-dim">
          Eight finished plans, one for each template, grouped by the question each one answers. Open any of them and walk through every tab.
        </p>
      </ShelfHeader>

      {GROUPS.map((g, gi) => (
        <section key={g.key} className={gi > 0 ? 'mt-16' : ''}>
          <div className="mb-8 max-w-[640px]">
            <p className={`text-[11px] font-semibold uppercase tracking-[.13em] ${g.tone}`}>{g.eyebrow}</p>
            <h2 className="mt-1.5 font-serif text-[26px] leading-[1.08] tracking-[-0.01em]">{g.title}</h2>
            <p className="mt-1 text-[13.5px] leading-[1.55] text-dim">{g.sub}</p>
          </div>
          <div className="grid grid-cols-1 gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(g.picks).map(([id, blurb]) => {
              const e = byId.get(id)
              return (
                <div key={id} className="flex flex-col gap-3">
                  {e ? (
                    <StoredEventCard e={e} sameDay={sameDay(e)} look={looks.get(id)} />
                  ) : (
                    <div className="h-[300px] animate-pulse rounded-2xl bg-s2" />
                  )}
                  {/* what to look for, written under the photo like an album caption */}
                  <p className="px-2 text-[13px] leading-[1.55] text-dim">{rich(blurb)}</p>
                </div>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
