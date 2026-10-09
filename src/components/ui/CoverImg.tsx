'use client'

import { useEffect, useState, type CSSProperties } from 'react'

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

/* ── the colour behind a fitted photo ──
   A photo set to Fit shows whole, so a frame of a different shape has bands either
   side of it. They are filled with the photo's most common colour, so the picture
   reads as one piece with its frame. Worked out once per photo from a 32px copy
   (a millisecond or two) and remembered for the session; until then, or if the
   photo cannot be read (another site without CORS), the event's default wash
   behind shows instead. */
const swatches = new Map<string, Promise<string | null>>()

function swatchOf(src: string): Promise<string | null> {
  let p = swatches.get(src)
  if (!p) {
    p = new Promise((resolve) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.decoding = 'async'
      img.onload = () => {
        try {
          const n = 32
          const c = document.createElement('canvas')
          c.width = n; c.height = n
          const ctx = c.getContext('2d', { willReadFrequently: true })
          if (!ctx) return resolve(null)
          ctx.drawImage(img, 0, 0, n, n)
          const px = ctx.getImageData(0, 0, n, n).data
          // the most common colour, to 4 bits a channel, then the mean of its pixels,
          // so a photo of mostly sky gives the sky and not a muddy average
          const buckets = new Map<number, [number, number, number, number]>()
          let top: [number, number, number, number] | null = null
          for (let i = 0; i < px.length; i += 4) {
            if (px[i + 3] < 128) continue
            const k = ((px[i] >> 4) << 8) | ((px[i + 1] >> 4) << 4) | (px[i + 2] >> 4)
            const b = buckets.get(k) ?? [0, 0, 0, 0]
            b[0] += px[i]; b[1] += px[i + 1]; b[2] += px[i + 2]; b[3]++
            buckets.set(k, b)
            if (!top || b[3] > top[3]) top = b
          }
          resolve(top ? `rgb(${Math.round(top[0] / top[3])}, ${Math.round(top[1] / top[3])}, ${Math.round(top[2] / top[3])})` : null)
        } catch {
          resolve(null) // a tainted canvas: the photo came without CORS
        }
      }
      img.onerror = () => resolve(null)
      img.src = src
    })
    swatches.set(src, p)
  }
  return p
}

export function FitBackdrop({ src }: { src: string }) {
  const [color, setColor] = useState<{ src: string; c: string | null } | null>(null)
  useEffect(() => {
    let live = true
    void swatchOf(src).then((c) => { if (live) setColor({ src, c }) })
    return () => { live = false }
  }, [src])
  const c = color?.src === src ? color.c : null
  return c ? <span aria-hidden className="absolute inset-0" style={{ background: c }} /> : null
}
