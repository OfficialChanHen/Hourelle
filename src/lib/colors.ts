// Person avatar colors: warm & muted, decorative identity ONLY.
// Light bg + dark text so the chip reads on both themes. Never reuse for semantic meaning.
export const personColors: Record<string, { bg: string; text: string }> = {
  sage:  { bg: '#D6E4D6', text: '#2E4A3C' }, clay:  { bg: '#ECD9CE', text: '#6B3F2A' },
  wheat: { bg: '#EFE4C9', text: '#6E5523' }, stone: { bg: '#E2DED3', text: '#4A463C' },
  rose:  { bg: '#EAD6D3', text: '#6E3B38' }, sky:   { bg: '#D6E1EA', text: '#2C4A5C' },
  plum:  { bg: '#E1D8E4', text: '#4A2F52' }, fern:  { bg: '#DCE6D2', text: '#3A5223' },
}

export type PersonColor = keyof typeof personColors
