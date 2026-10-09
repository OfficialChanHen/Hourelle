/* The size a cover is drawn at in each place it shows, for a screen of a given width.
   The Style preview and the Position dialog draw from these, so what a host sees
   while choosing is the crop the app shows on the same screen. Each follows the
   layout it copies; change one when that layout changes.

   - card: a plan on the Plans shelf (one, two or three across, 120 tall; the width
     inside a frame of the middle border, a card's frame being the same width either way)
   - page: the plan page's header picture (leading the header on a phone, in the
     right-hand column from 768px)
   - row: a phone's compact plan row on Home (72 wide, as tall as its lines; below
     1024px only), the one upright crop in the app */
export type CoverShape = { w: number; h: number }

export function coverShapes(vw: number): { card: CoverShape; page: CoverShape; row: CoverShape } {
  // the Plans grid: page gutters and the gap between columns, inside the page's widest column
  const card = vw < 640 ? vw - 68 : vw < 1024 ? (vw - 132) / 2 : (Math.min(vw, 1240) - 193) / 3
  const page = vw < 640 ? { w: Math.min(vw - 52, 440), h: 150 }
    : vw < 768 ? { w: 440, h: 190 }
    : vw < 1024 ? { w: 280, h: 168 }
    : { w: 380, h: 214 }
  return { card: { w: Math.round(card), h: 120 }, page, row: { w: 72, h: 96 } }
}
