'use client'

/* ── where a host's own photo lives ──
   A cover used to travel inside the event document as a base64 data URL, which put
   it in localStorage with everything else. A downscaled JPEG is around 300KB, and
   base64 adds a third on top, so fourteen events with photos filled the roughly 5MB
   a browser gives an origin. Past that every write failed, silently, and the browser
   was left carrying plans it could no longer save.

   So a photo goes to Supabase Storage and the document keeps a URL. The bucket is
   public to read, because a share link has to show the cover to someone with no
   account, and writable only by a signed-in account, because uploading is a host
   action. Migration 0013 creates it.

   With no backend, or no session, or a bucket that has not been made yet, the data
   URL is still the fallback: the app has always worked with nothing configured and
   that does not change. What changes is that the fallback is now the exception. */

import { supabase, backendOn } from './db'
import { linkToken } from './events'

export const COVER_BUCKET = 'covers'

// the two questions about a cover string live in cover-kind.ts, with no client
// directive, because server-rendered pages ask them too and a function exported
// from a client module cannot be called from the server
import { isInlineCover } from './cover-kind'
export { isInlineCover, isPhotoCover } from './cover-kind'

/** A cover this app uploaded, as opposed to one typed in or carried from elsewhere.
 *  Only these are ours to delete. */
function ourUpload(url: string): boolean {
  return url.includes(`/storage/v1/object/public/${COVER_BUCKET}/`)
}

// the storage path inside the bucket, read back off a public URL
function pathOf(url: string): string | null {
  const marker = `/storage/v1/object/public/${COVER_BUCKET}/`
  const at = url.indexOf(marker)
  return at < 0 ? null : decodeURIComponent(url.slice(at + marker.length).split('?')[0])
}

// a data URL is base64 text; Storage wants the bytes
function blobOf(dataUrl: string): Blob | null {
  const m = /^data:([^;,]+)(;base64)?,([\s\S]*)$/.exec(dataUrl)
  if (!m) return null
  const type = m[1] || 'image/jpeg'
  if (!m[2]) return new Blob([decodeURIComponent(m[3])], { type })
  try {
    const bin = atob(m[3])
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return new Blob([bytes], { type })
  } catch {
    return null
  }
}

/** Can a photo go to the cloud from here? A backend, and a session to upload with. */
export async function canHostCovers(): Promise<boolean> {
  if (!backendOn) return false
  const { data } = await supabase!.auth.getSession()
  return !!data.session
}

/**
 * Put a downscaled photo in the bucket and hand back its public URL. Resolves null
 * when it could not go, for any reason at all: no backend, no session, no bucket,
 * a refused policy, a dropped connection. The caller then keeps the data URL, which
 * is what the app did before this existed, so nothing is ever lost to a failed
 * upload. The reason is logged rather than shown, because there is nothing the
 * person could do about it and the cover they chose is on screen either way.
 */
export async function uploadCover(eventId: string, dataUrl: string): Promise<string | null> {
  if (!backendOn || !isInlineCover(dataUrl)) return null
  const body = blobOf(dataUrl)
  if (!body) return null
  const { data: session } = await supabase!.auth.getSession()
  if (!session.session) return null
  // a fresh name every time: replacing a cover must not leave a cached copy of the
  // old one showing, and nothing else should ever be able to guess the path
  const path = `${eventId}/${linkToken(16)}.jpg`
  const { error } = await supabase!.storage.from(COVER_BUCKET).upload(path, body, {
    contentType: body.type || 'image/jpeg',
    cacheControl: '31536000', // the name changes when the picture does, so cache it for a year
    upsert: false,
  })
  if (error) {
    console.warn('hourelle: cover upload failed —', error.message)
    return null
  }
  const { data } = supabase!.storage.from(COVER_BUCKET).getPublicUrl(path)
  return data.publicUrl || null
}

/** Take a cover out of the bucket once nothing points at it. Best effort and silent:
 *  a cover that outlives its event costs a little space and nothing else, while an
 *  error here would interrupt something the person actually asked for. */
export async function removeCover(url?: string): Promise<void> {
  if (!backendOn || !url || !ourUpload(url)) return
  const path = pathOf(url)
  if (!path) return
  const { error } = await supabase!.storage.from(COVER_BUCKET).remove([path])
  if (error) console.warn('hourelle: cover delete failed —', error.message)
}

/** Everything under one event's folder, for when the event itself goes. */
export async function removeEventCovers(eventId: string): Promise<void> {
  if (!backendOn) return
  const { data, error } = await supabase!.storage.from(COVER_BUCKET).list(eventId)
  if (error || !data?.length) return
  await supabase!.storage.from(COVER_BUCKET).remove(data.map((f) => `${eventId}/${f.name}`))
}
