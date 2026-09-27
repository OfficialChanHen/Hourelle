/* Warm covers for event cards and headers. Three sources, one component:
   the generated gradient (default), a preset scene ('preset:<id>'), or the
   host's own photo, which is a URL into Storage once it has been uploaded and a
   data URL until then (see lib/covers). */

import { isPhotoCover } from '@/lib/cover-kind'
import { CoverImg } from './CoverImg'

export type CoverPreset = { id: string; name: string; from: string; to: string; scene: React.ReactNode }

/* Each scene is a flat picture of what its template is for, drawn on a 400x160
   frame that every surface crops differently: a wide event header keeps only a
   band about y 52 to 108, a tall phone card only about x 130 to 270, the editor's
   swatch about x 75 to 325. So the subject sits in the middle of the frame, on a
   table or horizon near y 100, and the edges only carry context. The ids are
   stored on events, so they stay; the names follow the templates. */

// a candle flame, a small teardrop standing on (x, y)
const flame = (x: number, y: number, fill: string) => (
  <path d={`M${x} ${y - 9} C${x + 4} ${y - 4} ${x + 3.5} ${y} ${x} ${y} C${x - 3.5} ${y} ${x - 4} ${y - 4} ${x} ${y - 9} Z`} fill={fill} />
)

// a wisp of steam rising from (x, y)
const steam = (x: number, y: number, stroke: string, key?: string) => (
  <path key={key} d={`M${x} ${y} q-5 -6 0 -11 q5 -5 0 -11`} stroke={stroke} strokeWidth="2.6" strokeLinecap="round" fill="none" />
)

// a wine glass whose foot stands at (x, y)
const glass = (x: number, y: number) => (
  <>
    <path d={`M${x - 8} ${y - 30} H${x + 8} C${x + 8} ${y - 18} ${x + 4.5} ${y - 12} ${x} ${y - 12} C${x - 4.5} ${y - 12} ${x - 8} ${y - 18} ${x - 8} ${y - 30} Z`} fill="#FBF1E4" opacity=".85" />
    <path d={`M${x - 7.4} ${y - 22} H${x + 7.4} C${x + 6.6} ${y - 15.5} ${x + 3.8} ${y - 13} ${x} ${y - 13} C${x - 3.8} ${y - 13} ${x - 6.6} ${y - 15.5} ${x - 7.4} ${y - 22} Z`} fill="#7E2A33" />
    <rect x={x - 0.8} y={y - 12} width="1.6" height="11" fill="#FBF1E4" />
    <ellipse cx={x} cy={y} rx="5" ry="1.4" fill="#FBF1E4" />
  </>
)

// the conference skyline: [x, top, width] for each tower, all standing on y 106
const FAR_TOWERS = [[6, 72, 30], [40, 54, 24], [68, 64, 30], [102, 42, 22], [128, 60, 26], [158, 34, 24], [186, 50, 22], [212, 30, 26], [242, 56, 22], [268, 40, 28], [300, 66, 24], [328, 50, 28], [360, 70, 34]]
const NEAR_TOWERS = [[0, 86, 34], [36, 76, 24], [96, 72, 26], [140, 84, 24], [244, 80, 26], [300, 74, 26], [350, 84, 30]]
const WINDOWS = [[42, 60], [50, 60], [42, 68], [106, 48], [114, 48], [114, 56], [162, 40], [170, 40], [162, 48], [216, 36], [224, 36], [224, 44], [272, 46], [280, 46], [272, 54], [334, 56], [342, 56]]

