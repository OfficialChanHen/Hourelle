import { personColors, type PersonColor } from '@/lib/colors'

/* Somebody's initials in their own colour. The colour is decorative identity only:
   it says "this is the same person as that other chip", never anything about their
   answer. Semantic states are Badge's job.

   Sized in pixels rather than by a size token, because the three contexts it appears
   in want genuinely different sizes: ~21px inline in a card, 26px in a roster row,
   34px in a guest list. The font follows the box unless `font` overrides it.

   `ring` is for piles: a 2px ring in the surface colour behind the pile is what
   separates overlapping avatars, so it has to be told which surface it sits on. */
export function Avatar({
  initials,
  color = 'gray',
  size = 26,
  font,
  ring = false,
  ringColor = 'var(--s1)',
  title,
}: {
  initials: string
  color?: PersonColor
  size?: number
  font?: number
  ring?: boolean
  ringColor?: string
  title?: string
}) {
  const c = personColors[color] ?? personColors.gray
  return (
    <span
      title={title}
      style={{
        background: c.bg,
        color: c.text,
        width: size,
        height: size,
        fontSize: font ?? Math.round(size * 0.36 * 10) / 10,
        border: ring ? `2px solid ${ringColor}` : undefined,
      }}
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold leading-none select-none"
    >
      {initials}
    </span>
  )
}
