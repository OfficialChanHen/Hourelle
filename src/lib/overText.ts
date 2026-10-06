/** Whether a point on screen is over a glyph of text, not just inside a box that
 *  holds text: a click in the empty end of a line or between lines is not "on the
 *  text". Asks the browser for the caret nearest the point, then checks the box of
 *  the characters either side of it. */
export function overText(x: number, y: number): boolean {
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null
    caretRangeFromPoint?: (x: number, y: number) => Range | null
  }
  let node: Node | null = null
  let offset = 0
  if (doc.caretPositionFromPoint) {
    const p = doc.caretPositionFromPoint(x, y)
    if (p) { node = p.offsetNode; offset = p.offset }
  } else if (doc.caretRangeFromPoint) {
    const r = doc.caretRangeFromPoint(x, y)
    if (r) { node = r.startContainer; offset = r.startOffset }
  }
  if (!node || node.nodeType !== Node.TEXT_NODE) return false
  const len = node.textContent?.length ?? 0
  const range = document.createRange()
  for (const i of [offset - 1, offset]) {
    if (i < 0 || i >= len) continue
    range.setStart(node, i)
    range.setEnd(node, i + 1)
    for (const b of Array.from(range.getClientRects())) {
      if (x >= b.left && x <= b.right && y >= b.top && y <= b.bottom) return true
    }
  }
  return false
}
