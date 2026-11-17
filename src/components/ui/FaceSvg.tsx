import { personVar, type PersonColor } from '@/lib/colors'
import { ACCESSORIES, EYES, HAIR, LINE, MOUTHS, SHAPES, type Face, type FacePart } from '@/lib/faces'

/* One face, drawn. The shape is filled with the person's colour and every feature
   is drawn in that colour's ink. Both are theme variables (--person-*), so
   a face is a pale chip on paper and a deeper, quieter one on charcoal.

   Every face is a sticker: a die-cut edge (--face-edge) follows its own shape, and a
   small shadow (--face-lift) lifts it off the page. In a pile the edge is what keeps
   one face apart from the next, whatever the shapes are and whatever sits behind.
   The paths are drawn for a shape spanning 1 to 39 of the 40 box; the box shows
   2 units more on every side so the edge is never clipped.

   One line weight at every size: the strokes scale with the box and nothing thickens
   for small faces, so a room of faces reads as one even hand. The edge is the one
   exception (faceEdge below). The box is always a
   whole number of pixels, since a fractional one smears every edge. */
// how much of the die-cut edge shows outside the shape, in px: a twentieth of the
// face, but never under 1.5px, since a 1px edge on a small face lands across two
// pixel rows and blurs. Shared with the discs that stand in for a face (the initials
// on its back, the +N chip) so their edges match.
export const faceEdge = (size: number) => Math.max(size / 20, 1.5)

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
  return (
    <svg
      width={size} height={size} viewBox="-2 -2 44 44" aria-hidden focusable="false"
      shapeRendering="geometricPrecision" className={className}
      style={{ display: 'block', flex: 'none', overflow: 'visible', filter: 'var(--face-lift)' }}
    >
      {/* the edge: stroked under the fill, so only its outer half shows */}
      <path d={shape} style={{ fill: c.bg, stroke: 'var(--face-edge)' }} strokeWidth={(faceEdge(size) * 88) / size} strokeLinejoin="round" paintOrder="stroke" />
      {hair && <path d={hair} style={{ fill: c.ink }} />}
      <Part part={eyes} ink={c.ink} />
      <path d={mouth} style={{ stroke: c.ink }} strokeWidth={LINE} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Part part={extra} ink={c.ink} />
    </svg>
  )
}

function Part({ part, ink }: { part: FacePart; ink: string }) {
  return (
    <>
      {part.d && <path d={part.d} style={{ stroke: ink }} strokeWidth={LINE} strokeLinecap="round" strokeLinejoin="round" fill="none" />}
      {part.dots?.map(([cx, cy], i) => <circle key={`d${i}`} cx={cx} cy={cy} r={part.r ?? 1} style={{ fill: ink }} />)}
      {part.tint?.map(([cx, cy, rx, ry], i) => <ellipse key={`t${i}`} cx={cx} cy={cy} rx={rx} ry={ry} style={{ fill: ink }} fillOpacity={part.o} />)}
    </>
  )
}
