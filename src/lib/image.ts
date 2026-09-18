/* A photo from the host's own device, made small enough to live in localStorage and
   travel inside the event document: longest side 1280, JPEG at 82%. A transparent
   PNG lands on white paper rather than black. Resolves a data URL. */
export function downscaleImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      try {
        const MAX = 1280
        const scale = Math.min(1, MAX / Math.max(img.width, img.height))
        const c = document.createElement('canvas')
        c.width = Math.max(1, Math.round(img.width * scale))
        c.height = Math.max(1, Math.round(img.height * scale))
        const ctx = c.getContext('2d')
        if (!ctx) throw new Error('no canvas')
        ctx.fillStyle = '#fff'
        ctx.fillRect(0, 0, c.width, c.height)
        ctx.drawImage(img, 0, 0, c.width, c.height)
        resolve(c.toDataURL('image/jpeg', 0.82))
      } catch (e) { reject(e) } finally { URL.revokeObjectURL(url) }
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That file could not be read as an image.')) }
    img.src = url
  })
}
