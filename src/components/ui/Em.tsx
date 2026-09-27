/* The italic accent: a word or two inside a serif headline, set in italic and the
   accent ink. It is the one warm flourish the type gets, so it stays rare: the
   wordmark, the name in the Home greeting, and a handful of titles. Never a whole
   line, never body text, never two in one heading. The colour comes from --em, which
   a palette can quiet (Studio sets it to plain ink). */
export function Em({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <span className={`em-accent ${className}`}>{children}</span>
}

/* the wordmark: "Hour" upright, "elle" in the italic accent. Size and weight come
   from the caller, so the header, the footer and the sign-in card each set their own. */
export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`font-serif leading-none ${className}`}>
      Hour<Em>elle</Em>
    </span>
  )
}
