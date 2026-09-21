/* ── a photo, made small enough to keep ──
   The picked file can be anything a phone produces, which today means 3 to 12MB.
   None of that is stored: the picture is redrawn at 1280 on its longest side and
   encoded as a JPEG, which lands around 200 to 300KB. A busy picture that still
   comes out large is encoded again, smaller, so a cover never weighs more than
   about 450KB wherever it ends up: the bucket, or the event document when the
   bucket cannot be reached. The document is what every browser on the event keeps
   in its 5MB of localStorage, which is why the ceiling matters. */

// the most a picked file may weigh before it is even decoded: enough for any phone
// photo, and small enough that decoding one cannot exhaust a phone's memory
export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024
export const MAX_UPLOAD_LABEL = '12MB'
// what the picker offers. Safari converts a HEIC photo to JPEG on the way in when
// HEIC is not on the list, which is the only way an iPhone photo decodes anywhere.
export const ACCEPTED_IMAGE_TYPES = 'image/jpeg,image/png,image/webp'
const ACCEPTED = new Set(ACCEPTED_IMAGE_TYPES.split(','))
export function isAcceptedImage(f: File): boolean {
  if (f.type) return ACCEPTED.has(f.type)
  return /\.(jpe?g|png|webp)$/i.test(f.name) // some browsers hand over a file with no type
}

// the finished cover, as a data URL; base64 is a third larger than the bytes
const MAX_COVER_CHARS = Math.round((450 * 1024 * 4) / 3)
// each pass is smaller than the last; the last one is taken whatever it weighs
const PASSES: { max: number; q: number }[] = [
  { max: 1280, q: 0.82 },
  { max: 1280, q: 0.7 },
  { max: 1024, q: 0.7 },
  { max: 800, q: 0.66 },
]

export function downscaleImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      try {
        const c = document.createElement('canvas')
        const ctx = c.getContext('2d')
        if (!ctx) throw new Error('no canvas')
        let out = ''
        for (const pass of PASSES) {
          const scale = Math.min(1, pass.max / Math.max(img.width, img.height))
          c.width = Math.max(1, Math.round(img.width * scale))
          c.height = Math.max(1, Math.round(img.height * scale))
          ctx.fillStyle = '#fff' // a transparent PNG lands on paper, not on black
          ctx.fillRect(0, 0, c.width, c.height)
          ctx.drawImage(img, 0, 0, c.width, c.height)
          out = c.toDataURL('image/jpeg', pass.q)
          if (out.length <= MAX_COVER_CHARS) break
        }
        resolve(out)
      } catch (e) { reject(e) } finally { URL.revokeObjectURL(url) }
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That file could not be read as an image.')) }
    img.src = url
  })
}
