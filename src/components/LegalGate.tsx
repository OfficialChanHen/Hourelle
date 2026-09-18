'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, X } from 'lucide-react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { LEGAL, type LegalKey } from '@/content/legal'

/* The sign-up gate: both documents have to be opened and scrolled to their end
   before the box can be ticked, and the box has to be ticked before an account can
   be made. The sheet shows the same text the /privacy and /terms pages show. */
export function LegalGate({ accepted, onChange }: { accepted: boolean; onChange: (v: boolean) => void }) {
  const [read, setRead] = useState<Record<LegalKey, boolean>>({ privacy: false, terms: false })
  const [open, setOpen] = useState<LegalKey | null>(null)
  const allRead = read.privacy && read.terms
  return (
    <div className="mt-2 rounded-[10px] border border-border bg-s0 px-3.5 py-3">
      <p className="text-[12.5px] leading-[1.55] text-dim">Open each one and read to the end. The box unlocks after both.</p>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {(['privacy', 'terms'] as LegalKey[]).map((k) => (
          <button
            key={k} type="button" onClick={() => setOpen(k)}
            className={`flex h-9 items-center gap-1.5 rounded-[9px] border px-3 text-[13px] font-semibold ${read[k] ? 'border-teal-border bg-teal-bg text-teal-text' : 'border-border2 bg-s1 hover:bg-s2'}`}
          >
            {read[k] && <Check size={14} />} {LEGAL[k].title}
          </button>
        ))}
      </div>
      <label className={`mt-3 flex items-start gap-2.5 ${allRead ? 'cursor-pointer' : 'opacity-50'}`}>
        <input
          type="checkbox" checked={accepted} disabled={!allRead}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-[3px] h-4 w-4 flex-none" style={{ accentColor: 'var(--accent)' }}
          aria-label="I have read and agree to the Privacy Policy and the Terms of Use"
        />
        <span className="text-[13px] leading-[1.5]">I have read and agree to the Privacy Policy and the Terms of Use.</span>
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
  const [atEnd, setAtEnd] = useState(read)
  // the moment the end is reached is reported once; the ref callback below runs on
  // every render, so without this the report would feed the render that repeats it
  const done = useRef(read)
  const doc = LEGAL[k]

  // reached the end: the scroll handler says so, or the text fit without scrolling
  const check = (el: HTMLDivElement | null) => {
    if (!el || done.current) return
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

  return (
    <div ref={root} className="fixed inset-0 z-[70] grid place-items-center p-3 sm:p-6" role="dialog" aria-modal="true" aria-label={doc.title}>
      <div className="lg-back absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="lg-panel relative flex max-h-[calc(100dvh-24px)] w-full max-w-[640px] flex-col overflow-hidden rounded-2xl border border-border bg-s1 shadow-soft sm:max-h-[calc(100dvh-48px)]">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[.13em] text-faint">{doc.eyebrow}</div>
            <div className="truncate font-serif text-[21px] leading-tight">{doc.title}</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 flex-none place-items-center rounded-[9px] text-dim hover:bg-s2 hover:text-text"><X size={17} /></button>
        </div>
        <div
          ref={(el) => { box.current = el; check(el) }}
          onScroll={(e) => check(e.currentTarget)}
          className="scroll-slim min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7"
        >
          {doc.body}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3">
          <span className={`text-[12.5px] ${atEnd ? 'text-teal-text' : 'text-dim'}`}>{atEnd ? 'Read to the end.' : 'Scroll to the end to continue.'}</span>
          <button
            type="button" onClick={onClose} disabled={!atEnd}
            className="flex h-10 items-center gap-1.5 rounded-[9px] bg-accent px-4 text-[13.5px] font-semibold text-on-accent disabled:opacity-40"
          >
            <Check size={15} /> Done
          </button>
        </div>
      </div>
    </div>
  )
}
