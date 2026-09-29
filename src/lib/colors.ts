// Person avatar colors: warm & muted, decorative identity ONLY. Never reuse for semantic meaning.
// Keys + hexes match the Gatherly Editorial reference palette.
//
// These are the light-theme values, kept for anything that needs a raw colour
// (an email, a canvas). The UI paints people with personVar below: the same colours
// live in globals.css as --person-<key>-bg / --person-<key>-fg, redefined for every
// theme and appearance, so a face sits calmly on charcoal as well as on paper.
export const personColors = {
  purple: { bg: '#E1D8E4', text: '#4A2F52' },
  teal:   { bg: '#D6E4D6', text: '#2E4A3C' },
  coral:  { bg: '#ECD9CE', text: '#6B3F2A' },
  blue:   { bg: '#D6E1EA', text: '#2C4A5C' },
  amber:  { bg: '#EFE4C9', text: '#6E5523' },
  pink:   { bg: '#EAD6D3', text: '#6E3B38' },
  green:  { bg: '#DCE6D2', text: '#3A5223' },
  gray:   { bg: '#E2DED3', text: '#4A463C' },
} as const

export type PersonColor = keyof typeof personColors

/** A person colour as theme-aware CSS: the fill, the text shade (initials), and the
 *  ink the face's features are drawn in. Ink is softer than text in dark themes and
 *  the same as text everywhere else. An unknown key falls back on gray. */
export function personVar(color: string): { bg: string; text: string; ink: string } {
  const k = color in personColors ? color : 'gray'
  return { bg: `var(--person-${k}-bg)`, text: `var(--person-${k}-fg)`, ink: `var(--person-${k}-ink, var(--person-${k}-fg))` }
}
