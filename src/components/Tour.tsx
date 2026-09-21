'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { ArrowRight, Check, PlayCircle } from 'lucide-react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { dismissHint, hintDismissed, setTourWanted, tourWanted } from '@/lib/prefs'

/* The tour: a spotlight on one element at a time, a card that says where it is and
   how it works, and a line inviting the person to try it there and then. The page
   stays live underneath: the dim is only a picture, so a drag on the grid or a vote
   on the ballot works while the card is up. Stops on other tabs switch the tab
   themselves. It runs once, only when it was asked for (the welcome steps, or
   Settings), never on a screen narrower than a phone, and Skip is on every card.
   Elements opt in with data-tour="<name>", tabs with data-tour-tab="<key>"; a stop
   lists the names it can point at, first visible wins, and a stop with nothing to
   point at is left out rather than pointing at air. The last card has no target:
   it points at the Help page's clips. */

type Candidate = { sel: string; title: string; text: string; tryIt?: string }
type Stop = { tab?: string; targets: Candidate[] } | { end: true }

const STOPS: Stop[] = [
  { tab: 'availability', targets: [
    { sel: 'share', title: 'One link does it all', text: 'Send it to everyone. They open it, add a name and answer. Nobody needs an account.', tryIt: 'Open Share link and copy it.' },
    { sel: 'menu', title: 'One link does it all', text: 'The share link is in this menu. Send it to everyone: they open it, add a name and answer. Nobody needs an account.', tryIt: 'Open the menu and copy the link.' },
  ] },
  { tab: 'availability', targets: [
    { sel: 'grid', title: 'When people are free', text: 'Switch to Edit mine and drag across the hours you can make. The greener a slot, the more people can.', tryIt: 'Drag across a few hours.' },
  ] },
  { tab: 'location', targets: [
    { sel: 'location', title: 'Where it happens', text: 'Places go on the ballot and everyone votes. The host locks in the winner, or builds a route through the top picks.', tryIt: 'Vote for a place, or add one.' },
  ] },
  { tab: 'attendance', targets: [
    { sel: 'attendance', title: 'Who is coming', text: 'Once the plan is locked in, everyone says whether they can make it, and this tab counts them by stop and by person.', tryIt: 'Come back here after the lock-in.' },
  ] },
  { tab: 'details', targets: [
    { sel: 'details', title: 'Everything else', text: 'The description, the budget, the dates, the people on the list and the invites by email all live here.', tryIt: 'Add a line about the plan.' },
  ] },
  { tab: 'availability', targets: [
    { sel: 'lock', title: 'Lock it in', text: 'When the grid is green enough, lock in a time and a place. Everyone gets the plan.', tryIt: 'Press it when the answers are in.' },
    { sel: 'create', title: 'Your own event', text: 'This is where yours starts. Name it, pick some days, and the link is ready to send.', tryIt: 'Make one when you are ready.' },
  ] },
  { end: true },
]

type Box = { x: number; y: number; w: number; h: number }
const PAD = 8

function visible(el: Element): boolean {
  const r = el.getBoundingClientRect()
  return r.width > 0 && r.height > 0
}
function find(stop: Stop): { c: Candidate; el: HTMLElement } | null {
  if ('end' in stop) return null
  for (const c of stop.targets) {
    const el = document.querySelector<HTMLElement>(`[data-tour="${c.sel}"]`)
    if (el && visible(el)) return { c, el }
  }
  return null
}
function boxOf(el: Element): Box {
  const r = el.getBoundingClientRect()
  return { x: r.left - PAD, y: r.top - PAD, w: r.width + PAD * 2, h: r.height + PAD * 2 }
}
function activeTab(): string | null {
  return document.querySelector<HTMLElement>('[data-tour-tab][data-active="true"]')?.getAttribute('data-tour-tab') ?? null
}
function switchTab(key: string) {
  if (activeTab() === key) return
  document.querySelector<HTMLElement>(`[data-tour-tab="${key}"]`)?.click()
}