export const COVER_PRESETS: CoverPreset[] = [
  {
    // a winding trail up to a cabin under the mountains, a low sun
    id: 'meadow', name: 'Weekend trip', from: '#EAF1E7', to: '#C9DECF', scene: (
      <>
        <circle cx="312" cy="42" r="16" fill="#F2C878" />
        <path d="M82 108 L166 40 L206 72 L240 50 L330 108 Z" fill="#8DADA5" />
        <path d="M166 40 L180 51 L173 50 L167 55 L160 50 L153 51 Z" fill="#F7F1E3" />
        <path d="M240 50 L251 59 L245 58 L240 62 L235 58 L230 58 Z" fill="#F7F1E3" />
        <path d="M0 104 Q 90 84 190 100 T 400 96 V160 H0 Z" fill="#83AC78" />
        <path d="M0 128 Q 120 108 236 124 T 400 116 V160 H0 Z" fill="#5E8D5F" />
        <path d="M168 160 C 186 140 244 138 232 122 C 224 112 206 110 212 102 L 216 102 C 214 108 234 112 240 122 C 252 140 214 146 204 160 Z" fill="#F4E6C8" />
        <path d="M134 104 L141 90 L148 104 Z M146 106 L152 94 L158 106 Z M262 100 L269 86 L276 100 Z" fill="#3F6B4B" />
        <path d="M200 92 L214 81 L228 92 Z" fill="#5C3A2C" />
        <rect x="203" y="91" width="22" height="12" fill="#C4683E" />
        <rect x="212" y="95" width="4.5" height="8" fill="#5C3A2C" />
      </>
    ),
  },
  {
    // candles, glasses and two plates on a table edge, a big sun going down behind
    id: 'dusk', name: 'Dinner', from: '#F7DBC2', to: '#EDB395', scene: (
      <>
        <circle cx="200" cy="102" r="52" fill="#FAE1B4" />
        <rect x="58" y="52" width="64" height="5" rx="2.5" fill="#FBE8D2" opacity=".8" />
        <rect x="292" y="40" width="54" height="5" rx="2.5" fill="#FBE8D2" opacity=".8" />
        <rect x="0" y="102" width="400" height="16" fill="#A04E40" />
        <rect x="0" y="118" width="400" height="42" fill="#7C3930" />
        <g transform="translate(200 108) scale(1.15) translate(-200 -108)">
          <ellipse cx="136" cy="109" rx="27" ry="5" fill="#FBF1E4" />
        <ellipse cx="136" cy="109" rx="16" ry="2.8" fill="#E6CFB8" />
        <ellipse cx="264" cy="109" rx="27" ry="5" fill="#FBF1E4" />
        <ellipse cx="264" cy="109" rx="16" ry="2.8" fill="#E6CFB8" />
        {glass(168, 108)}
        {glass(232, 108)}
        <rect x="190" y="70" width="6" height="36" rx="1.5" fill="#FBF1E4" />
        <rect x="204" y="78" width="6" height="28" rx="1.5" fill="#FBF1E4" />
        <rect x="186" y="104" width="28" height="4" rx="2" fill="#D9A04A" />
        {flame(193, 67, '#E88A3A')}
        {flame(207, 75, '#E88A3A')}
        </g>
      </>
    ),
  },
  {
    // three tents in a row on the sand, the sea behind, the sun on the water
    id: 'coast', name: 'Offsite', from: '#DDEBEF', to: '#B7D3DC', scene: (
      <>
        <circle cx="262" cy="86" r="24" fill="#F5D18A" />
        <rect x="0" y="94" width="400" height="66" fill="#6C9CAD" />
        <path d="M44 102 h22 M300 104 h26 M112 99 h14 M346 98 h18" stroke="#DCEBEF" strokeWidth="2" strokeLinecap="round" />
        <path d="M0 160 V122 Q 100 108 200 114 T 400 108 V160 Z" fill="#EAD3A7" />
        <path d="M0 122 Q 100 108 200 114 T 400 108" stroke="#F7EEDB" strokeWidth="3" fill="none" />
        <path d="M86 52 q5 -5 10 0 q5 -5 10 0 M120 40 q4 -4 8 0 q4 -4 8 0" stroke="#4E6F7A" strokeWidth="1.6" strokeLinecap="round" fill="none" />
        <path d="M140 120 L159 92 L178 120 Z" fill="#D5804A" />
        <path d="M154 120 L159 106 L164 120 Z" fill="#8A4728" />
        <path d="M182 118 L204 84 L226 118 Z" fill="#2F5F57" />
        <path d="M198 118 L204 100 L210 118 Z" fill="#1D3E39" />
        <path d="M204 84 V70" stroke="#2F5F57" strokeWidth="1.5" />
        <path d="M204 70 L215 73.5 L204 77 Z" fill="#D5804A" />
        <path d="M230 116 L248 90 L266 116 Z" fill="#D5804A" />
        <path d="M243 116 L248 103 L253 116 Z" fill="#8A4728" />
      </>
    ),
  },
  {
    // a steaming pot in the middle of a shared table, a bowl and a pie either side
    id: 'harvest', name: 'Potluck', from: '#F5E5C7', to: '#EACB98', scene: (
      <>
        <rect x="0" y="102" width="400" height="58" fill="#91603B" />
        <rect x="0" y="102" width="400" height="4" fill="#A8744A" />
        <g transform="translate(200 106) scale(1.15) translate(-200 -106)">
          {steam(190, 58, '#FFF8EC')}
        {steam(200, 52, '#FFF8EC')}
        {steam(210, 58, '#FFF8EC')}
        <path d="M170 72 Q200 56 230 72 Z" fill="#C95E48" />
        <rect x="195" y="58" width="10" height="5" rx="2" fill="#9A4032" />
        <rect x="164" y="71" width="72" height="6" rx="3" fill="#9A4032" />
        <rect x="156" y="80" width="12" height="5" rx="2.5" fill="#9A4032" />
        <rect x="232" y="80" width="12" height="5" rx="2.5" fill="#9A4032" />
        <path d="M168 76 H232 V94 Q232 106 220 106 H180 Q168 106 168 94 Z" fill="#B8513F" />
        {steam(126, 80, '#FFF8EC')}
        <path d="M104 90 Q126 78 148 90 Z" fill="#E2A34A" />
        <path d="M102 90 H150 Q148 106 126 106 Q104 106 102 90 Z" fill="#6E9278" />
        <path d="M250 94 H302 L297 106 H255 Z" fill="#F6ECDA" />
        <ellipse cx="276" cy="94" rx="26" ry="6" fill="#E2A34A" />
        <path d="M266 92 l4 3 M280 91 l4 3" stroke="#B97A2C" strokeWidth="1.6" strokeLinecap="round" />
        </g>
      </>
    ),
  },
  {
    // dice, a fanned hand of cards and a pawn on green felt, under a hanging lamp
    id: 'evening', name: 'Game night', from: '#DDCCE0', to: '#BB9EC3', scene: (
      <>
        <path d="M200 0 V26" stroke="#4A3550" strokeWidth="1.5" />
        <path d="M186 41 H214 L270 102 H130 Z" fill="#F7E5C2" opacity=".4" />
        <path d="M184 40 L190 26 H210 L216 40 Z" fill="#E0AC4C" />
        <ellipse cx="200" cy="40" rx="16" ry="2.5" fill="#F6DFA0" />
        <rect x="0" y="102" width="400" height="58" fill="#44685A" />
        <rect x="0" y="102" width="400" height="3" fill="#33523F" />
        <g transform="translate(200 102) scale(1.12) translate(-200 -102)">
          <g transform="rotate(-10 156 90)">
          <rect x="144" y="78" width="24" height="24" rx="5" fill="#FBF4EA" />
          <g fill="#3B2A3F">
            <circle cx="150" cy="84" r="2.2" />
            <circle cx="162" cy="84" r="2.2" />
            <circle cx="156" cy="90" r="2.2" />
            <circle cx="150" cy="96" r="2.2" />
            <circle cx="162" cy="96" r="2.2" />
          </g>
        </g>
        <g transform="rotate(12 181 95)">
          <rect x="172" y="86" width="18" height="18" rx="4" fill="#FBF4EA" />
          <g fill="#3B2A3F">
            <circle cx="177" cy="91" r="1.8" />
            <circle cx="181" cy="95" r="1.8" />
            <circle cx="185" cy="99" r="1.8" />
          </g>
        </g>
        <g transform="rotate(-18 236 106)">
          <rect x="222" y="64" width="28" height="40" rx="3" fill="#FBF4EA" />
          <rect x="226" y="68" width="20" height="32" rx="1.5" fill="#B8453E" opacity=".75" />
        </g>
        <g transform="rotate(-2 238 106)">
          <rect x="224" y="64" width="28" height="40" rx="3" fill="#FBF4EA" />
          <rect x="228" y="68" width="20" height="32" rx="1.5" fill="#B8453E" opacity=".75" />
        </g>
        <g transform="rotate(16 240 106)">
          <rect x="226" y="64" width="28" height="40" rx="3" fill="#FBF4EA" />
          <path d="M240 76 L246 84 L240 92 L234 84 Z" fill="#B8453E" />
        </g>
        <circle cx="280" cy="86" r="5" fill="#E0AC4C" />
        <path d="M274 102 L277 89 H283 L286 102 Z" fill="#E0AC4C" />
        </g>
      </>
    ),
  },
  {
    // two cups of coffee across a small table, a plant between them
    id: 'garden', name: 'Coffee catch-up', from: '#E6ECDC', to: '#C9D9B6', scene: (
      <>
        <rect x="0" y="104" width="400" height="56" fill="#AB7C52" />
        <rect x="0" y="104" width="400" height="3" fill="#C0926A" />
        <g transform="translate(200 106) scale(1.15) translate(-200 -106)">
          {steam(152, 70, '#FBF6EE')}
        {steam(162, 66, '#FBF6EE')}
        {steam(238, 66, '#FBF6EE')}
        {steam(248, 70, '#FBF6EE')}
        <ellipse cx="157" cy="106" rx="24" ry="3.5" fill="#F9F3EA" />
        <path d="M141 84 q-10 0 -10 7 q0 7 10 6" stroke="#F9F3EA" strokeWidth="3.5" fill="none" />
        <path d="M141 78 H173 V94 Q173 105 157 105 Q141 105 141 94 Z" fill="#F9F3EA" />
        <rect x="141" y="88" width="32" height="3" fill="#C8683F" />
        <ellipse cx="157" cy="78" rx="16" ry="3" fill="#6B4631" />
        <ellipse cx="243" cy="106" rx="24" ry="3.5" fill="#F9F3EA" />
        <path d="M259 84 q10 0 10 7 q0 7 -10 6" stroke="#C8683F" strokeWidth="3.5" fill="none" />
        <path d="M227 78 H259 V94 Q259 105 243 105 Q227 105 227 94 Z" fill="#C8683F" />
        <rect x="227" y="88" width="32" height="3" fill="#F9F3EA" />
        <ellipse cx="243" cy="78" rx="16" ry="3" fill="#6B4631" />
        <g fill="#4F7C58">
          <ellipse cx="193" cy="78" rx="5" ry="11" transform="rotate(-30 193 84)" />
          <ellipse cx="207" cy="77" rx="5" ry="12" transform="rotate(26 207 84)" />
          <ellipse cx="200" cy="72" rx="4.5" ry="13" />
        </g>
        <rect x="188" y="86" width="24" height="4" rx="1" fill="#B15A36" />
        <path d="M190 90 H210 L207 106 H193 Z" fill="#C8683F" />
        </g>
      </>
    ),
  },
  {
    // a cake with three candles, balloons either side, a little confetti
    id: 'party', name: 'Birthday', from: '#F7DDD9', to: '#EEBFC1', scene: (
      <>
        <rect x="0" y="110" width="400" height="50" fill="#D7848A" />
        <g>
          <path d="M104 72 Q98 90 108 108" stroke="#B7797E" strokeWidth="1.2" fill="none" />
          <path d="M300 64 Q308 84 298 108" stroke="#B7797E" strokeWidth="1.2" fill="none" />
          <path d="M330 79 Q322 94 332 110" stroke="#B7797E" strokeWidth="1.2" fill="none" />
        </g>
        <ellipse cx="104" cy="52" rx="16" ry="19" fill="#6FA58E" />
        <path d="M101 73 L104 70 L107 73 Z" fill="#6FA58E" />
        <ellipse cx="300" cy="44" rx="17" ry="20" fill="#E6AE4C" />
        <path d="M297 66 L300 63 L303 66 Z" fill="#E6AE4C" />
        <ellipse cx="330" cy="62" rx="14" ry="17" fill="#D3616C" />
        <path d="M327 81 L330 78 L333 81 Z" fill="#D3616C" />
        <rect x="138" y="36" width="8" height="4" rx="1" transform="rotate(28 142 38)" fill="#E6AE4C" />
        <rect x="256" y="28" width="8" height="4" rx="1" transform="rotate(-22 260 30)" fill="#6FA58E" />
        <rect x="60" y="92" width="8" height="4" rx="1" transform="rotate(-30 64 94)" fill="#D3616C" />
        <rect x="244" y="62" width="7" height="3.5" rx="1" transform="rotate(40 247 64)" fill="#D3616C" />
        <circle cx="160" cy="54" r="2.4" fill="#6FA58E" />
        <circle cx="362" cy="100" r="2.4" fill="#E6AE4C" />
        <circle cx="42" cy="44" r="2.4" fill="#D3616C" />
        <ellipse cx="200" cy="111" rx="54" ry="4" fill="#FFF6EC" />
        <rect x="160" y="84" width="80" height="26" rx="3" fill="#FFF6EC" />
        <path d="M160 84 H240 V90 q-5 6 -10 0 q-5 6 -10 0 q-5 6 -10 0 q-5 6 -10 0 q-5 6 -10 0 q-5 6 -10 0 q-5 6 -10 0 q-5 6 -10 0 Z" fill="#D3616C" />
        <g fill="#E6AE4C">
          <circle cx="172" cy="101" r="1.8" />
          <circle cx="186" cy="101" r="1.8" />
          <circle cx="200" cy="101" r="1.8" />
          <circle cx="214" cy="101" r="1.8" />
          <circle cx="228" cy="101" r="1.8" />
        </g>
        <rect x="176" y="66" width="48" height="18" rx="3" fill="#FFF6EC" />
        <path d="M176 66 H224 V71 q-4 5 -8 0 q-4 5 -8 0 q-4 5 -8 0 q-4 5 -8 0 q-4 5 -8 0 q-4 5 -8 0 Z" fill="#D3616C" />
        <rect x="186" y="53" width="4" height="13" rx="1" fill="#6FA58E" />
        <rect x="198" y="53" width="4" height="13" rx="1" fill="#E6AE4C" />
        <rect x="210" y="53" width="4" height="13" rx="1" fill="#6FA58E" />
        {flame(188, 51, '#E8883C')}
        {flame(200, 51, '#E8883C')}
        {flame(212, 51, '#E8883C')}
      </>
    ),
  },
  {
    // a podium on a stage, the city's towers behind, two beams of light
    id: 'city', name: 'Conference', from: '#EFE2D0', to: '#D8BF9E', scene: (
      <>
        <g fill="#CDB99D">
          {FAR_TOWERS.map(([x, y, w]) => <rect key={x} x={x} y={y} width={w} height={106 - y} />)}
        </g>
        <g fill="#F6EBDA" opacity=".7">
          {WINDOWS.map(([x, y]) => <rect key={`${x}-${y}`} x={x} y={y} width="4" height="4" />)}
        </g>
        <g fill="#9E8A72">
          {NEAR_TOWERS.map(([x, y, w]) => <rect key={x} x={x} y={y} width={w} height={106 - y} />)}
        </g>
        <path d="M150 0 H170 L204 104 H194 Z M230 0 H250 L206 104 H196 Z" fill="#FBF3E6" opacity=".35" />
        <rect x="0" y="104" width="400" height="56" fill="#E3CDAE" />
        <rect x="56" y="102" width="288" height="6" fill="#7A6152" />
        <rect x="56" y="108" width="288" height="18" fill="#3F3531" />
        <circle cx="200" cy="62" r="6" fill="#3F3531" />
        <path d="M188 80 Q188 70 200 70 Q212 70 212 80 Z" fill="#2F5F57" />
        <rect x="186" y="80" width="28" height="22" rx="1" fill="#B85C3F" />
        <rect x="183" y="76" width="34" height="5" rx="1.5" fill="#8F4430" />
        <circle cx="200" cy="90" r="4" fill="#F6EBDA" />
        <path d="M209 76 L214 68" stroke="#3F3531" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="214.5" cy="67" r="2.2" fill="#3F3531" />
      </>
    ),
  },
]

