'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Compass } from 'lucide-react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { answerTourAsk, startTour, tourAskPending } from '@/lib/prefs'
import { AUTH_SETTLED, authSettled, currentAccount } from '@/lib/session'
import { useFocusTrap } from '@/hooks/useFocusTrap'

/* The one question a guest gets, the moment they arrive at an event new to them:
   have you been here before? "Show me around" starts the tour on this very event;
   "I know my way" closes it. It is asked per arrival, not per device, so a second
   guest on a shared browser is asked too, and someone returning to their own entry
   is not (see askAboutTour). The event page mounts it next to the tour.

   It is the guest's offer only. An account was asked the same thing on the welcome
   steps, so a signed-in person is never asked twice — and the question waits for auth
   to answer before believing nobody is signed in. */
export function AskTour({ eventId }: { eventId: string }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  // read after mount, so the server render and the first paint agree
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null
    const check = () => {
      if (t || !authSettled()) return
      t = setTimeout(() => {
        if (tourAskPending(eventId) && !currentAccount().signedIn && window.innerWidth >= 360) setOpen(true)
      }, 600)
    }
    check()
    window.addEventListener(AUTH_SETTLED, check)
    return () => { if (t) clearTimeout(t); window.removeEventListener(AUTH_SETTLED, check) }
  }, [eventId])

  useGSAP(() => {
    if (!open) return
    gsap.fromTo('.ask-back', { opacity: 0 }, { opacity: 1, duration: 0.2 })
    gsap.fromTo('.ask-card', { opacity: 0, y: 12, scale: 0.98 }, { opacity: 1, y: 0, scale: 1, duration: 0.28, ease: 'power3.out' })
  }, { dependencies: [open], scope: root })

  // focus lands on "Show me around" and stays in the card until it is answered
  useFocusTrap(root, { active: open })
  // Escape is the same answer as "I know my way"
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      answerTourAsk()
      setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

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
        {/* stacked on a phone, where each one is a thumb's target and gets the height
            to match; side by side from sm up, where they can be the usual size */}
        <div className="mt-5 flex flex-col gap-2.5 sm:mt-4 sm:flex-row-reverse sm:gap-2">
          <button type="button" onClick={() => choose(true)} className="flex h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-accent sm:w-auto sm:flex-1 px-5 text-[15px] font-semibold text-on-accent sm:h-11 sm:rounded-[10px] sm:text-[14px]">
            Show me around
          </button>
          <button type="button" onClick={() => choose(false)} className="flex h-[52px] w-full items-center justify-center rounded-xl border border-border2 bg-s1 sm:w-auto sm:flex-1 px-5 text-[15px] font-semibold hover:bg-s2 sm:h-11 sm:rounded-[10px] sm:text-[14px]">
            I know my way
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