export function Tour() {
  const [plan, setPlan] = useState<Stop[] | null>(null)
  const [i, setI] = useState(0)
  const [cand, setCand] = useState<Candidate | null>(null)
  const [box, setBox] = useState<Box | null>(null)
  const el = useRef<HTMLElement | null>(null)
  const last = useRef<Box | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const hole = useRef<SVGRectElement>(null)
  const first = useRef(true)

  // start: asked for, not done, and room for it. Stops on the current tab are
  // checked now; stops on other tabs are taken on trust and checked when reached.
  useEffect(() => {
    if (!tourWanted() || hintDismissed('tour') || window.innerWidth < 360) return
    const t = setTimeout(() => {
      const here = activeTab()
      const have = STOPS.filter((s) => 'end' in s || s.tab !== here || find(s))
      if (have.length > 1) setPlan(have)
    }, 800)
    return () => clearTimeout(t)
  }, [])

  const finish = useCallback(() => {
    dismissHint('tour')
    setTourWanted(false)
    setPlan(null)
  }, [])

  // point at the current stop: switch its tab, wait for the element, bring it on screen
  useEffect(() => {
    if (!plan) return
    const stop = plan[i]
    let tries = 0
    const timer = setInterval(() => {
      if ('end' in stop) { clearInterval(timer); el.current = null; last.current = null; setCand(null); setBox(null); return }
      if (tries === 0) switchTab(stop.tab ?? 'availability')
      const found = find(stop)
      if (!found) {
        if (++tries < 15) return
        clearInterval(timer)
        setI((n) => n + 1) // nothing to point at here: on to the next
        return
      }
      clearInterval(timer)
      el.current = found.el
      found.el.scrollIntoView({ block: 'center', inline: 'nearest' })
      requestAnimationFrame(() => { const b = boxOf(found.el); last.current = b; setCand(found.c); setBox(b) })
    }, 100)
    return () => clearInterval(timer)
  }, [plan, i])

  // the page is live under the tour, so the element moves: follow it every few frames
  useEffect(() => {
    if (!plan) return
    let raf = 0, n = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      if (++n % 4 || !el.current) return
      if (!document.contains(el.current)) return
      const b = boxOf(el.current), p = last.current
      if (p && Math.abs(b.x - p.x) < 1 && Math.abs(b.y - p.y) < 1 && Math.abs(b.w - p.w) < 1 && Math.abs(b.h - p.h) < 1) return
      last.current = b
      if (hole.current) gsap.to(hole.current, { attr: { x: b.x, y: b.y, width: b.w, height: b.h }, duration: 0.2, overwrite: 'auto' })
      setBox(b)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [plan])

  // Escape leaves, but only from the page itself, never out of a field being typed in
  useEffect(() => {
    if (!plan) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && document.activeElement === document.body) finish() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [plan, finish])

  // the hole slides from stop to stop; the card fades in beside it
  useGSAP(() => {
    if (!plan) return
    if (box && hole.current) {
      const attr = { x: box.x, y: box.y, width: box.w, height: box.h }
      if (first.current) { first.current = false; gsap.set(hole.current, { attr }); gsap.fromTo('.tour-dim', { opacity: 0 }, { opacity: 1, duration: 0.3 }) }
      else gsap.to(hole.current, { attr, duration: 0.45, ease: 'power3.inOut', overwrite: 'auto' })
    } else if (hole.current) {
      gsap.to(hole.current, { attr: { width: 0, height: 0 }, duration: 0.3, overwrite: 'auto' })
    }
    gsap.fromTo('.tour-card', { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.3, delay: 0.15, ease: 'power3.out' })
  }, { dependencies: [i, cand === null], scope: root })

  if (!plan) return null
  const stop = plan[i]
  const ending = 'end' in stop
  if (!ending && (!cand || !box)) return null
  const count = plan.filter((s) => !('end' in s)).length
  const isLast = i === plan.length - 1
  const vh = window.innerHeight, vw = window.innerWidth
  const cardW = Math.min(360, vw - 32)
  // below the spotlight when there is room, above it when there is room there, and
  // over its lower edge when the spotlight is taller than the screen; the end card
  // sits in the middle
  const H = 220
  let left = (vw - cardW) / 2, top = Math.max(16, vh / 2 - H / 2)
  if (box) {
    top = box.y + box.h + 12
    if (top + H > vh) top = box.y - 12 - H
    if (top < 16) top = Math.max(16, vh - H - 16)
    left = Math.max(16, Math.min(box.x, vw - cardW - 16))
  }

  return createPortal(
    <div ref={root} className="pointer-events-none fixed inset-0 z-[80]" role="dialog" aria-label="Tour">
      <svg className="tour-dim absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <mask id="tour-hole">
            <rect width="100%" height="100%" fill="#fff" />
            <rect ref={hole} x={box?.x ?? 0} y={box?.y ?? 0} width={box?.w ?? 0} height={box?.h ?? 0} rx="12" fill="#000" />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(20,18,14,.45)" mask="url(#tour-hole)" />
      </svg>
      <div className="tour-card pointer-events-auto absolute rounded-xl border border-border bg-s1 p-4 shadow-soft" style={{ left, top, width: cardW }}>
        {ending ? (
          <>
            <div className="text-[11px] font-semibold uppercase tracking-[.13em] text-faint">The end</div>
            <div className="mt-1 font-serif text-[21px] leading-[1.15] tracking-[-0.01em]">That is the tour</div>
            <p className="mt-1.5 text-[13.5px] leading-[1.55] text-dim">Four short clips on the Help page show each step from start to finish: making an event, marking times, picking a place and locking in.</p>
            <div className="mt-3.5 flex items-center justify-between gap-3">
              <Link href="/help#watch" onClick={finish} className="flex items-center gap-1.5 text-[13px] font-semibold text-accent-text hover:underline">
                <PlayCircle size={15} /> Watch the clips
              </Link>
              <button type="button" onClick={finish} className="flex h-9 items-center gap-1.5 rounded-[9px] bg-accent px-3.5 text-[13.5px] font-semibold text-on-accent">
                Done <Check size={14} />
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="text-[11px] font-semibold uppercase tracking-[.13em] text-faint">Stop {i + 1} of {count}</div>
            <div className="mt-1 font-serif text-[21px] leading-[1.15] tracking-[-0.01em]">{cand!.title}</div>
            <p className="mt-1.5 text-[13.5px] leading-[1.55] text-dim">{cand!.text}</p>
            {cand!.tryIt && (
              <p className="mt-2 text-[13.5px] leading-[1.55]"><span className="font-semibold text-accent-text">Try it.</span> <span className="text-text">{cand!.tryIt}</span></p>
            )}
            <div className="mt-3.5 flex items-center justify-between gap-3">
              <button type="button" onClick={finish} className="text-[13px] font-semibold text-dim hover:text-text">Skip the tour</button>
              <button
                type="button"
                onClick={() => (isLast ? finish() : setI(i + 1))}
                className="flex h-9 items-center gap-1.5 rounded-[9px] bg-accent px-3.5 text-[13.5px] font-semibold text-on-accent"
              >
                Next <ArrowRight size={14} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
