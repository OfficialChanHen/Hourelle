import type { ReactNode } from 'react'
import { Avatar, NameTag } from './Avatar'
import { FlipGroup } from './FlipGroup'
import type { Avatar as Person } from '@/lib/people'

/* A pile of faces, overlapping, capped. The cap is the point: a guest list is
   allowed to be long, and a row that grows with it would break the card it sits in
   and cost a DOM node per person. Past `max`, the rest become one "+N" chip.

   Each face is a sticker with its own die-cut edge (FaceSvg), so the next one in the
   pile sits on top of it like a sticker on a sticker, whatever is behind the pile.

   To a screen reader the pile is one image named for the people in it ("Jane Miller,
   Alex Tan and 3 more"). `decorative` hides it instead, for piles whose meaning is
   already carried by text beside them, like the count in a grid cell.

   `flippable` turns each face into a button that shows the initials on its back.
   The pile is then a group of named buttons rather than one image. Never inside a
   link or a button.

   `renderMore` makes the "+N" a control of its own: it is handed the chip and wraps it
   in a button (or a popover's trigger). On a flippable pile the chip then sits beside
   the row's flip button, not inside it, so a tap on "+N" opens the rest instead of
   turning the faces over. */

// "Jane", "Jane and Alex", "Jane, Alex and Sam", "Jane, Alex and 3 more"
export function namesLabel(names: string[], extra = 0): string {
  const parts = extra > 0 ? [...names, `${extra} more`] : names
  if (parts.length <= 1) return parts[0] ?? ''
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

// what a "+N" names on hover: everyone it stands for, never a few names and "N more"
// (the chip already gives the count). Past a dozen the count says it alone: null.
export function hiddenNames(names: string[]): string | null {
  return names.length && names.length <= 12 ? namesLabel(names) : null
}

export function AvatarRow({
  people,
  size = 21,
  max = 6,
  overlap = 6,
  more,
  font,
  decorative = false,
  flippable = false,
  renderMore,
}: {
  people: Person[]
  size?: number
  max?: number
  overlap?: number
  more?: string
  font?: number
  decorative?: boolean
  flippable?: boolean
  renderMore?: (chip: ReactNode) => ReactNode
}) {
  const shown = people.slice(0, max)
  const extra = more ?? (people.length > max ? `+${people.length - max}` : '')
  const extraCount = more != null ? parseInt(more.replace(/[^\d]/g, ''), 10) || 0 : Math.max(0, people.length - max)
  const label = namesLabel(shown.map((p) => p.name), extraCount)
  const hidden = hiddenNames(people.slice(max).map((p) => p.name))
  // a flippable pile is one button that turns every face over in order (FlipGroup)
  const flip = flippable && !decorative
  const chip = extra ? (
    <span
      // the same sticker as a face: a disc the size of the drawn face, with its edge
      style={{ width: size * 40 / 44, height: size * 40 / 44, margin: size / 22, boxShadow: `0 0 0 ${size / 20}px var(--face-edge)`, filter: 'var(--face-lift)', fontSize: font ?? Math.round(size * 0.4 * 10) / 10 }}
      className="group/face relative inline-flex flex-none items-center justify-center rounded-full bg-s3 font-semibold text-dim"
      aria-hidden
    >
      {extra}
      {/* on hover, the people the "+N" stands for, when this row has them; a "+N"
          that opens them all needs no tag */}
      {more == null && hidden && !renderMore && <NameTag list name={hidden} />}
    </span>
  ) : null
  const faces = shown.map((p, i) => (
    <span key={i} className="flex" style={{ marginRight: i === shown.length - 1 && !extra ? 0 : -overlap }}>
      <Avatar
        initials={p.initials} color={p.color} face={p.face} size={size} font={font} title={p.name} flippable={flip}
      />
    </span>
  ))
  if (chip && renderMore) {
    return (
      <div className="flex items-center">
        {flip
          ? <FlipGroup names={label} people={people} more={more != null ? extraCount : 0} className="flex items-center">{faces}</FlipGroup>
          : <div className="flex items-center" role={label ? 'img' : undefined} aria-label={label || undefined}>{faces}</div>}
        {renderMore(chip)}
      </div>
    )
  }
  if (flip) return <FlipGroup names={label} people={people} more={more != null ? extraCount : 0} className="flex items-center">{faces}{chip}</FlipGroup>
  return (
    <div
      className="flex items-center"
      role={decorative || !label ? undefined : 'img'}
      aria-label={decorative || !label ? undefined : label}
      aria-hidden={decorative || !label ? true : undefined}
    >
      {faces}
      {chip}
    </div>
  )
}
