// Warm placeholder cover — mirrors the reference's generated SVG (gradient + soft circles)
export function Cover({
  from,
  to,
  className = '',
  rounded = '',
}: {
  from: string
  to: string
  className?: string
  rounded?: string
}) {
  return (
    <div
      className={`relative overflow-hidden ${rounded} ${className}`}
      style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
    >
      <span className="absolute -right-6 -top-10 h-32 w-32 rounded-full" style={{ background: 'rgba(255,255,255,.22)' }} />
      <span className="absolute -bottom-8 left-4 h-20 w-20 rounded-full" style={{ background: 'rgba(46,74,60,.07)' }} />
    </div>
  )
}
