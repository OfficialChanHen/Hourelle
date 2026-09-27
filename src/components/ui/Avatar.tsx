'use client'

import { personVar, type PersonColor } from '@/lib/colors'
import { defaultFace, type Face } from '@/lib/faces'
import { useFaceFlip } from '@/hooks/useFaceFlip'
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

   `ring` is for piles: a 2px ring in the surface colour behind the pile is what
   separates overlapping avatars, so it has to be told which surface it sits on.

   Hidden from screen readers by default: nearly everywhere it sits beside the
   person's name. Where the face is the only thing naming someone, pass `label` and
   it is read as an image of that name (or name the pile it sits in instead).

   `flippable` makes it a button that turns over to show the initials, so people can
   tell who is who. It is named for the person (`label`, else `title`). Only use it
   where the face is not already inside a link or a button. */
export function Avatar({
  initials,
  color = 'gray',
  face,
  size: rawSize = 26,
  font,
  ring = false,
  ringColor = 'var(--s1)',
  title,
  label,
  flippable = false,
}: {
  initials: string
  color?: PersonColor
  face?: Face
  size?: number
  font?: number
  ring?: boolean
  ringColor?: string
  title?: string
  label?: string
  flippable?: boolean
}) {
  const look = face ?? defaultFace(initials, color)
  // whole pixels only: a fractional box smears every edge of the drawing
  const size = Math.max(1, Math.round(rawSize))
  if (flippable) {
    return (
      <FlipFace
        initials={initials} color={color} face={look} size={size} font={font}
        ringColor={ring ? ringColor : undefined} name={label ?? title ?? initials}
      />
    )
  }
  return (
    <span
      title={title}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{ width: size, height: size }}
      className="inline-flex shrink-0 select-none"
    >
      <FaceSvg face={look} color={color} size={size} ringColor={ring ? ringColor : undefined} />
    </span>
  )
}

/* The face as a button: front is the face, back is the initials on the colour. The
   button is as big as the face, and a hit area around it reaches 44px, so a small
   face in a roster row is still easy to tap. */
function FlipFace({ initials, color, face, size, font, ringColor, name }: {
  initials: string; color: PersonColor; face: Face; size: number; font?: number; ringColor?: string; name: string
}) {
  const { scope, flipped, toggle } = useFaceFlip()
  const c = personVar(color)
  const reach = Math.max(0, (44 - size) / 2)
  return (
    <button
      ref={scope} type="button" onClick={toggle}
      aria-label={name} aria-pressed={flipped} title={name}
      style={{ width: size, height: size, perspective: size * 6 }}
      className="relative inline-block shrink-0 cursor-pointer select-none rounded-full p-0 outline-offset-2"
    >
      {reach > 0 && <span aria-hidden className="absolute" style={{ inset: -reach }} />}
      <span className="face-flip relative block h-full w-full" style={{ transformStyle: 'preserve-3d' }}>
        <span className="absolute inset-0" style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}>
          <FaceSvg face={face} color={color} size={size} ringColor={ringColor} />
        </span>
        <span
          aria-hidden
          className="absolute inset-0 grid place-items-center rounded-full font-semibold leading-none"
          style={{
            background: c.bg, color: c.text,
            fontSize: font ?? Math.round(size * 0.36 * 10) / 10,
            border: ringColor ? `2px solid ${ringColor}` : undefined,
            backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)',
          }}
        >
          {initials}
        </span>
      </span>
    </button>
  )
}
