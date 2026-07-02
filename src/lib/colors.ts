// Person avatar colors: warm & muted, decorative identity ONLY.
// Light bg + dark text so the chip reads on both themes. Never reuse for semantic meaning.
// Keys + hexes match the Gatherly Editorial reference palette.
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
