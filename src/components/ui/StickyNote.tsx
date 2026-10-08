import { useWide } from '@/hooks/useWide'

/* A post-it for "Your turn": its own warm paper (--sticky) and inks, square cut, a
   faint band where the glue is along the top, and a lifted bottom-right corner (a
   soft shadow under that corner only, and a slightly rounder cut there). It holds
   by its glue, so it never takes a pin or tape. `lift="bottom"` lifts the whole
   bottom edge instead, both corners cut alike and the shadow pooled under the lower
   half, as if the bottom had come a little off the page. For moments only, like the thing you still owe a
   plan on Home. The link or button inside stays a normal pill; the tilt is kept
   small (at most 2 degrees) so it still lands where a finger expects it. */
export function StickyNote({
  kicker,
  children,
  tilt = 1.5,
  lift = 'corner',
  className = '',
}: {
  kicker?: React.ReactNode
  children: React.ReactNode
  tilt?: number
  // which part comes off the page: the bottom right corner, or the whole bottom edge
  lift?: 'corner' | 'bottom'
  className?: string
}) {
  // turned a little on a wide screen; straight on a phone
  const wide = useWide()
  const deg = wide ? Math.max(-2, Math.min(2, tilt)) : 0
  return (
    <div className="relative" style={{ transform: `rotate(${deg}deg)` }}>
      {lift === 'corner' ? (
        /* the curl: the corner lifts off the page, so its shadow falls longer there */
        <span aria-hidden className="pointer-events-none absolute bottom-0.5 right-2 h-[40%] w-[55%] bg-sticky-curl blur-[7px]" style={{ transform: 'rotate(4deg) translate(2px, 5px)' }} />
      ) : (
        /* the whole bottom edge off the page: a shadow under the lower half only,
           deepest at the corners and falling a little below the note */
        <span aria-hidden className="pointer-events-none absolute inset-x-1.5 bottom-0 h-[48%] rounded-b-[14px] bg-sticky-curl blur-[8px]" style={{ transform: 'translateY(6px) scaleX(0.97)' }} />
      )}
      <div className={`relative flex flex-col gap-1.5 bg-sticky px-4 pb-4 text-sticky-text pt-8 ${lift === 'corner' ? 'rounded-[3px] rounded-br-[14px_8px] shadow-sticky' : 'rounded-t-[3px] rounded-b-[12px_7px]'} ${className}`}>
        {/* the glue band along the top; the writing starts below it */}
        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[22px] rounded-t-[3px] bg-sticky-band" />
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
