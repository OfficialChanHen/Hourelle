'use client'

import { useState, type ReactNode } from 'react'
import { Avatar } from './Avatar'
import { Popover, PopoverTitle } from './Popover'
import type { Avatar as Person } from '@/lib/people'

/* A group as small chips, a face and a name each, wrapping across the width: what a
   "+N" opens into, so the people it stood for are still faces. Each chip opens that
   person's times when `onPerson` is given. Past `cap` it stops with "Show all N", so a
   group of a hundred draws a couple dozen until asked. `after` sits at the end of the
   chips (a caller's own show-more). */
type ChipPerson = Person & { id: string; you?: boolean }

export function FaceChips<P extends ChipPerson>({ people, onPerson, note, cap, after }: {
  people: P[]
  onPerson?: (id: string) => void
  // a few words after the name ("if need be")
  note?: (p: P) => ReactNode
  cap?: number
  after?: ReactNode
}) {
  const [all, setAll] = useState(false)
  const shown = cap && !all ? people.slice(0, cap) : people
  const more = cap && people.length > cap ? (
    <button type="button" aria-expanded={all} onClick={() => setAll((a) => !a)} className="relative h-8 self-start rounded-full px-1 text-[12.5px] font-semibold text-accent-text before:absolute before:-inset-y-1.5 before:inset-x-0 before:content-[''] hover:underline">
      {all ? 'Show fewer' : `Show all ${people.length}`}
    </button>
  ) : null
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {shown.map((p) => {
        const inner = <>
          <Avatar initials={p.initials} color={p.color} face={p.face} size={24} font={9} />
          <span className="min-w-0 truncate text-[13px]">{p.name}{p.you && <span className="text-faint"> (You)</span>}{note?.(p)}</span>
        </>
        const cls = 'relative flex h-8 max-w-full items-center gap-2 rounded-full border border-border bg-s0 pl-1 pr-3'
        // a chip is a button only when it opens something
        return onPerson ? (
          <button
            key={p.id} type="button" onClick={() => onPerson(p.id)} title={`See when ${p.name} is free`}
            className={`${cls} before:absolute before:-inset-y-1.5 before:inset-x-0 before:content-[''] hover:border-border2 hover:bg-s2 sm:before:hidden`}
          >
            {inner}
          </button>
        ) : <span key={p.id} className={cls}>{inner}</span>
      })}
      {more}
      {after}
    </div>
  )
}

/* A "+N" that opens the whole group as face chips in a small panel: for piles in a
   header or on a card, where the group opening in place would push everything
   around it. A chip that opens someone's times closes the panel first. */
export function FaceChipsMore<P extends ChipPerson>({ chip, people, title, onPerson, note }: {
  chip: ReactNode
  people: P[]
  title: string
  onPerson?: (id: string) => void
  note?: (p: P) => ReactNode
}) {
  return (
    <Popover
      align="start" width={320} label={`Show all ${people.length}`}
      className="relative block cursor-pointer rounded-full before:absolute before:-inset-1.5 before:content-['']"
      trigger={() => chip}
    >
      {(close) => (
        <>
          <PopoverTitle>{title}</PopoverTitle>
          <div className="p-1.5">
            <FaceChips people={people} cap={24} note={note} onPerson={onPerson ? (id) => { close(); onPerson(id) } : undefined} />
          </div>
        </>
      )}
    </Popover>
  )
}
