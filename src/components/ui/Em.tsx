/* The italic accent: a word or two inside a serif headline, set in italic and the
   accent ink. It is the one warm flourish the type gets, so it stays rare: the
   one word in the Home headline, and a handful of titles. Never a whole
   line, never body text, never two in one heading. The colour comes from --em, which
   a palette can quiet (Studio sets it to plain ink). */
export function Em({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <span className={`em-accent ${className}`}>{children}</span>
}
