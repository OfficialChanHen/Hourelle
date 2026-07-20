'use client'

import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'

/* Which look the whole app wears. data-palette on <html> picks the family;
   the sun/moon toggle keeps switching light and dark inside whichever is chosen.
   The swatches are fixed previews of each palette, so they stay honest no matter
   which appearance is currently active. */
export type Palette = 'aline' | 'gcal' | 'drain' | 'pride'

// 'drain' keeps its storage key for anyone who already picked it; the card wears
// a name everyone can love
const PALETTES: { key: Palette; name: string; caption: string; swatches: string[]; gradient?: string }[] = [
  { key: 'aline', name: 'Aline', caption: 'Warm paper and deep green. The original look.', swatches: ['#F4F1EA', '#2E4A3C', '#15130E', '#9A6B2E'] },
  { key: 'gcal', name: 'Calendar', caption: 'Clean white and blue, in the spirit of Google Calendar.', swatches: ['#FFFFFF', '#0B57D0', '#131314', '#8AB4F8'] },
  { key: 'drain', name: 'Frost', caption: 'Icy silver and chrome with a cold red accent.', swatches: ['#EDF1F6', '#C8102E', '#0D1219', '#8FB6E4'] },
  {
    key: 'pride', name: 'Pride', caption: 'The whole flag, all year round.', swatches: [],
    gradient: 'linear-gradient(90deg, #E40303, #FF8C00, #FFED00, #008026, #004CFF, #732982)',
  },
]

const KNOWN: Palette[] = ['gcal', 'drain', 'pride']

function apply(p: Palette) {
  if (p === 'aline') document.documentElement.removeAttribute('data-palette')
  else document.documentElement.setAttribute('data-palette', p)
  try { localStorage.setItem('aline.palette', p) } catch { /* private mode */ }
}

export function AppearancePicker() {
  // read after mount so the server render never guesses wrong
  const [palette, setPalette] = useState<Palette | null>(null)
  useEffect(() => {
    try {
      const saved = localStorage.getItem('aline.palette')
      setPalette(KNOWN.includes(saved as Palette) ? (saved as Palette) : 'aline')
    } catch { setPalette('aline') }
  }, [])

  function pick(p: Palette) {
    setPalette(p)
    apply(p)
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {PALETTES.map((p) => {
        const active = palette === p.key
        return (
          <button
            key={p.key}
            type="button"
            onClick={() => pick(p.key)}
            aria-pressed={active}
            className="min-w-0 rounded-xl border bg-s0 p-3 text-left transition-colors hover:bg-s2"
            style={{ borderColor: active ? 'var(--accent)' : 'var(--border2)', boxShadow: active ? 'inset 0 0 0 1px var(--accent)' : undefined }}
          >
            <span className="flex items-center gap-1">
              {p.gradient
                ? <span className="h-4 w-[104px] rounded-full border border-black/10" style={{ background: p.gradient }} />
                : p.swatches.map((c) => (
                  <span key={c} className="h-4 w-4 rounded-full border border-black/10" style={{ background: c }} />
                ))}
              {active && (
                <span className="ml-auto grid h-[18px] w-[18px] place-items-center rounded-full bg-accent text-on-accent">
                  <Check size={12} />
                </span>
              )}
            </span>
            <span className="mt-2 block text-[13.5px] font-semibold">{p.name}</span>
            <span className="mt-0.5 block text-[12px] leading-[1.45] text-dim">{p.caption}</span>
          </button>
        )
      })}
    </div>
  )
}
