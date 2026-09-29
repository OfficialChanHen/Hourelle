/* ── faces: everyone's avatar is a small drawn face ──
   A filled shape in the person's colour with eyes, a mouth and maybe hair and one
   extra, drawn in the colour's feature shade on a 40x40 box. Five small choices, so a
   face is a few bytes on the participant entry and costs one SVG to draw.

   One weight for everything: every line (eyes drawn as lines, mouths, glasses) is
   LINE units wide, and every dot is a real filled circle, so a face scales with its
   box and keeps the same even weight from 18px to 150px. A dot is never a zero-length
   stroke, which rasterises as a soft square at small sizes.
   Every path is drawn for a shape centred in the box, reaching from 1 to 39. */

export type FaceShape = 'circle' | 'squircle' | 'flower' | 'arch' | 'blob'
export type FaceEyes = 'dots' | 'happy' | 'wink' | 'sleepy'
export type FaceMouth = 'smile' | 'grin' | 'oh' | 'smirk'
export type FaceHair = 'none' | 'bangs' | 'tuft' | 'bun'
export type FaceAccessory = 'none' | 'glasses' | 'freckles' | 'blush'

export type Face = { shape: FaceShape; eyes: FaceEyes; mouth: FaceMouth; hair: FaceHair; accessory: FaceAccessory }

/** The width of every line in a face, in the 40 box. */
export const LINE = 2.4

/** A part as drawn: `d` is stroked LINE wide with round caps and joins, `dots` are
 *  filled circles of radius `r`, `tint` is filled ellipses [cx, cy, rx, ry] at
 *  `o` opacity. Everything is in the feature shade. */
export type FacePart = {
  d?: string
  dots?: readonly (readonly [number, number])[]
  r?: number
  tint?: readonly (readonly [number, number, number, number])[]
  o?: number
}

export const SHAPES: Record<FaceShape, string> = {
  circle: 'M20 1 a19 19 0 1 1 0 38 a19 19 0 1 1 0 -38z',
  squircle: 'M20 1 C35 1 39 5 39 20 S35 39 20 39 S1 35 1 20 S5 1 20 1z',
  flower: 'M20 2 C27 2 29 9 29 11 C31 11 38 13 38 20 C38 27 31 29 29 29 C29 31 27 38 20 38 C13 38 11 31 11 29 C9 29 2 27 2 20 C2 13 9 11 11 11 C11 9 13 2 20 2z',
  arch: 'M4 39 V20 A16 16 0 0 1 36 20 V39z',
  blob: 'M21 1 C33 2 40 10 39 21 C38 33 30 40 19 39 C8 38 1 31 1 20 C2 9 10 0 21 1z',
}

/* How far each shape reaches past the circle inscribed in its box, as a share of the
   box. An arch's flat bottom corners stick out about 12%, a squircle's corners a
   little; the rest stay inside. A round ring (focus, selected, the account menu) has
   to clear this or the face pokes through it. */
const SHAPE_REACH: Record<FaceShape, number> = { circle: 0, squircle: 0.04, flower: 0, arch: 0.125, blob: 0 }

/** The outline offset, in pixels, that lets a round ring around this face clear it,
 *  plus `gap` of see-through space between face and ring. */
export function ringGap(face: Face, size: number, gap = 2): number {
  return Math.ceil(size * (SHAPE_REACH[face.shape] ?? 0)) + gap
}

const EYE_L = [14.5, 18.5] as const
const EYE_R = [25.5, 18.5] as const
export const EYES: Record<FaceEyes, FacePart> = {
  dots: { dots: [EYE_L, EYE_R], r: 2 },
  happy: { d: 'M12 19.2 q2.5 -3 5 0 M23 19.2 q2.5 -3 5 0' },
  wink: { dots: [EYE_L], r: 2, d: 'M23 19.2 q2.5 -3 5 0' },
  sleepy: { d: 'M12.5 18.5 h4 M23.5 18.5 h4' },
}

export const MOUTHS: Record<FaceMouth, string> = {
  smile: 'M14 25 q6 5.5 12 0',
  grin: 'M13 24 q7 8 14 0 z',
  oh: 'M18.2 26 a1.8 1.8 0 1 0 3.6 0 a1.8 1.8 0 1 0 -3.6 0',
  smirk: 'M15 26.5 q5 2 10 -1.5',
}

