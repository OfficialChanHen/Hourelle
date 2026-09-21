'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowRight, Check } from 'lucide-react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { dismissHint, hintDismissed, setTourWanted, tourWanted } from '@/lib/prefs'

/* The tour: four stops on an event page, each a spotlight on one element and a
   card with one sentence. It runs once, only when it was asked for (the welcome
   steps, or Settings), never on a screen narrower than a phone, and Skip is on
   every card. Elements opt in with data-tour="<name>"; a stop lists the names it
   can point at, first visible wins, and a stop with nothing to point at is left
   out rather than pointing at air. */

type Candidate = { sel: string; title: string; text: string }
type Stop = Candidate[]

const STOPS: Stop[] = [
  [
    { sel: 'share', title: 'One link does it all', text: 'Send it to everyone. They open it, add a name and answer. Nobody needs an account.' },
    { sel: 'menu', title: 'One link does it all', text: 'The share link is in this menu. Send it to everyone: they open it, add a name and answer. Nobody needs an account.' },
  ],
  [
    { sel: 'grid', title: 'When people are free', text: 'Switch to Edit mine and drag across the hours you can make. The greener a slot, the more people can.' },
  ],
  [
    { sel: 'tabs', title: 'The rest of the plan', text: 'Location collects places and votes. Attendance shows who is coming. Details holds everything else.' },
  ],
  [
    { sel: 'lock', title: 'Lock it in', text: 'When the grid is green enough, lock in a time and a place. Everyone gets the plan.' },
    { sel: 'create', title: 'Your own event', text: 'This is where yours starts. Name it, pick some days, and the link is ready to send.' },
  ],
]

type Box = { x: number; y: number; w: number; h: number }
const PAD = 8

function visible(el: Element): boolean {
  const r = el.getBoundingClientRect()
  return r.width > 0 && r.height > 0
}
function find(stop: Stop): { c: Candidate; el: HTMLElement } | null {
  for (const c of stop) {
    const el = document.querySelector<HTMLElement>(`[data-tour="${c.sel}"]`)
    if (el && visible(el)) return { c, el }
  }
  return null
}
function boxOf(el: Element): Box {
  const r = el.getBoundingClientRect()
  return { x: r.left - PAD, y: r.top - PAD, w: r.width + PAD * 2, h: r.height + PAD * 2 }
}

export function Tour() {
  // the stops that have something to point at, decided when the tour starts
  const [plan, setPlan] = useState<Stop[] | null>(null)
  const [i, setI] = useState(0)
  const [cand, setCand] = useState<Candidate | null>(null)
  const [box, setBox] = useState<Box | null>(null)
  const el = useRef<HTMLElement | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const hole = useRef<SVGRectElement>(null)
  const first = useRef(true)

  // start: asked for, not done, and room for it
  useEffect(() => {
    if (!tourWanted() || hintDismissed('tour') || window.innerWidth < 360) return
    const t = setTimeout(() => {
      const have = STOPS.filter((s) => find(s))
      if (have.length) setPlan(have)
    }, 800)
    return () => clearTimeout(t)
  }, [])

  const finish = useCallback(() => {
    dismissHint('tour')
    setTourWanted(false)
    setPlan(null)
  }, [])

  // point at the current stop: bring it on screen, then measure
  useEffect(() => {
    if (!plan) return
    const raf = requestAnimationFrame(() => {
      const found = find(plan[i])
      if (!found) { finish(); return } // it left the page between two stops
      el.current = found.el
      found.el.scrollIntoView({ block: 'center', inline: 'nearest' })
      requestAnimationFrame(() => { setCand(found.c); setBox(boxOf(found.el)) })
    })
    return () => cancelAnimationFrame(raf)
  }, [plan, i, finish])

  // the page moves under the tour: follow the element, without ceremony
  useEffect(() => {
    if (!plan) return
    const follow = () => { if (el.current && hole.current) { const b = boxOf(el.current); gsap.set(hole.current, { attr: { x: b.x, y: b.y, width: b.w, height: b.h } }); setBox(b) } }
    window.addEventListener('resize', follow)
    window.addEventListener('scroll', follow, true)
    return () => { window.removeEventListener('resize', follow); window.removeEventListener('scroll', follow, true) }
  }, [plan])

  useEffect(() => {
    if (!plan) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish()
      if (e.key === 'ArrowRight' || e.key === 'Enter') setI((n) => (n + 1 < plan.length ? n + 1 : (finish(), n)))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [plan, finish])

  // the hole slides from stop to stop; the card fades in beside it
  useGSAP(() => {
    if (!box || !hole.current) return
    const attr = { x: box.x, y: box.y, width: box.w, height: box.h }
    if (first.current) {
      first.current = false
      gsap.set(hole.current, { attr })
      gsap.fromTo('.tour-dim', { opacity: 0 }, { opacity: 1, duration: 0.3 })
    } else {
      gsap.to(hole.current, { attr, duration: 0.45, ease: 'power3.inOut' })
    }
    gsap.fromTo('.tour-card', { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.3, delay: first.current ? 0 : 0.2, ease: 'power3.out' })
  }, { dependencies: [box], scope: root })

  if (!plan || !cand || !box) return null
  const last = i === plan.length - 1
  // below the spotlight when there is room, above it when there is room there,
  // and over its lower edge when the spotlight is taller than the screen (the
  // grid on a phone): the card has to stay on screen whatever it points at
  const vh = window.innerHeight, vw = window.innerWidth
  const H = 200 // about the card's height; exact enough to place it
  let top = box.y + box.h + 12
  if (top + H > vh) top = box.y - 12 - H
  if (top < 16) top = Math.max(16, vh - H - 16)
  const cardW = Math.min(340, vw - 32)
  const left = Math.max(16, Math.min(box.x, vw - cardW - 16))
  const style = { left, top, width: cardW }

  return createPortal(
    <div ref={root} className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label="Tour">
      <svg className="tour-dim absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <mask id="tour-hole">
            <rect width="100%" height="100%" fill="#fff" />
            <rect ref={hole} x={box.x} y={box.y} width={box.w} height={box.h} rx="12" fill="#000" />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(20,18,14,.5)" mask="url(#tour-hole)" />
      </svg>
      <div className="tour-card absolute rounded-xl border border-border bg-s1 p-4 shadow-soft" style={style}>
        <div className="text-[11px] font-semibold uppercase tracking-[.13em] text-faint">Stop {i + 1} of {plan.length}</div>
        <div className="mt-1 font-serif text-[21px] leading-[1.15] tracking-[-0.01em]">{cand.title}</div>
        <p className="mt-1.5 text-[13.5px] leading-[1.55] text-dim">{cand.text}</p>
        <div className="mt-3.5 flex items-center justify-between gap-3">
          <button type="button" onClick={finish} className="text-[13px] font-semibold text-dim hover:text-text">Skip the tour</button>
          <button
            type="button"
            onClick={() => (last ? finish() : setI(i + 1))}
            className="flex h-9 items-center gap-1.5 rounded-[9px] bg-accent px-3.5 text-[13.5px] font-semibold text-on-accent"
          >
            {last ? <>Done <Check size={14} /></> : <>Next <ArrowRight size={14} /></>}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
