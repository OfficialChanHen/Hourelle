'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Compass } from 'lucide-react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { answerTourAsk, startTour, tourAskPending } from '@/lib/prefs'

/* The one question a guest gets, once per device, the moment they land in an event
   with their name: have you been here before? "Show me around" starts the tour on
   this very event; "I know my way" closes it. Either answer is remembered, so no
   later join asks again. The event page mounts it next to the tour. */
export function AskTour() {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  // read after mount, so the server render and the first paint agree
  useEffect(() => {
    const t = setTimeout(() => { if (tourAskPending() && window.innerWidth >= 360) setOpen(true) }, 600)
    return () => clearTimeout(t)
  }, [])

  useGSAP(() => {
    if (!open) return
    gsap.fromTo('.ask-back', { opacity: 0 }, { opacity: 1, duration: 0.2 })
    gsap.fromTo('.ask-card', { opacity: 0, y: 12, scale: 0.98 }, { opacity: 1, y: 0, scale: 1, duration: 0.28, ease: 'power3.out' })
  }, { dependencies: [open], scope: root })

  if (!open) return null
  const choose = (tour: boolean) => {
    answerTourAsk()
    setOpen(false)
    if (tour) startTour()
  }
  return createPortal(
    <div ref={root} className="fixed inset-0 z-[46] grid place-items-center p-4" role="dialog" aria-modal="true" aria-label="First time here?">
      <div className="ask-back absolute inset-0 bg-black/40" />
      <div className="ask-card relative w-full max-w-[400px] rounded-2xl border border-border bg-s1 p-5 shadow-soft">
        <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-accent-bg text-accent-text"><Compass size={18} /></span>
        <div className="mt-3 font-serif text-[24px] leading-[1.12] tracking-[-0.01em]">First time on Hourelle?</div>
        <p className="mt-2 text-[13.5px] leading-[1.55] text-dim">A short tour shows where things are on this event and lets you try them as you go. It takes about a minute, and you can leave it at any point.</p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row-reverse">
          <button type="button" onClick={() => choose(true)} className="flex h-11 flex-1 items-center justify-center gap-2 rounded-[10px] bg-accent text-[14px] font-semibold text-on-accent">
            Show me around
          </button>
          <button type="button" onClick={() => choose(false)} className="flex h-11 flex-1 items-center justify-center rounded-[10px] border border-border2 bg-s1 text-[14px] font-semibold hover:bg-s2">
            I know my way
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
