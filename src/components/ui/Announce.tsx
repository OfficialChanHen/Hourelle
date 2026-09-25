/* A visually hidden live region for feedback that otherwise only shows on screen,
   like a button reading "Copied" for a moment. Keep it mounted and change `text`:
   a screen reader speaks a region's new words, not one that appears already filled.
   An empty string says nothing, so `copied ? 'Link copied' : ''` is the usual shape. */
export function Announce({ text }: { text: string }) {
  return <span role="status" aria-live="polite" className="sr-only">{text}</span>
}
