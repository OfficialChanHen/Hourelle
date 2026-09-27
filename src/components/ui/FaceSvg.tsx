import { personVar, type PersonColor } from '@/lib/colors'
import { ACCESSORIES, EYES, HAIR, LINE, MOUTHS, SHAPES, type Face, type FacePart } from '@/lib/faces'

/* One face, drawn. The shape is filled with the person's colour and every feature
   is drawn in that colour's feature shade. Both are theme variables (--person-*), so
   a face is a pale chip on paper and a deeper, quieter one on charcoal.

   The paths are drawn for a shape that spans 1 to 39 of the 40 box, which leaves
   room for a blob's bulge or a tuft of hair. With `ringColor` the face is scaled
   down a little and outlined in that colour, `ringWidth` pixels wide at any size: the ring
   follows the shape, which is what separates one face from the next in a pile.

   One line weight at every size: the strokes scale with the box and nothing thickens
   for small faces, so a room of faces reads as one even hand. The box is always a
   whole number of pixels, since a fractional one smears every edge. */
export function FaceSvg({
  face,
  color,
  size: rawSize,
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
  const size = Math.max(1, Math.round(rawSize))
  const c = personVar(color)
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
  return (
    <svg
      width={size} height={size} viewBox="0 0 40 40" aria-hidden focusable="false"
      shapeRendering="geometricPrecision" className={className} style={{ display: 'block', flex: 'none' }}
    >
      <g transform={`translate(20 20) scale(${k}) translate(-20 -20)`}>
        {ringColor && <path d={shape} style={{ fill: ringColor, stroke: ringColor }} strokeWidth={2 * r} strokeLinejoin="round" />}
        <path d={shape} style={{ fill: c.bg }} />
        {hair && <path d={hair} style={{ fill: c.text }} />}
        <Part part={eyes} ink={c.text} />
        <path d={mouth} style={{ stroke: c.text }} strokeWidth={LINE} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <Part part={extra} ink={c.text} />
      </g>
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
