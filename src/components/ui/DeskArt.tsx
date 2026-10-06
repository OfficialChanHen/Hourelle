import { PencilStar } from './Pencil'

/* A few things left on the desk beside the post-its: a pencil lying at an angle,
   a loose paper clip and a pencil star. Fills the space next to the pad on Home so
   it reads as a desk rather than a gap. No words, no numbers, nothing to tap;
   hidden from screen readers. Colours are the --art-* tokens (and --clip), so it
   follows every theme. Scales to the box it is given. */
export function DeskArt({ className = '' }: { className?: string }) {
  return (
    <div aria-hidden className={`pointer-events-none relative select-none ${className}`}>
      <svg viewBox="0 0 200 170" preserveAspectRatio="xMidYMid meet" className="absolute inset-0 h-full w-full overflow-visible">
        <defs>
          <filter id="desk-soft" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="2.4" /></filter>
        </defs>
        {/* the pencil, drawn lying along x and turned onto the desk */}
        <g transform="translate(28 128) rotate(-32)">
          <rect x="4" y="6" width="150" height="10" rx="5" fill="rgba(30,20,10,.22)" filter="url(#desk-soft)" />
          {/* eraser and the metal band */}
          <path d="M8 -7 H18 V7 H8 A7 7 0 0 1 8 -7 Z" style={{ fill: 'var(--art-eraser)' }} />
          <rect x="18" y="-7.4" width="13" height="14.8" style={{ fill: 'var(--art-ferrule)' }} />
          <path d="M22 -7.4 V7.4 M27 -7.4 V7.4" style={{ stroke: 'color-mix(in oklab, var(--art-ferrule) 70%, black)' }} strokeWidth=".8" />
          {/* the body: three facets of a hexagonal pencil, lit from above */}
          <rect x="31" y="-7" width="100" height="4.6" style={{ fill: 'color-mix(in oklab, var(--art-pencil) 72%, white)' }} />
          <rect x="31" y="-2.4" width="100" height="4.8" style={{ fill: 'var(--art-pencil)' }} />
          <rect x="31" y="2.4" width="100" height="4.6" style={{ fill: 'var(--art-pencil-dark)' }} />
          {/* the sharpened wood, scalloped where the paint was cut, and the lead */}
          <path d="M131 -7 Q133.5 -4.7 131 -2.4 Q133.5 0 131 2.4 Q133.5 4.7 131 7 L151 1.7 V-1.7 Z" style={{ fill: 'var(--art-wood)' }} />
          <path d="M151 -1.7 L158 0 L151 1.7 Z" style={{ fill: 'var(--art-lead)' }} />
        </g>
        {/* a paper clip, dropped */}
        <g transform="translate(132 112) rotate(24)">
          <path d="M5 40 V8 a3.5 3.5 0 0 1 7 0 V34 a2 2 0 0 1 -4 0 V12" fill="none" strokeWidth="2.2" strokeLinecap="round" className="stroke-clip" />
        </g>
      </svg>
      <PencilStar ink="graphite" size={22} className="absolute left-[14%] top-[6%] -rotate-6" />
    </div>
  )
}
