import { useId } from 'react'

/* A round-headed pushpin seen from a little above: a shaded ball in --pin with a
   glint, a short steel needle going into the paper, and the shadow it casts falling
   down and to the right. Shading is the pin's material, not decoration: the light
   and dark of the ball are mixed from --pin, so every appearance gets its own pin.
   High contrast draws it flat (see .pushpin in globals.css).

   A drawn SVG rather than a 3D canvas: a pin is a few px of detail, there can be a
   handful on one screen, and each WebGL canvas costs a context the browser caps.
   `size` is the ball's diameter in px; the box is larger to hold needle and shadow.
   Decorative only, takes no pointer. */
export function Pushpin({ size = 18, className = '', style, ...rest }: { size?: number; className?: string; style?: React.CSSProperties; 'data-keep'?: string }) {
  const id = useId().replace(/:/g, '')
  const w = Math.round(size * 1.6)
  return (
    <svg
      aria-hidden focusable="false" viewBox="0 0 32 32" width={w} height={w}
      className={`pushpin pointer-events-none ${className}`} style={style} {...rest}
    >
      <defs>
        <radialGradient id={`${id}b`} cx="38%" cy="32%" r="68%">
          <stop offset="0" style={{ stopColor: 'color-mix(in oklab, var(--pin) 45%, white)' }} />
          <stop offset=".45" style={{ stopColor: 'var(--pin)' }} />
          <stop offset="1" style={{ stopColor: 'color-mix(in oklab, var(--pin) 62%, black)' }} />
        </radialGradient>
        <linearGradient id={`${id}n`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#8E8E8E" />
          <stop offset=".5" stopColor="#E4E4E4" />
          <stop offset="1" stopColor="#7A7A7A" />
        </linearGradient>
        <filter id={`${id}s`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.4" />
        </filter>
      </defs>
      {/* the shadow on the paper, cast down and right of where the needle goes in */}
      <ellipse className="pushpin-shadow" cx="18.5" cy="21.5" rx="8.5" ry="5" fill="rgba(30,20,10,.32)" filter={`url(#${id}s)`} />
      {/* the needle, mostly hidden by the ball, entering the paper */}
      <path d="M15.2 17 L17.6 23.4" stroke={`url(#${id}n)`} strokeWidth="1.5" strokeLinecap="round" />
      {/* the ball */}
      <circle className="pushpin-ball" cx="14" cy="13" r="10" fill={`url(#${id}b)`} />
      {/* the glint */}
      <ellipse cx="10.6" cy="9.2" rx="3.2" ry="2.1" transform="rotate(-35 10.6 9.2)" fill="white" fillOpacity=".7" />
    </svg>
  )
}
