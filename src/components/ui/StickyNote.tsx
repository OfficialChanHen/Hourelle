/* A sticky note for "Your turn": its own warm paper (--sticky) and inks, a kicker
   on top, a slight tilt. For moments only, like the thing you still owe a plan on
   Home. The link or button inside stays a normal pill; the tilt is kept small (at
   most 2 degrees) so it still lands where a finger expects it. */
export function StickyNote({
  kicker,
  children,
  tilt = 1.5,
  className = '',
}: {
  kicker?: string
  children: React.ReactNode
  tilt?: number
  className?: string
}) {
  const deg = Math.max(-2, Math.min(2, tilt))
  return (
    <div
      className={`flex flex-col gap-1.5 rounded-md bg-sticky px-3.5 pb-3.5 pt-3 text-sticky-text shadow-sticky ${className}`}
      style={{ transform: `rotate(${deg}deg)` }}
    >
      {kicker && <span className="text-[11.5px] font-bold uppercase tracking-[.08em] text-sticky-kicker">{kicker}</span>}
      {children}
    </div>
  )
}
