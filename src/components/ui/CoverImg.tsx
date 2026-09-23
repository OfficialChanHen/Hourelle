'use client'

import { useState, type CSSProperties } from 'react'

/* The photo inside a Cover. It lives in its own client file so Cover can stay a
   plain component the server renders: a picture that fails to load (a file since
   deleted, a dropped connection) takes itself out, and the event's wash behind it
   is what shows, rather than the browser's broken-image mark. */
export function CoverImg({ src, className, style, hidden }: { src: string; className: string; style?: CSSProperties; hidden?: boolean }) {
  const [failed, setFailed] = useState(false)
  if (failed) return null
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" aria-hidden={hidden || undefined} className={className} style={style} onError={() => setFailed(true)} />
}
