'use client'

import { useRef, useState } from 'react'
import { ImagePlus } from 'lucide-react'
import { Cover, COVER_PRESETS } from './Cover'
import { downscaleImage } from '@/lib/image'

export type ImageFit = 'fill' | 'fit'

/* One editor for the cover, shared by the create wizard and the event's details tab.
   The preset scenes, a photo of your own, and a preview drawn exactly the way the
   event card and the event page draw it, so what is chosen here is what the app
   shows. A photo also gets a choice of fill or fit: fill crops the picture to the
   frame, fit shows all of it on a soft blur of itself. */
export function CoverEditor({ image, fit = 'fill', title, onChange }: {
  image?: string
  fit?: ImageFit
  title: string
  onChange: (patch: { image?: string; imageFit?: ImageFit }) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [err, setErr] = useState<string | null>(null)
  const preset = COVER_PRESETS.find((p) => image === `preset:${p.id}`)
  const photo = !!image?.startsWith('data:')
  const from = preset?.from ?? '#E4EDE7', to = preset?.to ?? '#CFE0D5'
  const name = title.trim() || 'Your event'

  async function pickFile(f: File | undefined) {
    if (!f) return
    try {
      onChange({ image: await downscaleImage(f) })
      setErr(null)
    } catch {
      setErr('That file did not work. Try a JPG or PNG.')
    }
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
              onClick={() => onChange({ image: on ? undefined : `preset:${p.id}` })}
              className="overflow-hidden rounded-[8px]"
              style={{ boxShadow: on ? '0 0 0 2px var(--accent)' : '0 0 0 1px var(--border)' }}
            >
              <Cover src={`preset:${p.id}`} from={p.from} to={p.to} className="h-9 w-14" />
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => fileRef.current?.click()} className="flex h-9 items-center gap-1.5 rounded-[9px] border border-border2 bg-s1 px-3 text-[13px] font-semibold hover:bg-s2 sm:h-8 sm:px-2.5 sm:text-[12.5px]">
          <ImagePlus size={14} /> {photo ? 'Replace photo' : 'Upload a photo'}
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
          <button type="button" onClick={() => onChange({ image: undefined })} className="h-9 rounded-[9px] px-2.5 text-[13px] font-semibold text-brick-text hover:bg-brick-bg sm:h-8 sm:text-[12.5px]">Remove</button>
        )}
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { void pickFile(e.target.files?.[0]); e.target.value = '' }} />
      </div>
      {err && <span className="text-[12px] text-brick-text">{err}</span>}
    </div>
  )
}
