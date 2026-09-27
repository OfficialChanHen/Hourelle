/* Warm covers for event cards and headers. Three sources, one component:
   the generated gradient (default), a preset scene ('preset:<id>'), or the
   host's own photo, which is a URL into Storage once it has been uploaded and a
   data URL until then (see lib/covers). */

import { isPhotoCover } from '@/lib/cover-kind'
import { CoverImg } from './CoverImg'

export type CoverPreset = { id: string; name: string; from: string; to: string; scene: React.ReactNode }

export const COVER_PRESETS: CoverPreset[] = [
  {
    id: 'meadow', name: 'Meadow', from: '#E4EDE7', to: '#CFE0D5', scene: (
      <>
        <circle cx="330" cy="38" r="26" fill="rgba(255,255,255,.55)" />
        <path d="M0 110 Q 100 78 200 108 T 400 104 V 160 H 0 Z" fill="#B9CFBF" opacity=".8" />
        <path d="M0 132 Q 120 104 240 130 T 400 126 V 160 H 0 Z" fill="#9DBBA4" opacity=".85" />
      </>
    ),
  },
  {
    id: 'dusk', name: 'Dusk', from: '#EEE1DD', to: '#E4CCC7', scene: (
      <>
        <circle cx="200" cy="98" r="44" fill="#D8A79B" opacity=".6" />
        <path d="M0 118 Q 130 92 260 118 T 400 112 V 160 H 0 Z" fill="#C9968C" opacity=".5" />
        <path d="M0 140 Q 110 120 230 140 T 400 136 V 160 H 0 Z" fill="#A96F63" opacity=".4" />
      </>
    ),
  },
  {
    id: 'coast', name: 'Coast', from: '#DEE7EC', to: '#C7DAE2', scene: (
      <>
        <circle cx="86" cy="44" r="22" fill="rgba(255,255,255,.6)" />
        <rect x="0" y="106" width="400" height="54" fill="#9FBECB" opacity=".6" />
        <path d="M0 106 Q 50 100 100 106 T 200 106 T 300 106 T 400 106" stroke="#87ACBC" strokeWidth="3" fill="none" opacity=".7" />
      </>
    ),
  },
  {
    id: 'harvest', name: 'Harvest', from: '#EFE7D6', to: '#E4D3B4', scene: (
      <>
        <circle cx="318" cy="46" r="28" fill="#E0B96F" opacity=".55" />
        <path d="M0 116 Q 100 96 200 116 T 400 112 V 160 H 0 Z" fill="#D9BE8C" opacity=".8" />
        <path d="M0 140 Q 140 122 280 142 T 400 138 V 160 H 0 Z" fill="#C6A468" opacity=".8" />
      </>
    ),
  },
  {
    id: 'evening', name: 'Evening', from: '#E7E2EE', to: '#D9CFE4', scene: (
      <>
        <circle cx="322" cy="42" r="20" fill="rgba(255,255,255,.7)" />
        <circle cx="284" cy="28" r="4" fill="rgba(255,255,255,.65)" />
        <circle cx="352" cy="78" r="3" fill="rgba(255,255,255,.6)" />
        <path d="M0 122 Q 130 98 260 124 T 400 118 V 160 H 0 Z" fill="#B7A6CB" opacity=".5" />
      </>
    ),
  },
  {
    id: 'garden', name: 'Garden', from: '#E4EADB', to: '#CDDCBB', scene: (
      <>
        <circle cx="70" cy="120" r="34" fill="#AEC494" opacity=".65" />
        <circle cx="128" cy="134" r="26" fill="#98B57E" opacity=".6" />
        <circle cx="330" cy="36" r="24" fill="rgba(255,255,255,.5)" />
      </>
    ),
  },
  {
    // three balloons on loose strings, a little confetti, a low rise of ground
    id: 'party', name: 'Party', from: '#F0E3E4', to: '#E5CFD3', scene: (
      <>
        <circle cx="62" cy="40" r="4" fill="rgba(255,255,255,.7)" />
        <circle cx="118" cy="72" r="3" fill="#E0AEB4" opacity=".7" />
        <rect x="150" y="32" width="9" height="4" rx="1" transform="rotate(24 154 34)" fill="#E6C29F" opacity=".7" />
        <rect x="88" y="100" width="8" height="4" rx="1" transform="rotate(-18 92 102)" fill="#C7B2D4" opacity=".7" />
        <circle cx="196" cy="54" r="3" fill="rgba(255,255,255,.65)" />
        <path d="M0 138 Q 130 122 260 140 T 400 134 V 160 H 0 Z" fill="#D8B1B5" opacity=".45" />
        <path d="M258 106 Q 264 124 254 146" stroke="#C49CA3" strokeWidth="1.5" fill="none" opacity=".7" />
        <path d="M292 94 Q 284 118 296 142" stroke="#C49CA3" strokeWidth="1.5" fill="none" opacity=".7" />
        <path d="M330 78 Q 340 108 328 140" stroke="#C49CA3" strokeWidth="1.5" fill="none" opacity=".7" />
        <ellipse cx="258" cy="86" rx="17" ry="20" fill="#C7B2D4" opacity=".6" />
        <ellipse cx="292" cy="70" rx="20" ry="24" fill="#E0AEB4" opacity=".7" />
        <ellipse cx="330" cy="52" rx="22" ry="26" fill="#E6C29F" opacity=".65" />
      </>
    ),
  },
  {
    // two rows of rooftops, the far one paler, under a soft sun
    id: 'city', name: 'City', from: '#E6E3DB', to: '#D6D0C2', scene: (
      <>
        <circle cx="86" cy="40" r="22" fill="rgba(255,255,255,.55)" />
        <path d="M0 160 V84 H36 V70 H62 V96 H100 V58 H126 V88 H168 V74 H198 V100 H240 V64 H268 V90 H312 V78 H338 V94 H374 V72 H400 V160 Z" fill="#BFB8A8" opacity=".45" />
        <g fill="rgba(255,255,255,.35)">
          <rect x="106" y="66" width="5" height="5" />
          <rect x="115" y="66" width="5" height="5" />
          <rect x="106" y="76" width="5" height="5" />
          <rect x="246" y="72" width="5" height="5" />
          <rect x="256" y="72" width="5" height="5" />
          <rect x="256" y="82" width="5" height="5" />
        </g>
        <path d="M0 160 V112 H50 V100 H80 V118 H122 V104 H158 V122 H208 V96 H238 V116 H280 V108 H318 V124 H356 V110 H400 V160 Z" fill="#A89F8C" opacity=".5" />
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
    return (
      <div className={`relative overflow-hidden ${rounded} ${className}`} style={{ background: `linear-gradient(135deg, ${preset.from}, ${preset.to})` }}>
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
