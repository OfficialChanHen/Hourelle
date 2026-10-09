'use client'

import type { CSSProperties } from 'react'
import { personVar, type PersonColor } from '@/lib/colors'
import { defaultFace, ringGap, type Face } from '@/lib/faces'
import { useFaceFlip } from '@/hooks/useFaceFlip'
import { useInFlipGroup } from './FlipGroup'
import { FaceSvg } from './FaceSvg'

/* Somebody's face in their own colour. The colour and the face are decorative
   identity only: they say "this is the same person as that other face", never
   anything about their answer. Semantic states are Badge's job.

   `face` is the one they chose or were dealt on the event. Without one the face is
   drawn from their initials and colour, so every avatar is a face even where the
   caller only knows those two things.

   Sized in pixels rather than by a size token, because the contexts it appears in
   want genuinely different sizes: ~21px inline in a card, 26px in a roster row,
   34px in a guest list. `font` sizes the initials on the back of a flippable face.

   Hidden from screen readers by default: nearly everywhere it sits beside the
   person's name. Where the face is the only thing naming someone, pass `label` and
   it is read as an image of that name (or name the pile it sits in instead).

   `flippable` makes it a button that turns over to show the initials, so people can
   tell who is who. It is named for the person (`label`, else `title`). Only use it
   where the face is not already inside a link or a button.

   `tilt` turns the face a few degrees, like a sticker: for moments only (a plan's
   header, Home), never in a list of people or a grid. Capped at 3 degrees. */
export function Avatar({
  initials,
  color = 'gray',
  face,
  size: rawSize = 26,
  font,
  title,
  label,
  flippable = false,
  tilt,
}: {
  initials: string
  color?: PersonColor
  face?: Face
  size?: number
  font?: number
  title?: string
  label?: string
  flippable?: boolean
  tilt?: number
}) {
  const look = face ?? defaultFace(initials, color)
  // whole pixels only: a fractional box smears every edge of the drawing
  const size = Math.max(1, Math.round(rawSize))
  const turn = tilt ? `rotate(${Math.max(-3, Math.min(3, tilt))}deg)` : undefined
  // in a row of faces the row is the button (FlipGroup): this face draws both sides
  // and turns with the others, with no button of its own
  const inGroup = useInFlipGroup()
  if (flippable && inGroup) return <TurnFace initials={initials} color={color} face={look} size={size} font={font} turn={turn} title={title} />
  if (flippable) {
    return (
      <FlipFace
        initials={initials} color={color} face={look} size={size} font={font}
        name={label ?? title ?? initials} turn={turn}
      />
    )
  }
  return (
    <span
      title={title}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{ width: size, height: size, transform: turn }}
      className="inline-flex shrink-0 select-none"
    >
      <FaceSvg face={look} color={color} size={size} />
    </span>
  )
}

/* The face as a button: front is the face, back is the initials on the colour. The
   button is as big as the face, and a hit area around it reaches 44px, so a small
   face in a roster row is still easy to tap. */
function FlipFace({ initials, color, face, size, font, name, turn }: {
  initials: string; color: PersonColor; face: Face; size: number; font?: number; name: string; turn?: string
}) {
  const { scope, flipped, toggle } = useFaceFlip()
  const c = personVar(color)
  const reach = Math.max(0, (44 - size) / 2)
  return (
    <button
      ref={scope} type="button" onClick={toggle}
      aria-label={name} aria-pressed={flipped} title={name}
      style={{ width: size, height: size, perspective: size * 6, transform: turn, '--ring-gap': `${ringGap(size)}px` } as CSSProperties}
      className="face-ring relative block shrink-0 cursor-pointer select-none rounded-full p-0 [-webkit-tap-highlight-color:transparent]"
    >
      {reach > 0 && <span aria-hidden className="absolute" style={{ inset: -reach }} />}
      <span className="face-flip relative block h-full w-full" style={{ transformStyle: 'preserve-3d' }}>
        <span className="absolute inset-0" style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}>
          <FaceSvg face={face} color={color} size={size} />
        </span>
        <span
          aria-hidden
          className="absolute grid place-items-center rounded-full font-semibold leading-none"
          style={{
            // the back is the same sticker: a disc the size of the drawn face, with its edge
            inset: size / 22, boxShadow: `0 0 0 ${size / 20}px var(--face-edge)`, filter: 'var(--face-lift)',
            background: c.bg, color: c.text,
            fontSize: font ?? Math.round(size * 0.36 * 10) / 10,
            backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)',
          }}
        >
          {initials}
        </span>
      </span>
    </button>
  )
}

/* A face with both sides drawn and no button: it sits in a FlipGroup, which turns
   every .face-flip in its row. */
function TurnFace({ initials, color, face, size, font, turn, title }: {
  initials: string; color: PersonColor; face: Face; size: number; font?: number; turn?: string; title?: string
}) {
  const c = personVar(color)
  return (
    <span
      aria-hidden title={title}
      style={{ width: size, height: size, perspective: size * 6, transform: turn } as CSSProperties}
      className="relative block shrink-0 select-none rounded-full"
    >
      <span className="face-flip relative block h-full w-full" style={{ transformStyle: 'preserve-3d' }}>
        <span className="absolute inset-0" style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}>
          <FaceSvg face={face} color={color} size={size} />
        </span>
        <span
          className="absolute grid place-items-center rounded-full font-semibold leading-none"
          style={{
            inset: size / 22, boxShadow: `0 0 0 ${size / 20}px var(--face-edge)`, filter: 'var(--face-lift)',
            background: c.bg, color: c.text,
            fontSize: font ?? Math.round(size * 0.36 * 10) / 10,
            backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)',
          }}
        >
          {initials}
        </span>
      </span>
    </span>
  )
}
