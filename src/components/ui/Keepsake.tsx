/* The small hand-laid details that make each photo card its own: a strip of tape
   across a corner or an edge, two short strips, a paper clip, a pin or four photo
   corners, with the frame's tilt and border width varying too. Worked out from the
   plan's id, so a card keeps its look from one visit to the next.

   Everything sits on the picture or the frame's edge beside it, never over the
   plan's name, stage, details or buttons, and takes no pointer. The top left of the
   frame is left clear for the faces peeking over it. Colours are tokens: --tape and
   --tape-2, --pin, --clip. */

export type KeepsakeKind = 'tape-corner' | 'tape-right' | 'tape-left' | 'tape-two' | 'clip' | 'pin' | 'mounts'
const KINDS: KeepsakeKind[] = ['tape-corner', 'tape-right', 'tape-left', 'tape-two', 'clip', 'pin', 'mounts']

export type Look = {
  kind: KeepsakeKind
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

function Strip({ className, rotate, len, tone }: { className: string; rotate: number; len: number; tone: 'a' | 'b' }) {
  return <span aria-hidden className={`absolute block h-[18px] ${tone === 'a' ? 'bg-tape' : 'bg-tape-2'} ${className}`} style={{ width: len, transform: `rotate(${rotate}deg)` }} />
}

/* Drawn inside the picture's box (which must be `relative`); pieces reach out over
   the frame's edge where tape would. */
export function Keepsake({ look }: { look: Look }) {
  const { kind, len, jitter, tone } = look
  return (
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
        // a paper clip over the frame's top edge, towards the right
        <svg viewBox="0 0 16 44" className="absolute -top-6 right-10 h-11 w-4" style={{ transform: `rotate(${jitter / 2}deg)` }}>
          <path d="M5 40 V8 a3.5 3.5 0 0 1 7 0 V34 a2 2 0 0 1 -4 0 V12" fill="none" strokeWidth="2.2" strokeLinecap="round" className="stroke-clip" />
        </svg>
      )}
      {kind === 'pin' && (
        // a round pin near the top right corner, lifted a little off the photo
        <span className="absolute right-4 top-3 block">
          <span className="relative block h-3.5 w-3.5 rounded-full bg-pin shadow-frame" />
        </span>
      )}
      {kind === 'mounts' && (
        // four photo corners holding the picture down
        <>
          {(['left-0 top-0', 'right-0 top-0', 'left-0 bottom-0', 'right-0 bottom-0'] as const).map((at, i) => (
            <span
              key={at}
              className={`absolute block h-4 w-4 ${tone === 'a' ? 'bg-tape' : 'bg-tape-2'} ${at}`}
              style={{ clipPath: ['polygon(0 0,100% 0,0 100%)', 'polygon(0 0,100% 0,100% 100%)', 'polygon(0 0,100% 100%,0 100%)', 'polygon(100% 0,100% 100%,0 100%)'][i] }}
            />
          ))}
        </>
      )}
    </span>
  )
}
