'use client'

import { useEffect, useRef, useState } from 'react'
import { ImagePlus, Loader2 } from 'lucide-react'
import { Cover, COVER_PRESETS } from './Cover'
import { ACCEPTED_IMAGE_TYPES, MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL, downscaleImage, isAcceptedImage } from '@/lib/image'
import { removeCover, uploadCover } from '@/lib/covers'
import { isInlineCover, isPhotoCover } from '@/lib/cover-kind'

export type ImageFit = 'fill' | 'fit'

/* One editor for the cover, shared by the create wizard and the event's details tab.
   The preset scenes, a photo of your own, and a preview drawn exactly the way the
   event card and the event page draw it, so what is chosen here is what the app
   shows. A photo also gets a choice of fill or fit: fill crops the picture to the
   frame, fit shows all of it on a soft blur of itself.

   WHERE THE PHOTO GOES. With an `eventId` and a session, a picked photo is uploaded
   and the event keeps a URL. Without either — the create wizard, where the event
   does not exist yet, or a browser with no backend — it stays a data URL and the
   wizard uploads it once the event is real. Either way the picture on screen is the
   same, which is why an upload that fails is not worth interrupting anybody over.

   A photo that is still a data URL is also moved, quietly, the first time its host
   opens this editor. That is the only way the covers already sitting in people's
   browsers ever leave them: the bytes are there, not on the server. */
export function CoverEditor({ image, fit = 'fill', title, eventId, onChange }: {
  image?: string
  fit?: ImageFit
  title: string
  // the event to file the photo under; absent in the wizard, where there is no event yet
  eventId?: string
  onChange: (patch: { image?: string; imageFit?: ImageFit }) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const preset = COVER_PRESETS.find((p) => image === `preset:${p.id}`)
  const photo = isPhotoCover(image)
  const from = preset?.from ?? '#E4EDE7', to = preset?.to ?? '#CFE0D5'
  const name = title.trim() || 'Your event'

  // move an old inline cover up, once, in the background. Keyed on the data URL so a
  // patch coming back through the parent cannot start it again, and a different
  // photo later still gets its turn.
  const moved = useRef<string | null>(null)
  useEffect(() => {
    if (!eventId || !isInlineCover(image) || moved.current === image) return
    const was = image as string
    moved.current = was
    void uploadCover(eventId, was).then((url) => { if (url) onChange({ image: url }) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, image])

  async function pickFile(f: File | undefined) {
    if (!f) return
    // refused before it is decoded: the kind, then the weight. Both are said on the
    // line under the buttons, so neither is a surprise.
    if (!isAcceptedImage(f)) { setErr('That file is not a JPG, PNG or WebP.'); return }
    if (f.size > MAX_UPLOAD_BYTES) { setErr(`That photo is over ${MAX_UPLOAD_LABEL}. Pick a smaller one.`); return }
    setBusy(true)
    const old = image
    try {
      const small = await downscaleImage(f)
      // the URL when it can be had, the bytes when it cannot; the person sees their
      // photo either way and never waits on the network to find out
      const hosted = eventId ? await uploadCover(eventId, small) : null
      moved.current = hosted ? null : small // an inline result is already this photo's turn, spent
      onChange({ image: hosted ?? small })
      setErr(null)
      // the picture it replaced is nobody's now
      if (isPhotoCover(old)) void removeCover(old)
    } catch {
      setErr('That file did not work. Try a JPG or PNG.')
    } finally {
      setBusy(false)
    }
  }

  // clearing the cover, or swapping to a preset scene, also releases the old photo
  function choose(patch: { image?: string; imageFit?: ImageFit }) {
    if ('image' in patch && patch.image !== image && isPhotoCover(image)) void removeCover(image)
    onChange(patch)
  }

  return (
    <div className="flex flex-col gap-3">
      {/* the preview: the card's frame and the event page's wider one, side by side */}
      <div className="grid gap-3 sm:grid-cols-[188px_minmax(0,1fr)]">
        <div className="overflow-hidden rounded-[13px] border border-border bg-s1 p-3.5">
          <Cover src={image} fit={fit} from={from} to={to} className="-mx-3.5 -mt-3.5 mb-3 h-[92px]" />
          <div className="truncate text-[14px] font-semibold tracking-[-0.01em]">{name}</div>
          <div className="mt-1 text-[11px] font-semibold uppercase tracking-[.13em] text-faint">On a card</div>
        </div>
        <div className="min-w-0">
          <Cover src={image} fit={fit} from={from} to={to} className="h-[92px] border border-border sm:h-[124px]" rounded="rounded-2xl" />
          <div className="mt-2 truncate font-serif text-[21px] leading-[1.1] tracking-[-0.01em]">{name}</div>
          <div className="mt-1 text-[11px] font-semibold uppercase tracking-[.13em] text-faint">On the event page</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {COVER_PRESETS.map((p) => {
          const on = image === `preset:${p.id}`
          return (
            <button
              key={p.id} type="button" title={p.name} aria-pressed={on}
              onClick={() => choose({ image: on ? undefined : `preset:${p.id}` })}
              className="overflow-hidden rounded-[8px]"
              style={{ boxShadow: on ? '0 0 0 2px var(--accent)' : '0 0 0 1px var(--border)' }}
            >
              <Cover src={`preset:${p.id}`} from={p.from} to={p.to} className="h-9 w-14" />
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={busy} onClick={() => fileRef.current?.click()} className="flex h-9 items-center gap-1.5 rounded-[9px] border border-border2 bg-s1 px-3 text-[13px] font-semibold hover:bg-s2 disabled:opacity-50 sm:h-8 sm:px-2.5 sm:text-[12.5px]">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
          {busy ? 'Adding' : photo ? 'Replace photo' : 'Upload a photo'}
        </button>
        {photo && (
          // fill crops to the frame; fit keeps the whole picture, letterboxed on a blur of itself
          <div className="flex rounded-[9px] border border-border bg-s1 p-0.5" role="group" aria-label="How the photo fills the frame">
            {([{ v: 'fill', l: 'Fill' }, { v: 'fit', l: 'Fit' }] as const).map((o) => (
              <button
                key={o.v} type="button" onClick={() => onChange({ imageFit: o.v })} aria-pressed={fit === o.v}
                className="flex h-8 items-center rounded-[7px] px-3 text-[13px] font-semibold transition-colors sm:h-7"
                style={fit === o.v ? { background: 'var(--accent)', color: 'var(--on-accent)' } : { color: 'var(--dim)' }}
              >
                {o.l}
              </button>
            ))}
          </div>
        )}
        {image && (
          <button type="button" onClick={() => choose({ image: undefined })} className="h-9 rounded-[9px] px-2.5 text-[13px] font-semibold text-brick-text hover:bg-brick-bg sm:h-8 sm:text-[12.5px]">Remove</button>
        )}
        <input ref={fileRef} type="file" accept={ACCEPTED_IMAGE_TYPES} className="hidden" onChange={(e) => { void pickFile(e.target.files?.[0]); e.target.value = '' }} />
      </div>
      {/* the one constraint, always there, and the refusal in its place when there is one */}
      {err
        ? <span className="text-[12px] text-brick-text">{err}</span>
        : <span className="text-[12px] text-faint">JPG, PNG or WebP up to {MAX_UPLOAD_LABEL}, resized before it is saved.</span>}
    </div>
  )
}
