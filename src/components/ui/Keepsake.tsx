import { Pushpin } from './Pushpin'

/* The small hand-laid details that make each photo card its own: a strip of tape
   across a corner or an edge, two short strips, a paper clip, two pins or four photo
   corners, with the frame's tilt and border width varying too. Worked out from the
   plan's id, so a card keeps its look from one visit to the next.

   Everything sits on the picture or the frame's edge beside it, never over the
   plan's name, stage, details or buttons, and takes no pointer. Each piece is marked
   data-keep (pin, tape, clip, mount) so a Deck can take them off one by one before
   it lifts the card away. The top left of the
   frame is left clear for the faces peeking over it. Colours are tokens: --tape and
   --tape-2, --pin, --clip, --mount. */

export type KeepsakeKind = 'tape-corner' | 'tape-right' | 'tape-left' | 'tape-two' | 'clip' | 'pin' | 'mounts'
const KINDS: KeepsakeKind[] = ['tape-corner', 'tape-right', 'tape-left', 'tape-two', 'clip', 'pin', 'mounts']

/** What the host picked for a plan's card: one of the details, 'none' for a bare
 *  frame, or nothing at all for the one its id deals (Auto). */
export type CardDetail = KeepsakeKind | 'none'

/** The choices the Style editor offers, in its order. Auto is the absence of one. */
export const DETAIL_CHOICES: { v: CardDetail; label: string }[] = [
  { v: 'pin', label: 'Pins' },
  { v: 'tape-corner', label: 'Tape' },
  { v: 'tape-two', label: 'Two strips' },
  { v: 'clip', label: 'Paper clip' },
  { v: 'mounts', label: 'Photo corners' },
  { v: 'none', label: 'None' },
]

/** A look with the host's choice laid over it, when they made one. */
export function withDetail(look: Look, choice?: CardDetail): Look {
  return choice ? { ...look, kind: choice } : look
}

export type Look = {
  kind: CardDetail
  // degrees, sign set by the card's place in its group
  tilt: number
  // tape length in px and a small extra angle
  len: number
  jitter: number
  // which tape tint
  tone: 'a' | 'b'
  // frame border: thin, mid or thick
  pad: 'thin' | 'mid' | 'thick'
}

// a small stable hash, salted, so each property varies on its own
function hash(id: string, salt: number): number {
  let h = 2166136261 ^ salt
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619)
  // mix the bits, so ids that differ only at the end still land far apart
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16
  return (h >>> 0) / 4294967295
}

/** The look for the card at `index` in a group, given the look of the card before
    it: the same plan always gets the same details, and two neighbours never share a
    kind or a tilt direction. */
export function lookOf(id: string, index: number, prev?: Look): Look {
  let kind = KINDS[Math.floor(hash(id, 1) * KINDS.length) % KINDS.length]
  if (prev && prev.kind === kind) kind = KINDS[(KINDS.indexOf(kind) + 1) % KINDS.length]
  const mag = 1.2 + hash(id, 2) * 1.6
  const pads = ['thin', 'mid', 'thick'] as const
  let pad = pads[Math.floor(hash(id, 6) * 3) % 3]
  if (prev && prev.pad === pad && prev.kind === kind) pad = pads[(pads.indexOf(pad) + 1) % 3]
  return {
    kind,
    tilt: (index % 2 === 0 ? -1 : 1) * Math.round(mag * 10) / 10,
    len: Math.round(44 + hash(id, 3) * 30),
    jitter: Math.round((hash(id, 4) - 0.5) * 14),
    tone: hash(id, 5) < 0.5 ? 'a' : 'b',
    pad,
  }
}

/* A gem clip standing on the frame's top edge, drawn in a 16x48 box whose y=13 is
   that edge. The short outer leg is behind the card, the bend at the top wraps over
   the edge, and the long loop lies on the front. Its top sits this far above the
   picture (the frame's border is about 10px, so the edge falls at the box's y=13). */
const CLIP_TOP = -23
const CLIP_BACK = 'M3 36 V8 A5 5 0 0 1 13 8'
const CLIP_FRONT = 'M13 8 V42 A4 4 0 0 1 5 42 V15 A3 3 0 0 1 11 15 V34'

/** Looks for a shelf of cards lying straight (Plans, Templates, Demos): no tilt, and
 *  the details taken in turn, so any few cards side by side show pins, tape, a clip
 *  and photo corners rather than whatever the ids happened to pick. The rest of each
 *  look (tape length, tint, border) still comes from its id. */
