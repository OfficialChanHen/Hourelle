'use client'

import { useEffect, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { prefPalette, setPrefPalette } from '@/lib/prefs'

/* Which look the whole app wears. data-palette on <html> picks the family;
   the sun/moon toggle keeps switching light and dark inside whichever is chosen.
   Collapsed by default: one row names the current look, the options stay hidden
   until asked for. Swatches are fixed previews, honest in any active theme. */
export type Palette = 'aline' | 'studio' | 'daylight' | 'contrast'

// Four looks, each with a job: the house one, a neutral, a bright one, and one for
// low vision. 'aline' is the house key and always has been — it means no
// data-palette at all, so it follows whatever the house look currently is.
const PALETTES: { key: Palette; name: string; caption: string; swatches: string[] }[] = [
  { key: 'aline', name: 'Warm neutral', caption: 'Soft paper and deep green. The house look.', swatches: ['#F7F6F4', '#2E4A3C', '#151513', '#8F6A33'] },
  { key: 'studio', name: 'Studio', caption: 'Cool grays and ink, no serif. The quiet one.', swatches: ['#F7F7F8', '#18181B', '#0F0F10', '#2F7A5A'] },
  { key: 'daylight', name: 'Daylight', caption: 'Bright white and a clear blue. The most familiar of the four.', swatches: ['#FFFFFF', '#0B57D0', '#131314', '#8AB4F8'] },
  { key: 'contrast', name: 'High contrast', caption: 'Strong lines and bold color. Easy to read in glare or at a distance.', swatches: ['#FFFFFF', '#0033CC', '#000000', '#C40000'] },
]

const KNOWN: Palette[] = ['studio', 'daylight', 'contrast']

function apply(p: Palette) {
  if (p === 'aline') document.documentElement.removeAttribute('data-palette')
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
    const saved = prefPalette()
    setPalette(KNOWN.includes(saved as Palette) ? (saved as Palette) : 'aline')
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
