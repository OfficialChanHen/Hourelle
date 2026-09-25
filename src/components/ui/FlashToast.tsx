'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { Check, Trash2 } from 'lucide-react'

/* One-shot toast that survives a redirect: the page that acts writes the message,
   the page that lands reads it once and drops it in from the top (same motion as
   the create-flow confirmation). Parent needs `relative` for the anchoring. */
type Flash = { text: string; tone: 'accent' | 'brick' }
const KEY = 'hourelle.flash'

const PUSHED = 'hourelle:flash'

export function pushFlash(text: string, tone: Flash['tone'] = 'accent', { forNextPage = false } = {}) {
  try { sessionStorage.setItem(KEY, JSON.stringify({ text, tone })) } catch { /* private mode */ }
  // a flash pushed with no navigation to follow (a background send reporting back)
  // is read at once rather than on the next route change. One meant for a page about
  // to load from scratch is left for it: read now, it would show on the page that is
  // leaving and be gone before the next one could.
  if (!forNextPage && typeof window !== 'undefined') window.dispatchEvent(new Event(PUSHED))
}

export function FlashToast() {
  // n tells two flashes with the same words apart, so the second is still spoken
  const [flash, setFlash] = useState<(Flash & { n: number }) | null>(null)
  const seq = useRef(0)
  const box = useRef<HTMLDivElement>(null)
  // mounted once in the layout, which client-side navigation never remounts — so
  // the queue is checked again on every route change, not just on page load
  const pathname = usePathname()

  useEffect(() => {
    const read = () => {
      try {
        const raw = sessionStorage.getItem(KEY)
        if (!raw) return
        sessionStorage.removeItem(KEY)
        seq.current += 1
        setFlash({ ...(JSON.parse(raw) as Flash), n: seq.current })
      } catch { /* private mode / bad payload */ }
    }
    read()
    window.addEventListener(PUSHED, read)
    return () => window.removeEventListener(PUSHED, read)
  }, [pathname])

  useGSAP(() => {
    if (!flash || !box.current) return
    const tl = gsap.timeline({ delay: 0.2 })
    tl.fromTo(box.current, { y: -24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: 'power3.out' })
      .to(box.current, { y: -24, opacity: 0, duration: 0.4, ease: 'power3.in', delay: 4 })
  }, { dependencies: [flash] })

  const brick = flash?.tone === 'brick'
  // a zero-height sticky rail just under the header keeps the toast in view while the
  // page scrolls, the way the header itself stays; the toast still leaves on its own
  return (
    // the rail stays mounted, empty or not: a screen reader speaks what lands in a
    // live region it already knows, not one that arrives with its words inside
    <div role="status" aria-live="polite" className="pointer-events-none sticky top-[62px] z-[45] h-0">
    {flash && (
    <div key={flash.n} ref={box} className="absolute left-1/2 top-0 w-max max-w-[calc(100vw-24px)] -translate-x-1/2 opacity-0">
      <div className="flex items-center gap-2.5 rounded-xl border border-border2 bg-s1 px-4 py-3 shadow-soft">
        <span className={`grid h-7 w-7 place-items-center rounded-full ${brick ? 'bg-brick-bg text-brick-text' : 'bg-accent-bg text-accent-text'}`}>
          {brick ? <Trash2 size={15} /> : <Check size={16} />}
        </span>
        <span className="text-[14px] font-semibold">{flash.text}</span>
      </div>
    </div>
    )}
    </div>
  )
}
