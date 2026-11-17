'use client'

// The question asked before leaving a page with something unsaved (lib/leave-guard),
// and the two ways out it watches for. Mounted once in the root layout.
//
// Links: one click listener on the document, in the capture phase, runs before
// next/link's own handler; when it cancels the click, Link sees defaultPrevented and
// stays put. That covers every Link and plain <a> without wrapping each one.
// Back and forward: the browser has already moved the address by the time it says so,
// so the listener stops Next from following, puts the page's entry back, and goes on
// to where the person was headed only once they answer.
// Closing the tab or the window is not watched at all: the draft goes with the page.

import { useEffect, useId, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { Loader2, X } from 'lucide-react'
import { confirmLeave, hasUnsaved, leavesPage, onAsk, watchDrafts, type LeaveAnswer } from '@/lib/leave-guard'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { reducedMotion } from '@/lib/prefs'
import { DUR, EASE } from '@/lib/motion'

export function LeaveGuard() {
  const router = useRouter()
  const [answer, setAnswer] = useState<((a: LeaveAnswer) => void) | null>(null)

  useEffect(() => onAsk((done) => setAnswer(() => done)), [])

  useEffect(() => {
    // the page entry to put back when back or forward is pressed with a draft open,
    // noted each time a draft is held (Next keeps its page tree in it)
    let entry: { state: unknown; url: string } | null = null
    const offWatch = watchDrafts(() => {
      entry = hasUnsaved() ? { state: window.history.state, url: window.location.href } : null
    })
    // after an answer the way out is clear: the next navigation is ours, not a new ask
    let passing = false
    const go = (href: string) => { passing = true; router.push(href); setTimeout(() => { passing = false }, 0) }

    const onClick = (e: MouseEvent) => {
      if (passing || e.defaultPrevented || e.button !== 0 || !hasUnsaved()) return
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!a) return
      const modified = e.metaKey || e.ctrlKey || e.shiftKey || e.altKey
      if (!leavesPage(a.href, window.location.href, { target: a.getAttribute('target'), download: a.hasAttribute('download'), modified })) return
      e.preventDefault()
      const href = a.href
      void confirmLeave().then((ok) => { if (ok) go(href) })
    }
    const onPop = (e: PopStateEvent) => {
      if (passing || !hasUnsaved() || !entry) return
      const to = window.location.href
      if (!leavesPage(to, entry.url)) return
      e.stopImmediatePropagation()
      window.history.pushState(entry.state, '', entry.url)
      void confirmLeave().then((ok) => { if (ok) go(to) })
    }
    document.addEventListener('click', onClick, true)
    // capture on window runs before Next's own popstate listener on the same target
    window.addEventListener('popstate', onPop, true)
    return () => {
      offWatch()
      document.removeEventListener('click', onClick, true)
      window.removeEventListener('popstate', onPop, true)
    }
  }, [router])

  if (!answer) return null
  return <LeaveDialog onAnswer={(a) => { setAnswer(null); answer(a) }} />
}

function LeaveDialog({ onAnswer }: { onAnswer: (a: LeaveAnswer) => void }) {
  const root = useRef<HTMLDivElement>(null)
  const card = useRef<HTMLDivElement>(null)
  const saveBtn = useRef<HTMLButtonElement>(null)
  const [saving, setSaving] = useState(false)
  const titleId = useId()

  useGSAP(() => {
    if (reducedMotion()) return
    gsap.timeline()
      .fromTo(root.current, { opacity: 0 }, { opacity: 1, duration: DUR.ui, ease: 'power2.out' })
      .fromTo(card.current, { y: 10, scale: 0.98 }, { y: 0, scale: 1, duration: DUR.ui, ease: EASE.out }, '<')
  }, { scope: root })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onAnswer('stay') } }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onAnswer])
  useFocusTrap(root, { initial: saveBtn })

  return (
    <div
      ref={root}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-[80] grid place-items-center bg-[rgba(0,0,0,.25)] p-4"
      onPointerDown={(e) => { if (e.target === e.currentTarget && !saving) onAnswer('stay') }}
    >
      <div ref={card} className="w-full max-w-[380px] rounded-2xl border border-border bg-s1 p-5 shadow-soft">
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="pt-1 text-[16px] font-semibold leading-snug">Save your changes before you go?</h2>
          <button onClick={() => onAnswer('stay')} disabled={saving} aria-label="Stay on this page" className="hit-area -mr-1.5 -mt-0.5 grid h-8 w-8 flex-none place-items-center rounded-full text-dim hover:bg-s2 hover:text-text">
            <X size={16} />
          </button>
        </div>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            onClick={() => onAnswer('discard')} disabled={saving}
            className="h-11 rounded-full border border-border2 bg-s1 px-4 text-[14px] font-semibold text-dim hover:bg-s2 disabled:opacity-40 sm:h-9 sm:text-[13px]"
          >
            Don&apos;t save
          </button>
          <button
            ref={saveBtn}
            onClick={() => { setSaving(true); onAnswer('save') }} disabled={saving}
            className="flex h-11 items-center justify-center gap-1.5 rounded-full bg-accent px-4 text-[14px] font-semibold text-on-accent disabled:opacity-60 sm:h-9 sm:text-[13px]"
          >
            {saving && <Loader2 size={15} className="animate-spin" />} Save
          </button>
        </div>
      </div>
    </div>
  )
}
