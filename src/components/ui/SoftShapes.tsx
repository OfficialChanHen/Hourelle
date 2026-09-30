/* Soft organic colour behind a page region: a couple of flat blobs in the shape
   tokens (--shape-a green, --shape-b peach, --shape-c warm sand), never a gradient.
   Decoration only: hidden from screen readers, takes no pointer, and sits under
   everything in its region. The parent needs `relative isolate` so the shapes stay
   behind its content and are clipped to it, which also keeps them from ever widening
   the page. High contrast hides them.

   Each blob is its own svg, stretched to a box given in percentages, so the same
   shape reads on a phone and across a wide desktop row. Text sits on them, so the
   shape tokens are kept pale enough for dim and faint text to clear 4.5:1. */

type Blob = { d: string; fill: string; box: React.CSSProperties }

// drawn on a 100 x 100 box, stretched to fit
const BAND = 'M0 18 C 18 6, 40 12, 58 20 C 78 29, 92 18, 100 24 L 100 78 C 84 90, 66 84, 48 80 C 28 76, 12 90, 0 84 Z'
const PEBBLE = 'M22 12 C 44 0, 84 6, 94 30 C 104 56, 86 88, 58 94 C 30 100, 4 84, 4 58 C 4 38, 8 20, 22 12 Z'
const CAP = 'M0 0 L 100 0 L 100 88 C 84 97, 64 91, 48 95 C 30 100, 14 93, 0 98 Z'

const VARIANTS: Record<'home' | 'plan', Blob[]> = {
  // Home: a green band behind the greeting and Up next, a peach pebble lower right
  home: [
    { d: BAND, fill: 'var(--shape-a)', box: { left: '-8%', top: '90px', width: '116%', height: '420px' } },
    { d: PEBBLE, fill: 'var(--shape-b)', box: { right: '-60px', bottom: '40px', width: '260px', height: '220px' } },
  ],
  // a plan: a warm sand cap behind the header, a small green pebble on the far side
  plan: [
    { d: CAP, fill: 'var(--shape-c)', box: { left: '-6%', top: '-40px', width: '112%', height: 'calc(100% + 40px)' } },
    { d: PEBBLE, fill: 'var(--shape-a)', box: { right: '-70px', top: '-30px', width: '220px', height: '180px' } },
  ],
}

export function SoftShapes({ variant, className = '' }: { variant: 'home' | 'plan'; className?: string }) {
  return (
    <div aria-hidden className={`soft-shapes pointer-events-none absolute inset-y-0 left-1/2 -z-10 w-screen -translate-x-1/2 overflow-hidden ${className}`}>
      {VARIANTS[variant].map((b, i) => (
        <svg key={i} viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute" style={b.box} focusable="false">
          <path d={b.d} style={{ fill: b.fill }} />
        </svg>
      ))}
    </div>
  )
}
