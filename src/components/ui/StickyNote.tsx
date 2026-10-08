import { Pushpin } from './Pushpin'
import { useWide } from '@/hooks/useWide'

/* A post-it for "Your turn": its own warm paper (--sticky) and inks, square cut, a
   faint band where the glue is along the top, and a lifted bottom-right corner (a
   soft shadow under that corner only, and a slightly rounder cut there). `pin`
   pushes a pin through the top. For moments only, like the thing you still owe a
   plan on Home. The link or button inside stays a normal pill; the tilt is kept
   small (at most 2 degrees) so it still lands where a finger expects it. */
export function StickyNote({
  kicker,
  children,
  tilt = 1.5,
  pin = false,
  className = '',
}: {
  kicker?: React.ReactNode
  children: React.ReactNode
  tilt?: number
  pin?: boolean
  className?: string
}) {
  // turned a little on a wide screen; straight on a phone
  const wide = useWide()
  const deg = wide ? Math.max(-2, Math.min(2, tilt)) : 0
  return (
    <div className="relative" style={{ transform: `rotate(${deg}deg)` }}>
      {/* the curl: the corner lifts off the page, so its shadow falls longer there */}
      <span aria-hidden className="pointer-events-none absolute bottom-0.5 right-2 h-[40%] w-[55%] bg-sticky-curl blur-[7px]" style={{ transform: 'rotate(4deg) translate(2px, 5px)' }} />
      <div className={`relative flex flex-col gap-1.5 rounded-[3px] rounded-br-[14px_8px] bg-sticky px-4 pb-4 text-sticky-text shadow-sticky pt-8 ${className}`}>
        {/* the glue band along the top; the writing starts below it */}
        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[22px] rounded-t-[3px] bg-sticky-band" />
        {pin && <Pushpin size={20} className="absolute -top-3 left-1/2 -translate-x-1/2" />}
        {kicker && (
          <span className="relative flex items-center gap-1.5 whitespace-nowrap text-[11.5px] font-bold uppercase tracking-[.08em] text-sticky-kicker">
            {kicker}
          </span>
        )}
        {children}
      </div>
    </div>
  )
}
