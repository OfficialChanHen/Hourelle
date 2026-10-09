/* The size a cover is drawn at in each place it shows, for a screen of a given width.
   The Style preview and the Position dialog draw from these, so what a host sees
   while choosing is the crop the app shows on the same screen. Each follows the
   layout it copies (measured off the real pages); change one when that layout does.

   - home: the closest plan on Home, the big photo card
   - homeSmall: the two plans beside it on a large screen (1024px up), the widest crop
   - card: a plan on the Plans shelf (one, two or three across, 120 tall; the width
     inside a frame of the middle border, a card's frame being the same width either way)
   - page: the plan page's header picture (leading the header on a phone, in the
     right-hand column from 768px)
   - row: a phone's compact plan row on Home (72 wide, as tall as its lines; below
     1024px), the one upright crop in the app */
export type CoverShape = { w: number; h: number }

export function coverShapes(vw: number): { home: CoverShape; homeSmall: CoverShape | null; card: CoverShape; page: CoverShape; row: CoverShape } {
  const home = vw < 640 ? vw - 68 : vw < 768 ? 460 : vw < 1024 ? Math.min(460, 0.545 * vw - 70) : Math.min(573, 0.54 * vw - 79)
  const homeSmall = vw < 1024 ? null : { w: vw < 1280 ? 372 : 392, h: 84 }
  // the Plans grid: page gutters and the gap between columns, inside the page's widest column
  const card = vw < 640 ? vw - 68 : vw < 1024 ? (vw - 132) / 2 : (Math.min(vw, 1240) - 193) / 3
  const page = vw < 640 ? { w: Math.min(vw - 52, 440), h: 150 }
    : vw < 768 ? { w: 440, h: 190 }
    : vw < 1024 ? { w: 280, h: 168 }
    : { w: 380, h: 214 }
  return {
    home: { w: Math.round(home), h: vw < 640 ? 112 : 160 },
    homeSmall,
    card: { w: Math.round(card), h: 120 },
    page,
    row: { w: 72, h: 96 },
  }
}

export type CoverPlace = { label: string; ratio: number }

/* The crops a preview shows: only the ones that look different. Home's card stands
   for every wide card (Home's smaller ones and the Plans shelf crop much the same
   way), then the plan page, then the upright phone list, always there because the
   people invited look at plans on their phones whatever screen the host is on.
   Where the cards and the plan page are within a quarter of each other's shape (a
   phone, a small tablet) they share one picture. */
export function coverPlaces(vw: number): CoverPlace[] {
  const s = coverShapes(vw)
  const cards = s.home.w / s.home.h, page = s.page.w / s.page.h
  const wide = Math.abs(cards - page) / Math.max(cards, page) < 0.25
    ? [{ label: 'Cards and plan page', ratio: cards }]
    : [{ label: 'Cards', ratio: cards }, { label: 'Plan page', ratio: page }]
  return [...wide, { label: 'Phone list', ratio: s.row.w / s.row.h }]
}
