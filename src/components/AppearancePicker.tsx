'use client'

import { useEffect, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'

/* Which look the whole app wears. data-palette on <html> picks the family;
   the sun/moon toggle keeps switching light and dark inside whichever is chosen.
   Collapsed by default: one row names the current look, the options stay hidden
   until asked for. Swatches are fixed previews, honest in any active theme. */
export type Palette = 'aline' | 'gcal' | 'drain' | 'pride' | 'pro' | 'contrast'

// 'aline' and 'drain' keep their storage keys from earlier picks; the cards wear
// the current names (Earthy, Frost)
const PALETTES: { key: Palette; name: string; caption: string; swatches: string[]; gradient?: string }[] = [
  { key: 'aline', name: 'Earthy', caption: 'Warm paper and deep green. The original look.', swatches: ['#F4F1EA', '#2E4A3C', '#15130E', '#9A6B2E'] },
  { key: 'gcal', name: 'Calendar', caption: 'Clean white and blue, in the spirit of Google Calendar.', swatches: ['#FFFFFF', '#0B57D0', '#131314', '#8AB4F8'] },
  { key: 'pro', name: 'Professional', caption: 'Quiet grays and navy. Safe to screen-share anywhere.', swatches: ['#F5F6F8', '#274A6D', '#14181D', '#7FA6CC'] },
  { key: 'drain', name: 'Frost', caption: 'Icy silver and chrome with a cold red accent.', swatches: ['#EDF1F6', '#C8102E', '#0D1219', '#8FB6E4'] },
  { key: 'pride', name: 'Pride', caption: 'The whole flag, all year round.', swatches: [], gradient: 'linear-gradient(90deg, #E40303, #FF8C00, #FFED00, #008026, #004CFF, #732982)' },
  { key: 'contrast', name: 'High contrast', caption: 'Strong lines and bold color. Easy to read in glare or at a distance.', swatches: ['#FFFFFF', '#0033CC', '#000000', '#C40000'] },
]

const KNOWN: Palette[] = ['gcal', 'drain', 'pride', 'pro', 'contrast']

function apply(p: Palette) {
  if (p === 'aline') document.documentElement.removeAttribute('data-palette')
  else document.documentElement.setAttribute('data-palette', p)
  try { localStorage.setItem('aline.palette', p) } catch { /* private mode */ }
}

function Swatches({ p, size = 14 }: { p: (typeof PALETTES)[number]; size?: number }) {
  if (p.gradient) return <span className="rounded-full border border-black/10" style={{ height: size, width: size * 4, background: p.gradient }} />
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
    try {
      const saved = localStorage.getItem('aline.palette')
      setPalette(KNOWN.includes(saved as Palette) ? (saved as Palette) : 'aline')
    } catch { setPalette('aline') }
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
