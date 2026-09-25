'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, X } from 'lucide-react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { LEGAL, LEGAL_EFFECTIVE, readingMinutes, type LegalKey } from '@/content/legal'
import { LegalDocument } from './ui/LegalDocument'
import { useFocusTrap } from '@/hooks/useFocusTrap'

/* The sign-up gate: one box per document. A box stays locked until its document has
   been read to the end, so nobody agrees to something they never saw, and both boxes
   have to be ticked before an account can be made. The document opens in a sheet
   over the form, with the same text the /privacy and /terms pages show, so nothing
   typed so far is lost to a page change; the sheet's Done waits for the last line. */
const ORDER: LegalKey[] = ['privacy', 'terms']
const NONE: Record<LegalKey, boolean> = { privacy: false, terms: false }

export function LegalGate({ onChange }: { onChange: (accepted: boolean) => void }) {
  const [read, setRead] = useState(NONE) // reached the end of the text
  const [ticked, setTicked] = useState(NONE)
  const [open, setOpen] = useState<LegalKey | null>(null)

  function tick(k: LegalKey, v: boolean) {
    const next = { ...ticked, [k]: v }
    setTicked(next)
    onChange(next.privacy && next.terms)
  }

  return (
    <div className="mt-2 flex flex-col gap-2">
      {ORDER.map((k) => {
        const doc = LEGAL[k]
        const can = read[k]
        const id = `legal-${k}`
        return (
          <div key={k} className="flex items-start gap-2.5">
            <input
              id={id} type="checkbox" checked={ticked[k]} disabled={!can}
              onChange={(e) => tick(k, e.target.checked)}
              className={`mt-[3px] h-4 w-4 flex-none ${can ? 'cursor-pointer' : 'cursor-not-allowed opacity-40'}`}
              style={{ accentColor: 'var(--accent)' }}
              title={can ? undefined : `Read the ${doc.title} to the end first`}
              aria-label={`I have read and agree to the ${doc.title}`}
            />
            {/* the sentence stays quiet; the name of the document is the one live thing in it */}
            <p className={`text-[13px] leading-[1.5] ${can ? 'text-dim' : 'text-faint'}`}>
              <label htmlFor={id} className={can ? 'cursor-pointer' : 'cursor-not-allowed'}>I have read and agree to the </label>
              <button type="button" onClick={() => setOpen(k)} className="font-semibold text-accent-text underline underline-offset-2 hover:text-accent">
                {doc.title}
              </button>
              <label htmlFor={id} className={can ? 'cursor-pointer' : 'cursor-not-allowed'}>.</label>
            </p>
          </div>
        )
      })}
      {open && <LegalSheet k={open} read={read[open]} onRead={() => setRead((r) => (r[open] ? r : { ...r, [open]: true }))} onClose={() => setOpen(null)} />}
    </div>
  )
}

/** One legal document in a sheet over the page, with a bar that shows how much of
 *  it has gone by. With `onRead`, Done waits until the last line has been on screen
 *  and reports it once; without it (the "By continuing" line on the log-in form)
 *  the sheet is only for reading and Done is always there. */
export function LegalSheet({ k, read = true, onRead, onClose }: { k: LegalKey; read?: boolean; onRead?: () => void; onClose: () => void }) {
  const root = useRef<HTMLDivElement>(null)
  const bar = useRef<HTMLDivElement>(null)
  const text = useRef<HTMLDivElement | null>(null)
  const [atEnd, setAtEnd] = useState(read || !onRead)
  // the end is reported once; the ref callback below runs on every render, so
  // without this the report would feed the render that repeats it
  const done = useRef(read || !onRead)
  const doc = LEGAL[k]

  // how far down the reader is, on the bar; the end is reached when the text fit
  // without scrolling or the last line is in view
  const check = (el: HTMLDivElement | null) => {
    if (!el) return
    const room = el.scrollHeight - el.clientHeight
    if (bar.current) bar.current.style.width = `${room <= 0 ? 100 : Math.min(100, (el.scrollTop / room) * 100)}%`
    if (done.current) return
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 8) { done.current = true; setAtEnd(true); onRead?.() }
  }

  useGSAP(() => {
    gsap.fromTo('.lg-back', { opacity: 0 }, { opacity: 1, duration: 0.2 })
    gsap.fromTo('.lg-panel', { opacity: 0, y: 14, scale: 0.98 }, { opacity: 1, y: 0, scale: 1, duration: 0.28, ease: 'power3.out' })
  }, { scope: root })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  // focus starts on the text itself, so the arrow keys and Page Down read it to the end
  useFocusTrap(root, { initial: text })

  // on the body, not inside the form: the sign-up card animates in with a transform,
  // and a fixed backdrop inside a transformed box only ever covers that box
  return createPortal(
    <div ref={root} className="fixed inset-0 z-[70] grid place-items-center p-3 sm:p-6" role="dialog" aria-modal="true" aria-label={doc.title}>
      <div className="lg-back absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="lg-panel relative flex max-h-[calc(100dvh-24px)] w-full max-w-[680px] flex-col overflow-hidden rounded-2xl border border-border bg-s1 shadow-soft sm:max-h-[calc(100dvh-48px)]">
        <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-4">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[.13em] text-faint">{doc.eyebrow}</div>
            <div className="truncate font-serif text-[22px] leading-tight">{doc.title}</div>
            <div className="mt-0.5 text-[12px] text-faint">Effective {LEGAL_EFFECTIVE}. About {readingMinutes(doc)} min to read.</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 flex-none place-items-center rounded-[9px] text-dim hover:bg-s2 hover:text-text"><X size={17} /></button>
        </div>
        {/* the reading bar: how much of the text has gone by */}
        <div className="h-[3px] w-full bg-s2" aria-hidden>
          <div ref={bar} className="h-full bg-accent" style={{ width: '0%' }} />
        </div>
        <div
          ref={(el) => { text.current = el; check(el) }}
          tabIndex={0}
          onScroll={(e) => check(e.currentTarget)}
          className="scroll-slim min-h-0 flex-1 overflow-y-auto px-5 py-5 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent sm:px-7"
        >
          <LegalDocument k={k} compact />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3">
          <span className="text-[12.5px] text-dim">{onRead && !atEnd ? 'Scroll to the end to continue.' : ''}</span>
          <button
            type="button" onClick={onClose} disabled={!atEnd}
            className="flex h-10 items-center gap-1.5 rounded-[9px] bg-accent px-4 text-[13.5px] font-semibold text-on-accent disabled:opacity-40"
          >
            <Check size={15} /> Done
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
