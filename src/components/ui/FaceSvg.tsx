import { personColors, type PersonColor } from '@/lib/colors'
import { ACCESSORIES, EYES, HAIR, MOUTHS, SHAPES, type Face } from '@/lib/faces'

/* One face, drawn. The shape is filled with the person's colour and every feature
   is drawn in that colour's text shade, so a face reads on both themes the way the
   initials chip did. The person palette is the one place hex is allowed.

   The paths are drawn for a shape that spans 1 to 39 of the 40 box, which leaves
   room for a blob's bulge or a tuft of hair. With `ringColor` the face is scaled
   down a little and outlined in that colour, `ringWidth` pixels wide at any size: the ring
   follows the shape, which is what separates one face from the next in a pile.

   Below 24px the strokes get a touch heavier, so eyes and mouth still read at 18. */
export function FaceSvg({
  face,
  color,
  size,
  ringColor,
  ringWidth = 2,
  className,
}: {
  face: Face
  color: PersonColor
  size: number
  ringColor?: string
  ringWidth?: number
  className?: string
}) {
  const c = personColors[color] ?? personColors.gray
  const shape = SHAPES[face.shape] ?? SHAPES.circle
  const eyes = EYES[face.eyes] ?? EYES.dots
  const mouth = MOUTHS[face.mouth] ?? MOUTHS.smile
  const hair = HAIR[face.hair] ?? ''
  const extra = ACCESSORIES[face.accessory] ?? ACCESSORIES.none
  // ring maths: the ring is the shape's own outline, stroked r units wide (half of
  // it outside), and everything is scaled by k so the outline just fits the box
  const u = ringColor ? (ringWidth * 40) / size : 0
  const r = ringColor ? (19 * u) / (20 - u) : 0
  const k = ringColor ? Math.round((20 / (19 + r)) * 10000) / 10000 : 1
  const boost = size < 24 ? 1.15 : 1
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden focusable="false" className={className} style={{ display: 'block', flex: 'none' }}>
      <g transform={`translate(20 20) scale(${k}) translate(-20 -20)`}>
        {ringColor && <path d={shape} style={{ fill: ringColor, stroke: ringColor }} strokeWidth={2 * r} strokeLinejoin="round" />}
        <path d={shape} fill={c.bg} />
        {hair && <path d={hair} fill={c.text} />}
        <path d={eyes.d} stroke={c.text} strokeWidth={eyes.w * boost} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d={mouth} stroke={c.text} strokeWidth={2.2 * boost} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        {extra.d && <path d={extra.d} stroke={c.text} strokeOpacity={extra.o} strokeWidth={extra.w * boost} strokeLinecap="round" fill="none" />}
      </g>
    </svg>
  )
}
