import { useWide } from '@/hooks/useWide'

/* A post-it: its own warm paper (--sticky) and inks, cut square with sharp corners
   like a real one, a faint band where the glue is along the top, and the bottom edge
   come a little off the page (the shadow pooled under the lower half). It holds by
   its glue, so it never takes a pin or tape. One look wherever a note appears, the
   landing page and Home alike. For moments only, like the thing you still owe a plan
   on Home. The link or button inside stays a normal pill; the tilt is kept small (at
   most 2 degrees) so it still lands where a finger expects it. */
export function StickyNote({
  kicker,
  children,
  tilt = 1.5,
  className = '',
}: {
  kicker?: React.ReactNode
  children: React.ReactNode
  tilt?: number
  className?: string
}) {
  // turned a little on a wide screen; straight on a phone
  const wide = useWide()
  const deg = wide ? Math.max(-2, Math.min(2, tilt)) : 0
  return (
    <div className="relative" style={{ transform: `rotate(${deg}deg)` }}>
      {/* the bottom edge off the page: a shadow under the lower half only, falling a
          little below the note */}
      <span aria-hidden className="pointer-events-none absolute inset-x-1.5 bottom-0 h-[48%] bg-sticky-curl blur-[8px]" style={{ transform: 'translateY(6px) scaleX(0.97)' }} />
      <div className={`relative flex flex-col gap-1.5 bg-sticky px-4 pb-4 text-sticky-text pt-8 ${className}`}>
        {/* the glue band along the top; the writing starts below it */}
        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[22px] bg-sticky-band" />
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
