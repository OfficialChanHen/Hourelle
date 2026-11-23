/* Scraps of coloured paper behind a page region, torn and laid down like the backing
   pieces on a scrapbook page: a wide strip, a cap torn along its bottom, a patch torn
   on every side, a page ripped from a notebook or a square of graph paper. They are
   the shape tokens (--shape-a green, --shape-b pink, --shape-c warm sand) on the same
   paper stock as the page, over a lighter rim where the paper tore (globals.css,
   `.scrap`). Decoration only: hidden from screen readers, takes no pointer, and sits
   under everything in its region. The parent needs `relative isolate` so the scraps
   stay behind its content and are clipped to it, which also keeps them from ever
   widening the page. High contrast hides them.

   A tear tiles along its edge, so it keeps its scale on a phone and across a wide
   desktop row while the box is given in percentages. Scraps turn a little from
   1024px up and lie straight on a phone. Text sits on them, so the shape tokens are
   kept pale enough for dim and faint text to clear 4.5:1. */

type Scrap = {
  // which edges tore: top and bottom, the bottom only, or every side
  tear: 'tb' | 'b' | 'all'
  fill: string
  paper?: 'lined' | 'grid'
  turn?: number
  box: React.CSSProperties
}

type Variant = 'home' | 'plan' | 'band' | 'shelf'

const VARIANTS: Record<Variant, Scrap[]> = {
  // Home: a green strip behind the greeting and Up next, a notebook page lower right.
  // The strip starts lower on a phone, where the headline takes two lines
  home: [
    { tear: 'tb', fill: 'var(--shape-a)', turn: -1, box: { left: '-8%', top: 'max(96px, calc(196px - 10vw))', width: '116%', height: '400px' } },
    { tear: 'all', fill: 'var(--s1)', paper: 'lined', turn: 2.5, box: { right: '-40px', bottom: '48px', width: '250px', height: '210px' } },
  ],
  // a shelf page (Plans, Templates, Demos): a sand cap torn along its bottom, a fixed
  // size whatever the heading holds, and a square of graph paper on the far side
  shelf: [
    { tear: 'b', fill: 'var(--shape-c)', box: { left: '-6%', top: '-40px', width: '112%', height: '214px' } },
    { tear: 'all', fill: 'var(--s1)', paper: 'grid', turn: 3, box: { right: '-56px', top: '-18px', width: '200px', height: '160px' } },
  ],
  // a plan: a sand cap behind the header, a small green patch on the far side
  plan: [
    { tear: 'b', fill: 'var(--shape-c)', box: { left: '-6%', top: '-40px', width: '112%', height: 'calc(100% + 40px)' } },
    { tear: 'all', fill: 'var(--shape-a)', turn: -2, box: { right: '-60px', top: '-20px', width: '210px', height: '170px' } },
  ],
  // mid-page: a sand strip torn on both long edges behind the lower part of a section,
  // and a pink patch above it, so no edge is ever cut straight by the section box
  band: [
    { tear: 'tb', fill: 'var(--shape-c)', turn: 0.8, box: { left: '-8%', top: '28%', width: '116%', height: '70%' } },
    { tear: 'all', fill: 'var(--shape-b)', turn: 2, box: { right: '-50px', top: '8%', width: '190px', height: '150px' } },
  ],
}

export function SoftShapes({ variant, className = '' }: { variant: Variant; className?: string }) {
  return (
    <div aria-hidden className={`soft-shapes pointer-events-none absolute inset-y-0 left-1/2 -z-10 w-screen -translate-x-1/2 overflow-hidden ${className}`}>
      {VARIANTS[variant].map((s, i) => (
        <div
          key={i}
          className={`scrap scrap-${s.tear}${s.paper ? ` scrap-${s.paper}` : ''}`}
          style={{ ...s.box, '--scrap': s.fill, '--scrap-turn': `${s.turn ?? 0}deg` } as React.CSSProperties}
        >
          <span className="scrap-rim" />
          <span className="scrap-face" />
        </div>
      ))}
    </div>
  )
}
