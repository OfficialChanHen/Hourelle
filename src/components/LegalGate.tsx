'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronRight, FileText, X } from 'lucide-react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { LEGAL, LEGAL_EFFECTIVE, readingMinutes, type LegalKey } from '@/content/legal'
import { LegalDocument } from './ui/LegalDocument'

/* The sign-up gate: both documents have to be opened and read to their end before
   the box can be ticked, and the box has to be ticked before an account can be made.
   Each opens in a sheet with a reading bar; the sheet shows the same text the
   /privacy and /terms pages show. */
const ORDER: LegalKey[] = ['privacy', 'terms']

export function LegalGate({ accepted, onChange }: { accepted: boolean; onChange: (v: boolean) => void }) {
  const [read, setRead] = useState<Record<LegalKey, boolean>>({ privacy: false, terms: false })
  const [open, setOpen] = useState<LegalKey | null>(null)
  const allRead = read.privacy && read.terms
  const readCount = ORDER.filter((k) => read[k]).length
  return (
    <div className="mt-2 rounded-[12px] border border-border bg-s0 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[.13em] text-faint">Before you create an account</p>
        <p className="text-[12px] tabular-nums text-faint">{readCount} of {ORDER.length} read</p>
      </div>
      <p className="mt-1 text-[13px] leading-[1.55] text-dim">Please read both documents to the end. The box below unlocks once you have.</p>
      <div className="mt-3 overflow-hidden rounded-[10px] border border-border bg-s1">
        {ORDER.map((k, i) => {
          const doc = LEGAL[k]
          const done = read[k]
          return (
            <button
              key={k} type="button" onClick={() => setOpen(k)}
              className={`flex w-full items-center gap-3 px-3.5 py-3 text-left hover:bg-s2 ${i > 0 ? 'border-t border-border' : ''}`}
            >
              <span className={`grid h-8 w-8 flex-none place-items-center rounded-[9px] border ${done ? 'border-teal-border bg-teal-bg text-teal-text' : 'border-border bg-s0 text-dim'}`}>
                {done ? <Check size={15} /> : <FileText size={15} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-semibold">{doc.title}</span>
                <span className="block text-[12px] text-faint">{done ? 'Read to the end' : `About ${readingMinutes(doc)} min`}</span>
              </span>
              <ChevronRight size={16} className="flex-none text-faint" />
            </button>
          )
        })}
      </div>
      <label className={`mt-3 flex items-start gap-2.5 ${allRead ? 'cursor-pointer' : 'opacity-50'}`}>
        <input
          type="checkbox" checked={accepted} disabled={!allRead}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-[3px] h-4 w-4 flex-none" style={{ accentColor: 'var(--accent)' }}
          aria-label="I have read and agree to the Privacy Policy and the Terms and Conditions"
        />
        <span className="text-[13px] leading-[1.5]">I have read and agree to the Privacy Policy and the Terms and Conditions.</span>
      </label>
      {open && (
        <LegalSheet
          k={open}
          read={read[open]}
          onRead={() => setRead((r) => (r[open] ? r : { ...r, [open]: true }))}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  )
}

function LegalSheet({ k, read, onRead, onClose }: { k: LegalKey; read: boolean; onRead: () => void; onClose: () => void }) {
  const root = useRef<HTMLDivElement>(null)
  const box = useRef<HTMLDivElement | null>(null)
  const bar = useRef<HTMLDivElement>(null)
  const [atEnd, setAtEnd] = useState(read)
  // the moment the end is reached is reported once; the ref callback below runs on
  // every render, so without this the report would feed the render that repeats it
  const done = useRef(read)
  const doc = LEGAL[k]

  // how far down the reader is, on the bar; the end is reached when the text fit
  // without scrolling or the last line is in view
  const check = (el: HTMLDivElement | null) => {
    if (!el) return
    const room = el.scrollHeight - el.clientHeight
    if (bar.current) bar.current.style.width = `${room <= 0 ? 100 : Math.min(100, (el.scrollTop / room) * 100)}%`
    if (done.current) return
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 8) { done.current = true; setAtEnd(true); onRead() }
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
          ref={(el) => { box.current = el; check(el) }}
          onScroll={(e) => check(e.currentTarget)}
          className="scroll-slim min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7"
        >
          <LegalDocument k={k} compact />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3">
          <span className={`text-[12.5px] ${atEnd ? 'text-teal-text' : 'text-dim'}`}>{atEnd ? 'Read to the end. Thank you.' : 'Scroll to the end to continue.'}</span>
          <button
            type="button" onClick={onClose} disabled={!atEnd}
            className="flex h-10 items-center gap-1.5 rounded-[9px] bg-accent px-4 text-[13.5px] font-semibold text-on-accent disabled:opacity-40"
          >
            <Check size={15} /> I have read this
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