const SHELF: KeepsakeKind[] = ['pin', 'tape-corner', 'clip', 'mounts', 'tape-two', 'tape-right', 'tape-left']
export function shelfLooks(ids: string[]): Look[] {
  return ids.map((id, i) => ({ ...lookOf(id, i), kind: SHELF[i % SHELF.length], tilt: 0 }))
}

function Strip({ className, rotate, len, tone }: { className: string; rotate: number; len: number; tone: 'a' | 'b' }) {
  return <span aria-hidden data-keep="tape" className={`absolute block h-[18px] ${tone === 'a' ? 'bg-tape' : 'bg-tape-2'} ${className}`} style={{ width: len, transform: `rotate(${rotate}deg)` }} />
}

/* Drawn inside the picture's box (which must be `relative`); pieces reach out over
   the frame's edge where tape would. */
export function Keepsake({ look }: { look: Look }) {
  const { kind, len, jitter, tone } = look
  // a bare frame: the host chose no detail
  if (kind === 'none') return null
  return (
    <>
    {kind === 'clip' && (
      /* the clip's back leg and the bend over the edge: drawn under the frame (a
         negative z inside the frame's own layer), so the card hides the leg and only
         the bend shows above the edge, like a real clip holding the card */
      <svg data-keep="clip" aria-hidden viewBox="0 0 16 48" className="pointer-events-none absolute right-10 -z-10 h-12 w-4 overflow-visible" style={{ top: CLIP_TOP, transform: `rotate(${jitter / 2}deg)` }}>
        <path d={CLIP_BACK} fill="none" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="stroke-clip" />
      </svg>
    )}
    <span aria-hidden className="pointer-events-none absolute inset-0 z-[2]">
      {kind === 'tape-corner' && <Strip className="-right-7 -top-3" rotate={38 + jitter} len={len} tone={tone} />}
      {kind === 'tape-right' && <Strip className="-right-8 top-[30%]" rotate={84 + jitter / 2} len={Math.round(len * 0.8)} tone={tone} />}
      {kind === 'tape-left' && <Strip className="-left-8 top-[45%]" rotate={-82 + jitter / 2} len={Math.round(len * 0.8)} tone={tone} />}
      {kind === 'tape-two' && (
        <>
          <Strip className="-right-5 -top-2" rotate={34 + jitter} len={40} tone={tone} />
          <Strip className="-left-6 bottom-7" rotate={-40 - jitter} len={40} tone={tone === 'a' ? 'b' : 'a'} />
        </>
      )}
      {kind === 'clip' && (
        // the front of a paper clip slid onto the frame's top edge: the long loop
        // lies over the photo; the short leg is behind the card (ClipBack)
        <svg data-keep="clip" viewBox="0 0 16 48" className="absolute right-10 h-12 w-4 overflow-visible" style={{ top: CLIP_TOP, transform: `rotate(${jitter / 2}deg)`, filter: 'var(--face-lift)' }}>
          <path d={CLIP_FRONT} fill="none" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="stroke-clip" />
        </svg>
      )}
      {kind === 'pin' && (
        // two pushpins through the photo's top corners
        <>
          <Pushpin size={16} className="absolute -top-2 left-3" data-keep="pin" />
          <Pushpin size={16} className="absolute -top-2 right-3" data-keep="pin" />
        </>
      )}
      {kind === 'mounts' && (
        // four album corners: small dark paper pockets the photo's corners are tucked
        // into, reaching a little past the photo onto the frame, with a lighter fold
        // along the pocket's edge
        <>
          {([['-left-1 -top-1', 0], ['-right-1 -top-1', 90], ['-right-1 -bottom-1', 180], ['-left-1 -bottom-1', 270]] as const).map(([at, turn]) => (
            <svg key={at} data-keep="mount" viewBox="0 0 22 22" className={`absolute h-[22px] w-[22px] ${at}`} style={{ transform: `rotate(${turn}deg)`, filter: 'var(--face-lift)' }}>
              <path d="M0 0 H22 L0 22 Z" style={{ fill: 'var(--mount)' }} />
              <path d="M21 1 L1 21" style={{ stroke: 'var(--mount-fold)' }} strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          ))}
        </>
      )}
    </span>
    </>
  )
}
