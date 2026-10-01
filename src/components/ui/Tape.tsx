/* A strip of translucent tape (--tape), holding a photo frame or a note to the
   page. Decoration only. Position it with `className` (it is absolutely placed);
   `tilt` turns it a few degrees so it reads as stuck on by hand. */
export function Tape({ className = '', tilt = 4, width = 72 }: { className?: string; tilt?: number; width?: number }) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute z-[2] block h-[20px] bg-tape ${className}`}
      style={{ width, transform: `rotate(${tilt}deg)` }}
    />
  )
}
