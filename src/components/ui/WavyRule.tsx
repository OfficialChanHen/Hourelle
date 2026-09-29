/* A hand-drawn wavy hairline between two parts of a page, in --border2. The wave is
   a mask over a plain fill, so it repeats to any width at one even rhythm and the
   colour still comes from the theme. Decoration only. */
const WAVE = encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="60" height="12" viewBox="0 0 60 12"><path d="M0 6 C 10 0, 20 0, 30 6 S 50 12, 60 6" stroke="black" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
)
const MASK = `url("data:image/svg+xml,${WAVE}") left center / 60px 12px repeat-x`

export function WavyRule({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`h-3 w-full bg-border2 ${className}`}
      style={{ mask: MASK, WebkitMask: MASK }}
    />
  )
}
