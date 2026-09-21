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
