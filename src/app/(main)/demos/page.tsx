'use client'

import { useEffect, useState } from 'react'
import { StoredEventCard } from '@/components/ui/StoredEventCard'
import { rich } from '@/components/ui/rich'
import { listDemos, sameDayLabelFor, type AppEvent } from '@/lib/events'
import { EventBack } from '@/components/EventBack'

/* ── the demo shelf: example events, grouped by the question they answer ──
   Every demo is a finished plan to walk through: the grid, the ballot, the roster
   and the chat are all there. Each card says what it is for and what to look at. */

type Group = { key: string; eyebrow: string; title: string; sub: string; tone: string; picks: Record<string, string> }

const GROUPS: Group[] = [
  {
    key: 'when', eyebrow: 'Finding a time', tone: 'text-teal-text',
    title: 'When can everyone make it?',
    sub: 'The availability grid in its three shapes: hours, half hours, and whole days.',
    picks: {
      'design-team-dinner': 'A **30-minute grid** with a **deadline** to settle by. Look for the **best window**, and who has not replied yet.',
      'cabin-trip': 'A **day poll**: whole days are the question, not hours. Look for the **longest run** everyone can make.',
      'brunch-at-mamas': 'The **place is already set**, so only the time is open. Look for how the plan narrows to one question.',
    },
  },
  {
    key: 'where', eyebrow: 'Picking a place', tone: 'text-ochre-text',
    title: 'Where should it happen?',
    sub: 'A ballot on a map, and what a vote turns into once it is won.',
    picks: {
      'harvest-fair': '**Three votes each** and a **closing date**, with a **cap on spots** and a **minimum to go ahead**. Look for the ballot and the capacity note.',
      'priyas-send-off': '**One vote each**, closing soon. Look for how the **leader** changes as the votes move.',
      'q3-offsite': 'Votes turned into a **three-stop route** with **travel time** between them. Look for the **itinerary**, and who makes every stop.',
    },
  },
  {
    key: 'who', eyebrow: "Who's coming", tone: 'text-accent-text',
    title: 'Once the plan is locked, who is in?',
    sub: 'The RSVP round, the roster, and the headcount through the day.',
    picks: {
      'sarahs-housewarming': 'Time and place **locked in**, replies due by an **RSVP deadline**. Look for the **roster** grouped by who is in, unsure, or out.',
      'trivia-night-anchor': 'A **fixed date and place** from the start. Look for the **RSVP round** and the **headcount**.',
      'shoreline-cleanup': 'A vote that **settled into a plan**. Look for **attendance**, and who **arrives late or leaves early**.',
    },
  },
]

export default function DemosPage() {
  const [demos, setDemos] = useState<AppEvent[] | null>(null)
  useEffect(() => { setDemos(listDemos()) }, [])
  const sameDay = demos ? sameDayLabelFor(demos) : () => undefined
  const byId = new Map((demos ?? []).map((d) => [d.id, d]))

  return (
    <div className="mx-auto max-w-[1240px] px-[26px] pb-[92px] pt-[34px]">
      <EventBack />
      <div className="mb-8 max-w-[640px]">
        <h1 className="mb-2 font-serif font-normal text-[36px] leading-[1.02] tracking-[-0.01em]">Demos</h1>
        <p className="text-[14px] leading-[1.6] text-dim">
          Nine finished plans, full of people and answers, grouped by the question each one answers. Open any of them and walk through every tab.
        </p>
      </div>

      {GROUPS.map((g, gi) => (
        <section key={g.key} className={gi > 0 ? 'mt-12' : ''}>
          <div className="mb-4 max-w-[640px]">
            <p className={`text-[11px] font-semibold uppercase tracking-[.13em] ${g.tone}`}>{g.eyebrow}</p>
            <h2 className="mt-1.5 font-serif text-[26px] leading-[1.08] tracking-[-0.01em]">{g.title}</h2>
            <p className="mt-1 text-[13.5px] leading-[1.55] text-dim">{g.sub}</p>
          </div>
          <div className="grid grid-cols-1 gap-[13px] sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(g.picks).map(([id, look]) => {
              const e = byId.get(id)
              return (
                <div key={id} className="flex flex-col gap-2.5">
                  {e ? (
                    <StoredEventCard e={e} sameDay={sameDay(e)} />
                  ) : (
                    <div className="h-[240px] animate-pulse rounded-[13px] bg-s2" />
                  )}
                  <p className="px-1 text-[12.5px] leading-[1.55] text-dim">{rich(look)}</p>
                </div>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