// hair is filled, in the same shade as the features
export const HAIR: Record<FaceHair, string> = {
  none: '',
  bangs: 'M6 14 q14 -14 28 0 q-14 -7 -28 0z',
  tuft: 'M16 5 q4 -6 8 0 q-4 2 -8 0z',
  bun: 'M15 5 a5 4 0 1 1 10 0 a5 4 0 1 1 -10 0z',
}

// one small extra, in the same shade and the same line weight; blush is a tint
export const ACCESSORIES: Record<FaceAccessory, FacePart> = {
  none: {},
  glasses: { d: 'M10.1 18.5 a4.4 4.4 0 1 0 8.8 0 a4.4 4.4 0 1 0 -8.8 0 M21.1 18.5 a4.4 4.4 0 1 0 8.8 0 a4.4 4.4 0 1 0 -8.8 0 M18.9 18.2 h2.2' },
  freckles: { dots: [[9.4, 22.8], [11.8, 24], [9.9, 25.4], [30.6, 22.8], [28.2, 24], [30.1, 25.4]], r: 0.95 },
  blush: { tint: [[9.6, 24.4, 2.6, 1.6], [30.4, 24.4, 2.6, 1.6]], o: 0.3 },
}

/* the picker's labels, in the order the rows show them */
export const FACE_PARTS = {
  shape: [['circle', 'Circle'], ['squircle', 'Squircle'], ['flower', 'Flower'], ['arch', 'Arch'], ['blob', 'Blob']],
  eyes: [['dots', 'Dots'], ['happy', 'Happy'], ['wink', 'Wink'], ['sleepy', 'Sleepy']],
  mouth: [['smile', 'Smile'], ['grin', 'Grin'], ['oh', 'Oh'], ['smirk', 'Smirk']],
  hair: [['none', 'No hair'], ['bangs', 'Bangs'], ['tuft', 'Tuft'], ['bun', 'Bun']],
  accessory: [['none', 'Nothing'], ['glasses', 'Glasses'], ['freckles', 'Freckles'], ['blush', 'Blush']],
} as const satisfies { [K in keyof Face]: readonly (readonly [Face[K], string])[] }

const SHAPE_KEYS = Object.keys(SHAPES) as FaceShape[]
const EYE_KEYS = Object.keys(EYES) as FaceEyes[]
const MOUTH_KEYS = Object.keys(MOUTHS) as FaceMouth[]
const HAIR_KEYS = Object.keys(HAIR) as FaceHair[]
const ACC_KEYS = Object.keys(ACCESSORIES) as FaceAccessory[]

/* ── a face from a string ──
   The same seed always draws the same face: FNV-1a over the string, then a small
   PRNG for each part in turn. Circles come up more often than the other shapes, and
   about half of all faces wear no extra, so a room of faces stays calm. */
