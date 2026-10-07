import { Pushpin } from './Pushpin'

/* A post-it for "Your turn": its own warm paper (--sticky) and inks, square cut, a
   faint band where the glue is along the top, and a lifted bottom-right corner (a
   soft shadow under that corner only, and a slightly rounder cut there). `pin`
   pushes a pin through the top. `corner` is the way on a Deck hands its top note
   (its "1/2" button), set in the top line beside the kicker. For moments only, like
   the thing you still owe a plan on Home. The link or button inside stays a normal pill; the tilt is kept
   small (at most 2 degrees) so it still lands where a finger expects it. */
export function StickyNote({
  kicker,
  children,
  tilt = 1.5,
  pin = false,
  corner,
  pos,
  className = '',
}: {
  kicker?: React.ReactNode
  children: React.ReactNode
  tilt?: number
  pin?: boolean
  // the way on a Deck hands its top note ("1/2" and an arrow), set top right
  corner?: React.ReactNode
  // where this note sits in its pad, "1/2", set small in the top right
  pos?: string | null
  className?: string
}) {
  const deg = Math.max(-2, Math.min(2, tilt))
  return (
    <div className="relative" style={{ transform: `rotate(${deg}deg)` }}>
      {/* the curl: the corner lifts off the page, so its shadow falls longer there */}
      <span aria-hidden className="pointer-events-none absolute bottom-0.5 right-2 h-[40%] w-[55%] bg-sticky-curl blur-[7px]" style={{ transform: 'rotate(4deg) translate(2px, 5px)' }} />
      <div className={`relative flex flex-col gap-1.5 rounded-[3px] rounded-br-[14px_8px] bg-sticky px-4 pb-4 text-sticky-text shadow-sticky ${corner ? 'pt-6' : 'pt-8'} ${className}`}>
        {/* the glue band along the top; the writing starts below it */}
        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[22px] rounded-t-[3px] bg-sticky-band" />
        {pin && <Pushpin size={20} className="absolute -top-3 left-1/2 -translate-x-1/2" />}
        {(kicker || pos || corner) && (
          <span className="relative flex items-center gap-1.5 whitespace-nowrap text-[11.5px] font-bold uppercase tracking-[.08em] text-sticky-kicker">
            {kicker}
            {corner
              ? <span className="-mr-2 ml-auto normal-case tracking-normal">{corner}</span>
              : pos && <span aria-hidden className="ml-auto pl-2 text-[12px] font-medium normal-case tracking-normal tabular-nums text-sticky-dim">{pos}</span>}
          </span>
        )}
        {children}
      </div>
    </div>
  )
}
