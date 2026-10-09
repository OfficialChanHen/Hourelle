'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Crop, ImagePlus, Loader2 } from 'lucide-react'
import { Cover, COVER_PRESETS } from './Cover'
import { Keepsake, DETAIL_CHOICES, lookOf, withDetail, type CardDetail } from './Keepsake'
import { CoverPosition, type Pos } from './CoverPosition'
import { HostTag } from './HostTag'
import { PhotoFrame } from './PhotoFrame'
import { useViewportWidth } from '@/hooks/useViewportWidth'
import { coverShapes } from '@/lib/cover-shapes'
import { useAccount } from '@/hooks/useAccount'
import { initialsOf, type Participant } from '@/lib/events'
import { ACCEPTED_IMAGE_TYPES, MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL, downscaleImage, isAcceptedImage } from '@/lib/image'
import { removeCover, uploadCover } from '@/lib/covers'
import { isInlineCover, isPhotoCover } from '@/lib/cover-kind'

export type ImageFit = 'fill' | 'fit'

/** The Style row's one-line summary: the cover, then the card's detail. */
export function styleSummary(image: string | undefined, fit: ImageFit | undefined, keepsake: CardDetail | undefined): string {
  const cover = isPhotoCover(image) ? `Your photo, ${fit === 'fit' ? 'fitted' : 'filling the frame'}` : image ? COVER_PRESETS.find((p) => image === `preset:${p.id}`)?.name ?? 'A scene' : 'No cover'
  const detail = keepsake ? DETAIL_CHOICES.find((d) => d.v === keepsake)?.label ?? 'Auto' : 'Auto detail'
  return `${cover}, ${keepsake === 'none' ? 'no detail' : detail.toLowerCase()}`
}

