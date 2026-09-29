import { personVar, type PersonColor } from '@/lib/colors'
import { ACCESSORIES, EYES, HAIR, LINE, MOUTHS, SHAPES, lineFor, type Face, type FacePart } from '@/lib/faces'

/* One face, drawn. The shape is filled with the person's colour and every feature
   is drawn in that colour's ink. Both are theme variables (--person-*), so
   a face is a pale chip on paper and a deeper, quieter one on charcoal.

   The paths are drawn for a shape that spans 1 to 39 of the 40 box, which leaves
   room for a blob's bulge or a tuft of hair. In a pile, faces are separated by a
   see-through notch (pileCut in AvatarRow), not by anything drawn here.

   Lines are never thinner than two screen pixels (lineFor), so small faces stay
   sharp and every face in a room shares one stroke, like an icon set. Dots grow with
   the line so eyes keep their weight next to a mouth. The box is always a whole
   number of pixels, since a fractional one smears every edge. */
export function FaceSvg({
  face,
  color,
  size: rawSize,
  className,
}: {
  face: Face
  color: PersonColor
  size: number
  className?: string
}) {
  const size = Math.max(1, Math.round(rawSize))
  const c = personVar(color)
  const shape = SHAPES[face.shape] ?? SHAPES.circle
  const eyes = EYES[face.eyes] ?? EYES.dots
  const mouth = MOUTHS[face.mouth] ?? MOUTHS.smile
  const hair = HAIR[face.hair] ?? ''
  const extra = ACCESSORIES[face.accessory] ?? ACCESSORIES.none
  const line = lineFor(size)
  return (
    <svg
      width={size} height={size} viewBox="0 0 40 40" aria-hidden focusable="false"
      shapeRendering="geometricPrecision" className={className} style={{ display: 'block', flex: 'none' }}
    >
      <path d={shape} style={{ fill: c.bg }} />
      {hair && <path d={hair} style={{ fill: c.ink }} />}
      <Part part={eyes} ink={c.ink} line={line} />
      <path d={mouth} style={{ stroke: c.ink }} strokeWidth={line} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Part part={extra} ink={c.ink} line={line} />
    </svg>
  )
}

function Part({ part, ink, line }: { part: FacePart; ink: string; line: number }) {
  const r = (part.r ?? 1) * (line / LINE)
  return (
    <>
      {part.d && <path d={part.d} style={{ stroke: ink }} strokeWidth={line} strokeLinecap="round" strokeLinejoin="round" fill="none" />}
      {part.dots?.map(([cx, cy], i) => <circle key={`d${i}`} cx={cx} cy={cy} r={r} style={{ fill: ink }} />)}
      {part.tint?.map(([cx, cy, rx, ry], i) => <ellipse key={`t${i}`} cx={cx} cy={cy} rx={rx} ry={ry} style={{ fill: ink }} fillOpacity={part.o} />)}
    </>
  )
}