function hash(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}
function rng(seed: number): () => number {
  let a = seed || 1
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function weighted<T>(r: number, items: readonly T[], weights: readonly number[]): T {
  const total = weights.reduce((a, b) => a + b, 0)
  let x = r * total
  for (let i = 0; i < items.length; i++) {
    x -= weights[i]
    if (x < 0) return items[i]
  }
  return items[items.length - 1]
}

export function faceFor(seed: string): Face {
  const next = rng(hash(seed))
  return {
    shape: weighted(next(), SHAPE_KEYS, [2, 1, 1, 1, 1]),
    eyes: EYE_KEYS[Math.floor(next() * EYE_KEYS.length)],
    mouth: MOUTH_KEYS[Math.floor(next() * MOUTH_KEYS.length)],
    hair: HAIR_KEYS[Math.floor(next() * HAIR_KEYS.length)],
    accessory: weighted(next(), ACC_KEYS, [4, 1.3, 1.3, 1.3]),
  }
}

/** The face someone wears before they have one of their own: seeded from their
 *  initials and colour, so it is the same on every screen that draws them. */
export function defaultFace(initials: string, color: string): Face {
  return faceFor(`${initials.toUpperCase()}|${color}`)
}

/* ── a new face that stands apart ──
   Like pickColor: look at who is already on the event and choose the combination of
   shape, eyes, mouth and hair that differs most from the nearest face there. The
   seed decides where the search starts and breaks ties, so the same person gets the
   same answer, and the seed's own face wins whenever it is already distinct. Up to
   320 combinations against the roster, once, at join time. */
type Worn = { face?: Face; initials: string; color: string }
const COMBOS = SHAPE_KEYS.length * EYE_KEYS.length * MOUTH_KEYS.length * HAIR_KEYS.length // 320
function comboAt(i: number): Pick<Face, 'shape' | 'eyes' | 'mouth' | 'hair'> {
  const h = i % HAIR_KEYS.length; i = Math.floor(i / HAIR_KEYS.length)
  const m = i % MOUTH_KEYS.length; i = Math.floor(i / MOUTH_KEYS.length)
  const e = i % EYE_KEYS.length; i = Math.floor(i / EYE_KEYS.length)
  return { shape: SHAPE_KEYS[i], eyes: EYE_KEYS[e], mouth: MOUTH_KEYS[m], hair: HAIR_KEYS[h] }
}
function comboIndex(f: Face): number {
  return ((SHAPE_KEYS.indexOf(f.shape) * EYE_KEYS.length + EYE_KEYS.indexOf(f.eyes)) * MOUTH_KEYS.length + MOUTH_KEYS.indexOf(f.mouth)) * HAIR_KEYS.length + HAIR_KEYS.indexOf(f.hair)
}
const differs = (a: Face, b: Pick<Face, 'shape' | 'eyes' | 'mouth' | 'hair'>) =>
  (a.shape !== b.shape ? 1 : 0) + (a.eyes !== b.eyes ? 1 : 0) + (a.mouth !== b.mouth ? 1 : 0) + (a.hair !== b.hair ? 1 : 0)
// steps coprime to 320, so a walk with any of them visits every combination once
const STEPS = [1, 3, 7, 9, 11, 13, 17, 19, 21, 23, 27, 29, 31, 33, 37, 39]

export function pickFace(roster: Worn[], seed: string): Face {
  const start = faceFor(seed)
  const worn = roster.map((p) => p.face ?? defaultFace(p.initials, p.color))
  if (!worn.length) return start
  // how far a candidate stands from its nearest neighbour, and how many share that distance
  const score = (c: Pick<Face, 'shape' | 'eyes' | 'mouth' | 'hair'>): number => {
    let min = 5, at = 0
    for (const w of worn) {
      const d = differs(w, c)
      if (d < min) { min = d; at = 1 } else if (d === min) at++
    }
    return min * 10000 - at
  }
  const h = hash(`${seed}#walk`)
  const step = STEPS[h % STEPS.length]
  const first = comboIndex(start)
  let best = comboAt(first), bestScore = score(best)
  for (let k = 1; k < COMBOS; k++) {
    const c = comboAt((first + k * step) % COMBOS)
    const s = score(c)
    if (s > bestScore) { best = c; bestScore = s }
  }
  return { ...best, accessory: start.accessory }
}

/** A face read from storage or another device, checked part by part. Anything
 *  that is not a face comes back undefined, and the avatar falls back on its seed. */
export function cleanFace(x: unknown): Face | undefined {
  if (!x || typeof x !== 'object') return undefined
  const f = x as Record<string, unknown>
  const ok = <T extends string>(v: unknown, keys: readonly T[]): v is T => typeof v === 'string' && (keys as readonly string[]).includes(v)
  if (!ok(f.shape, SHAPE_KEYS) || !ok(f.eyes, EYE_KEYS) || !ok(f.mouth, MOUTH_KEYS) || !ok(f.hair, HAIR_KEYS)) return undefined
  return { shape: f.shape, eyes: f.eyes, mouth: f.mouth, hair: f.hair, accessory: ok(f.accessory, ACC_KEYS) ? f.accessory : 'none' }
}

export const sameFace = (a?: Face, b?: Face): boolean =>
  !!a && !!b && a.shape === b.shape && a.eyes === b.eyes && a.mouth === b.mouth && a.hair === b.hair && a.accessory === b.accessory

/** Another face for the shuffle button: a fresh draw that differs from `from` in at
 *  least two of its parts, so a tap always visibly changes something. */
export function shuffleFace(from: Face, seed: string): Face {
  for (let i = 0; i < 12; i++) {
    const f = faceFor(`${seed}:${i}`)
    if (differs(from, f) + (from.accessory !== f.accessory ? 1 : 0) >= 2) return f
  }
  return faceFor(`${seed}:x`)
}