/* One editor for the card's style (its cover and the detail that holds it down),
   shared by the create wizard and the event's details tab. The cover:
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
export function CoverEditor({ image, fit = 'fill', pos, keepsake, title, eventId, onChange }: {
  image?: string
  fit?: ImageFit
  // which part of a cropped photo to keep; the middle when nothing has been chosen
  pos?: Pos
  // the detail on the card: pins, tape, a clip, photo corners, 'none', or absent for Auto
  keepsake?: CardDetail
  title: string
  // the event to file the photo under; absent in the wizard, where there is no event yet
  eventId?: string
  onChange: (patch: { image?: string; imageFit?: ImageFit; imagePos?: Pos; keepsake?: CardDetail }) => void
}) {
  const account = useAccount()
  const me = { id: 'me', name: account.name, initials: initialsOf(account.name), color: account.color, face: account.face, host: true, rsvp: 'attending' } as Participant

  const [posing, setPosing] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const preset = COVER_PRESETS.find((p) => image === `preset:${p.id}`)
  const photo = isPhotoCover(image)
  const from = preset?.from ?? '#E4EDE7', to = preset?.to ?? '#CFE0D5'
  const name = title.trim() || 'Your plan'
  // the card's look as it will be: Auto is what the plan's id deals (in the wizard,
  // before there is an id, a stand-in), else what was picked
  const auto = lookOf(eventId ?? 'new-plan', 0)
  const look = { ...withDetail(auto, keepsake), tilt: 0 }
  // the sizes each place draws the cover at on this screen, frame padding included
  const vw = useViewportWidth()
  const shapes = coverShapes(vw)
  const cardW = shapes.card.w + FRAME_PAD.mid, pageW = shapes.page.w + FRAME_PAD.mid, rowW = shapes.row.w + 16
  // on a phone the plan page's picture takes a line of its own under the other two
  const narrow = vw < 640
  // one scale for all three, so they keep their sizes against each other: as large
  // as the space allows, never larger than real
  const box = useRef<HTMLDivElement>(null)
  const [room, setRoom] = useState(0)
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const measure = () => setRoom(el.clientWidth)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const scale = !room ? 0 : Math.min(1, narrow
    ? Math.min((room - GAP - ROW_COL) / cardW, room / pageW)
    : (room - 2 * GAP - ROW_COL) / (cardW + pageW))

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
      {/* the cover in each place it shows, each drawn at its real size for this screen
          and scaled down to fit, so the crop and the detail's size match the app's */}
      <div
        ref={box}
        className="grid items-end gap-y-3"
        style={{ columnGap: GAP, gridTemplateColumns: narrow ? `${cardW * scale}px ${ROW_COL}px` : `${cardW * scale}px ${pageW * scale}px ${ROW_COL}px`, visibility: scale ? undefined : 'hidden' }}
      >
        <Preview label="On a card" w={cardW} scale={scale}>
          {/* a layer of its own around the frame (isolate, with no paint of its own), so
              a clip's back leg, drawn under the frame, tucks under this frame and not
              under the page: the same as a real card */}
          <div className="isolate">
            <PhotoFrame tilt={0} tape={false} pad={look.pad}>
              <div className="relative mb-3">
                <Cover src={image} fit={fit} pos={pos} from={from} to={to} className="h-[120px]" rounded="rounded-lg" />
                <Keepsake look={look} />
                {/* the name tag the card wears on Home and Plans; whoever edits the cover
                    hosts the plan, so it is always yours here */}
                <HostTag e={{ participants: [me], hostedByYou: true, hostName: account.name }} />
              </div>
              <div className="mb-[9px] truncate px-1 font-serif text-[20px] leading-[1.15] tracking-[-0.01em]">{name}</div>
            </PhotoFrame>
          </div>
        </Preview>
        <Preview label="On the plan page" w={pageW} scale={scale} className={narrow ? 'order-last col-span-2' : ''}>
          <div className="isolate">
            <PhotoFrame tilt={0} tape={false}>
              <div className="relative">
                <div style={{ height: shapes.page.h }}><Cover src={image} fit={fit} pos={pos} from={from} to={to} className="h-full" rounded="rounded-lg" /></div>
                <Keepsake look={look} />
              </div>
            </PhotoFrame>
          </div>
        </Preview>
        {/* a phone's Home lists its later plans as rows with an upright cover */}
        <Preview label="Phone list" w={rowW} scale={scale}>
          <div className="rounded-[14px] bg-frame p-2 shadow-frame">
            <div style={{ width: shapes.row.w, height: shapes.row.h }}><Cover src={image} fit={fit} pos={pos} from={from} to={to} className="h-full w-full" rounded="rounded-lg" /></div>
          </div>
        </Preview>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {COVER_PRESETS.map((p) => {
          const on = image === `preset:${p.id}`
          return (
            <button
              key={p.id} type="button" title={p.name} aria-label={`${p.name} cover`} aria-pressed={on}
              onClick={() => choose({ image: on ? undefined : `preset:${p.id}` })}
              className="overflow-hidden rounded-[8px]"
              style={{ boxShadow: on ? '0 0 0 2px var(--accent)' : '0 0 0 1px var(--border)' }}
            >
              <Cover src={`preset:${p.id}`} from={p.from} to={p.to} className="h-9 w-14" />
            </button>
          )
        })}
      </div>

      {/* the detail on the card, the same way: small cards to pick from */}
      <div className="mt-1">
        <div className="mb-1.5 text-[12.5px] font-semibold text-dim">Card detail</div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Card detail">
          {([{ v: undefined, label: 'Auto' }, ...DETAIL_CHOICES] as { v: CardDetail | undefined; label: string }[]).map((d) => {
            const on = keepsake === d.v
            const tile = { ...withDetail(auto, d.v), tilt: 0, len: 30, pad: 'thin' as const }
            return (
              <button
                key={d.label} type="button" aria-pressed={on} onClick={() => onChange({ keepsake: d.v })}
                className="flex w-[76px] flex-col items-center gap-1 rounded-xl p-1 text-[11.5px] font-medium text-dim hover:text-text"
                style={{ boxShadow: on ? '0 0 0 2px var(--accent)' : undefined, color: on ? 'var(--text)' : undefined }}
              >
                {/* a small framed cover with that detail, drawn at well under half size
                    with room around it, so tape reaching past the frame still shows */}
                <span aria-hidden className="relative block h-[50px] w-[68px] overflow-hidden rounded-[8px]">
                  <span className="absolute left-0 top-0 block w-[160px] origin-top-left scale-[.425] p-4">
                    <span className="block rounded-[10px] bg-frame p-2.5 shadow-frame">
                      <span className="relative block">
                        <Cover src={image} fit={fit} pos={pos} from={from} to={to} className="h-[64px]" rounded="rounded-md" />
                        <Keepsake look={tile} />
                      </span>
                    </span>
                  </span>
                </span>
                {d.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={busy} onClick={() => fileRef.current?.click()} className="flex h-9 items-center gap-1.5 rounded-full border border-border2 bg-s1 px-3 text-[13px] font-semibold hover:bg-s2 disabled:opacity-50 sm:h-8 sm:px-2.5 sm:text-[12.5px]">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
          {busy ? 'Adding' : photo ? 'Replace photo' : 'Upload a photo'}
        </button>
        {photo && (
          // fill crops to the frame; fit keeps the whole picture, letterboxed on a blur of itself
          <div className="flex rounded-full border border-border bg-s1 p-0.5" role="group" aria-label="How the photo fills the frame">
            {([{ v: 'fill', l: 'Fill' }, { v: 'fit', l: 'Fit' }] as const).map((o) => (
              <button
                key={o.v} type="button" onClick={() => onChange({ imageFit: o.v })} aria-pressed={fit === o.v}
                className="flex h-8 items-center rounded-full px-3 text-[13px] font-semibold transition-colors sm:h-7"
                style={fit === o.v ? { background: 'var(--accent)', color: 'var(--on-accent)' } : { color: 'var(--dim)' }}
              >
                {o.l}
              </button>
            ))}
          </div>
        )}
        {/* only Fill crops, so only Fill has anything to position: a fitted photo is
            shown whole and there is nothing being lost to choose between */}
        {photo && fit !== 'fit' && (
          <button type="button" onClick={() => setPosing(true)} className="flex h-9 items-center gap-1.5 rounded-full border border-border2 bg-s1 px-3 text-[13px] font-semibold hover:bg-s2 sm:h-8 sm:px-2.5 sm:text-[12.5px]">
            <Crop size={14} /> Position
          </button>
        )}
        {image && (
          <button type="button" onClick={() => choose({ image: undefined })} className="h-9 rounded-full px-2.5 text-[13px] font-semibold text-brick-text hover:bg-brick-bg sm:h-8 sm:text-[12.5px]">Remove</button>
        )}
        <input ref={fileRef} type="file" accept={ACCEPTED_IMAGE_TYPES} className="hidden" onChange={(e) => { void pickFile(e.target.files?.[0]); e.target.value = '' }} />
      </div>
      {posing && image && (
        <CoverPosition
          src={image}
          value={pos ?? { x: 50, y: 50 }}
          onChange={(p) => onChange({ imagePos: p })}
          onClose={() => setPosing(false)}
        />
      )}
      {/* the one constraint, always there, and the refusal in its place when there is one */}
      {err
        ? <span className="text-[12px] text-brick-text">{err}</span>
        : <span className="text-[12px] text-faint">JPG, PNG or WebP up to {MAX_UPLOAD_LABEL}, resized before it is saved.</span>}
    </div>
  )
}

// the phone row's column, wide enough for its label; and the gap between columns
const ROW_COL = 84
const GAP = 16

// PhotoFrame's border, both sides together (p-2, p-2.5, p-3.5)
const FRAME_PAD = { thin: 16, mid: 20, thick: 28 } as const

/* One place the cover shows: drawn at `w`, its real width, then scaled by the shared
   `scale`, so everything in it (the crop, the tape, the name) keeps its real
   proportions. */
function Preview({ label, w, scale, className = '', children }: { label: string; w: number; scale: number; className?: string; children: React.ReactNode }) {
  const inner = useRef<HTMLDivElement>(null)
  const [h, setH] = useState(0)
  useLayoutEffect(() => {
    const i = inner.current
    if (!i) return
    const measure = () => setH(i.offsetHeight)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(i)
    return () => ro.disconnect()
  }, [])
  return (
    <div className={`min-w-0 ${className}`}>
      <div style={{ height: h * scale || undefined }}>
        <div ref={inner} className="origin-top-left" style={{ width: w, transform: `scale(${scale})` }}>{children}</div>
      </div>
      <div className="mt-2 whitespace-nowrap text-[11px] font-semibold uppercase tracking-[.13em] text-faint">{label}</div>
    </div>
  )
}