export function coverPresetOf(src?: string): CoverPreset | null {
  return src?.startsWith('preset:') ? COVER_PRESETS.find((p) => p.id === src.slice(7)) ?? null : null
}

export function Cover({
  from,
  to,
  src,
  fit = 'fill',
  pos,
  className = '',
  rounded = '',
}: {
  from: string
  to: string
  src?: string
  // a photo either fills the frame (cropped) or fits inside it whole, on a blur of itself
  fit?: 'fill' | 'fit'
  // which part of a cropped photo survives the crop. Every frame in the app is a
  // different shape, so the host picks a point to keep rather than a rectangle: the
  // card keeps it, the header keeps it, and each crops around it.
  pos?: { x: number; y: number }
  className?: string
  rounded?: string
}) {
  // a host's own photo, whether it is still inside the document as a data URL or
  // has been moved to Storage and is now a URL. Both draw identically.
  if (isPhotoCover(src)) {
    const whole = fit === 'fit'
    // the photo sits on the event's default cover, so a picture that cannot load (a
    // file since deleted, a dropped connection) shows that cover rather than a blank
    return (
      <div className={`relative overflow-hidden ${rounded} ${className}`} style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}>
        <DefaultMarks />
        {/* already downscaled on the way in, and a data URL has nothing for
            next/image to fetch, so both sources go straight to an <img> */}
        {whole && <CoverImg src={src!} hidden className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-xl" />}
        <CoverImg
          src={src!}
          className={`absolute inset-0 h-full w-full ${whole ? 'object-contain' : 'object-cover'}`}
          style={!whole && pos ? { objectPosition: `${pos.x}% ${pos.y}%` } : undefined}
        />
      </div>
    )
  }
  const preset = coverPresetOf(src)
  if (preset) {
    // hourelle-cover-scene: dimmed a little on the dark theme (globals.css), so a
    // bright picture sits in the charcoal page rather than glaring out of it
    return (
      <div className={`hourelle-cover-scene relative overflow-hidden ${rounded} ${className}`} style={{ background: `linear-gradient(135deg, ${preset.from}, ${preset.to})` }}>
        <svg viewBox="0 0 400 160" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" aria-hidden>
          {preset.scene}
        </svg>
      </div>
    )
  }
  return (
    <div
      className={`relative overflow-hidden ${rounded} ${className}`}
      style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
    >
      <DefaultMarks />
    </div>
  )
}

// the two soft circles of the default cover, drawn under a photo too so a picture
// that fails to load leaves exactly the cover an event without one wears
function DefaultMarks() {
  return (
    <>
      <span className="absolute -right-6 -top-10 h-32 w-32 rounded-full" style={{ background: 'rgba(255,255,255,.22)' }} />
      <span className="absolute -bottom-8 left-4 h-20 w-20 rounded-full" style={{ background: 'rgba(46,74,60,.07)' }} />
    </>
  )
}
