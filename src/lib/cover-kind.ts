/* What kind of cover a string is. Pure, and free of any client directive, because
   server-rendered pages (the templates list, cards drawn on the server) ask these
   questions too, and a function exported from a client module cannot be called
   from the server. Everything that touches Storage stays in covers.ts. */

/** A cover that is a photograph, wherever it is kept, as opposed to a preset scene
 *  or no cover at all. Every surface that sizes a frame differently for a photo asks
 *  this rather than testing for `data:`, so a hosted cover gets the same treatment. */
export function isPhotoCover(src?: string): boolean {
  return !!src && (src.startsWith('data:') || src.startsWith('http'))
}

/** A photo still carried inside the document, byte for byte. These are the ones
 *  costing storage, and the only ones worth offering to move. */
export function isInlineCover(src?: string): boolean {
  return !!src?.startsWith('data:')
}

// the default cover: a soft gradient picked by the event id, so the same event wears
// the same cover everywhere (cards, the home hero, the join page, its link preview)
const COVERS: [string, string][] = [
  ['#E4EDE7', '#CFE0D5'], ['#E7E2EE', '#D9CFE4'], ['#DEE7EC', '#C7DAE2'],
  ['#EFE7D6', '#E4D3B4'], ['#EEE1DD', '#E4CCC7'], ['#E4EADB', '#CDDCBB'],
]

export function coverFor(id: string): [string, string] {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return COVERS[h % COVERS.length]
}
