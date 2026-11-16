'use client'

import { useEffect, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { prefPalette, setPrefPalette , PREFS_CHANGED } from '@/lib/prefs'

/* Which look the whole app wears. data-palette on <html> picks the family;
   the sun/moon toggle keeps switching light and dark inside whichever is chosen.
   Collapsed by default: one row names the current look, the options stay hidden
   until asked for. Swatches are fixed previews, honest in any active theme. */
export type Palette = 'hourelle' | 'studio' | 'daylight' | 'breeze' | 'clay' | 'contrast'

// Six looks, each with a job: the house one, a neutral, a familiar bright one, a
// sunny one, a bold one in the logo's ink and clay, and one for low vision.
// 'hourelle' is the house key and always has been — it means no data-palette at all,
// so it follows whatever the house look currently is.
const PALETTES: { key: Palette; name: string; caption: string; swatches: string[] }[] = [
  { key: 'hourelle', name: 'Warm neutral', caption: 'Warm paper, forest green and moss, with orchid for your turn. The house look.', swatches: ['#FAF6EF', '#2E6B4E', '#4A6420', '#F4A6D7'] },
  { key: 'studio', name: 'Studio', caption: 'Cool grays, ink and slate blue, with amber for your turn. The quiet one.', swatches: ['#F7F7F8', '#18181B', '#34438A', '#FFC266'] },
  { key: 'daylight', name: 'Daylight', caption: 'Bright white, blue and ocean cyan, with tangerine for your turn. The familiar one.', swatches: ['#FFFFFF', '#0B57D0', '#006A8E', '#FFB27A'] },
  { key: 'breeze', name: 'Breeze', caption: 'Sunny white, sea teal and ocean blue, with sun yellow for your turn. A brighter look.', swatches: ['#FFFCF6', '#0F6E78', '#1D5F8C', '#FFD666'] },
  { key: 'clay', name: 'Ink and clay', caption: 'Rosy paper, black ink and clay, with peacock blue for your turn. The bold one.', swatches: ['#FBF4F1', '#1F1B16', '#9A4128', '#8ED8E8'] },
  { key: 'contrast', name: 'High contrast', caption: 'Strong lines and bold color. Easy to read in glare or at a distance.', swatches: ['#FFFFFF', '#0033CC', '#5A1FB0', '#FFB000'] },
]

const KNOWN: Palette[] = ['studio', 'daylight', 'breeze', 'clay', 'contrast']

function apply(p: Palette) {
  if (p === 'hourelle') document.documentElement.removeAttribute('data-palette')
  else document.documentElement.setAttribute('data-palette', p)
  setPrefPalette(p)
}

function Swatches({ p, size = 14 }: { p: (typeof PALETTES)[number]; size?: number }) {
  return (
    <span className="flex items-center gap-1">
      {p.swatches.map((c) => <span key={c} className="rounded-full border border-black/10" style={{ height: size, width: size, background: c }} />)}
    </span>
  )
}

export function AppearancePicker() {
  // read after mount so the server render never guesses wrong
  const [palette, setPalette] = useState<Palette | null>(null)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const sync = () => {
      const saved = prefPalette()
      setPalette(KNOWN.includes(saved as Palette) ? (saved as Palette) : 'hourelle')
    }
    sync()
    // a reset from the settings page clears the choice underneath this picker
    window.addEventListener(PREFS_CHANGED, sync)
    return () => window.removeEventListener(PREFS_CHANGED, sync)
  }, [])

  const current = PALETTES.find((p) => p.key === palette) ?? PALETTES[0]

  function pick(p: Palette) {
    setPalette(p)
    apply(p)
  }

  return (
    <div>
      {/* the closed state: what's on now, and a way in — nothing else */}
      <button
        type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className="flex w-full items-center gap-2.5 rounded-[10px] border border-border bg-s0 px-3 py-2 text-left hover:bg-s2"
      >
        <Swatches p={current} />
        <span className="text-[13.5px] font-semibold">{palette ? current.name : '…'}</span>
        <span className="ml-auto flex items-center gap-1 text-[12.5px] font-medium text-dim">
          Change <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {open && (
        <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {PALETTES.map((p) => {
            const active = palette === p.key
            return (
              <button
                key={p.key} type="button" onClick={() => pick(p.key)} aria-pressed={active} title={p.caption}
                className="flex min-w-0 items-center gap-2 rounded-[10px] border bg-s0 px-2.5 py-2 text-left hover:bg-s2"
                style={{ borderColor: active ? 'var(--accent)' : 'var(--border)', boxShadow: active ? 'inset 0 0 0 1px var(--accent)' : undefined }}
              >
                <Swatches p={p} size={11} />
                <span className="min-w-0 truncate text-[12.5px] font-semibold">{p.name}</span>
                {active && (
                  <span className="ml-auto grid h-4 w-4 flex-none place-items-center rounded-full bg-accent text-on-accent">
                    <Check size={10} />
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
