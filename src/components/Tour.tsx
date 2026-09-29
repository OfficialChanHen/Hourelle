'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowLeft, ArrowRight, Check, PlayCircle } from 'lucide-react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { TOUR_START, dismissHint, hintDismissed, setTourWanted, tourWanted, reducedMotion } from '@/lib/prefs'
import { useHeatLine, withHeatLine } from '@/hooks/useHeatLine'

/* The tour: a spotlight on one element at a time, a card that says where it is and
   how it works, and, where it makes sense, a line inviting the person to try it
   there and then. The page stays live underneath: the dim is only a picture, and
   it sits below popovers and modals, so a menu or a lock-in opened from a card
   shows in full. A spotlight covers everything a card asks for, toolbar included,
   so the toggle a card names can be pressed while the card is up.

   The cards speak to whoever is reading. A host is told about the link they send
   and the plan they lock in; a guest is told what a guest can do, since inviting
   and locking in are not theirs, and their last stops are the ballot and the
   discussion instead. Stops on other tabs switch the tab themselves.

   It runs once, only when it was asked for (the welcome steps, Settings, or the
   question a new guest gets), never on a screen narrower than a phone, and Skip is
   on every card. Elements opt in with data-tour="<name>", tabs with
   data-tour-tab="<key>"; a stop lists the names it can point at, first visible
   wins, and a stop with nothing to point at is left out. On a phone the card sits
   at the bottom, clear of the menus that open from the top; on a wider screen it
   sits beside a small target and under a wide one. The last card has no target:
   it points at the Help page's clips. */

type Candidate = { sel: string; title: string; text: string; tryIt?: string }
type Stop = { tab?: string; targets: Candidate[] } | { end: true }

/* What the event in front of the tour looks like, so every card says something true
   about it. A fixed script asked a guest to "vote for a place" on an event with no
   places yet, told a day poll to "drag across the hours", and asked people to tap a
   face when nobody else had answered. */
export type TourContext = {
  dayPoll: boolean                                   // whole days, tapped, not hours dragged
  placeMode: 'vote' | 'set' | 'remote' | 'later'     // how the place is being decided
  itinerary: boolean                                 // a route of stops, not one place
  places: number                                     // places on the ballot so far
  canSuggest: boolean                                // guests may add places
  othersAnswered: number                             // other people with times marked
}
const PLAIN: TourContext = { dayPoll: false, placeMode: 'vote', itinerary: false, places: 1, canSuggest: false, othersAnswered: 1 }

function gridCard(ctx: TourContext, title: string): Candidate {
  return ctx.dayPoll
    ? { sel: 'grid-all', title, text: 'Press Edit mine and tap the days you can make. {heat}', tryIt: 'Tap a day.' }
    : { sel: 'grid-all', title, text: 'Press Edit mine and drag across the hours you can meet. {heat}', tryIt: 'Drag a block.' }
}

// the host's place stop: what there is to do depends on how the place is decided
function hostPlaceCard(ctx: TourContext): Candidate {
  const title = 'Where it happens'
  if (ctx.placeMode === 'remote') return { sel: 'location', title, text: 'This one is online. Add the meeting link here so everyone gets it when you lock it in.' }
  if (ctx.placeMode === 'set') return { sel: 'location', title, text: 'The place is set. You can change it here any time before you lock in.' }
  if (ctx.itinerary) return { sel: 'location', title, text: 'Add the stops and put them in order. Everyone sees the route.', tryIt: 'Add a stop.' }
  if (!ctx.places) return { sel: 'location', title, text: 'Add a few places and everyone votes. You pick the winner when you lock in.', tryIt: 'Add a place.' }
  return { sel: 'location', title, text: 'Everyone votes on these places. You pick the winner when you lock in.', tryIt: 'Vote for a place.' }
}

// the guest's place stop: only ask for a vote when there is something to vote on
function guestPlaceCard(ctx: TourContext): Candidate {
  if (ctx.placeMode === 'remote') return { sel: 'location', title: 'Where it happens', text: 'This one is online. The link will be here.' }
  if (ctx.placeMode === 'set') return { sel: 'location', title: 'Where it is', text: 'The host has already picked the place.' }
  if (ctx.itinerary) return { sel: 'location', title: 'Where you are going', text: 'The host is planning a route. The stops show here.' }
  if (!ctx.places) {
    return ctx.canSuggest
      ? { sel: 'location', title: 'Have a say in the place', text: 'No places yet. Suggest one and everyone can vote on it.', tryIt: 'Add a place.' }
      : { sel: 'location', title: 'Where it happens', text: 'No places yet. Once the host adds some, you can vote here.' }
  }
  return { sel: 'location', title: 'Have a say in the place', text: 'Vote for the places you like. The host picks one based on the votes.', tryIt: ctx.canSuggest ? 'Vote for a place, or add your own.' : 'Vote for a place.' }
}

// the "one person at a time" stop needs someone else on the grid to point at
function peopleStop(ctx: TourContext, title: string): Stop[] {
  if (!ctx.othersAnswered) return []
  return [{ tab: 'availability', targets: [{ sel: 'people', title, text: 'Tap a face to see just their times. Tap again to see everyone.', tryIt: 'Tap a face.' }] }]
}

// the host's tour: the link they send, the grid, the ballot, the rest, the lock-in
function hostStops(ctx: TourContext): Stop[] {
  return [
    { tab: 'availability', targets: [
      { sel: 'share', title: 'One link does it all', text: 'Send this to everyone. They add a name and answer, no account needed.', tryIt: 'Copy the link.' },
      { sel: 'menu', title: 'One link does it all', text: 'The share link is in this menu. Send it to everyone, no account needed.', tryIt: 'Copy the link.' },
    ] },
    { tab: 'availability', targets: [gridCard(ctx, 'When people are free')] },
    ...peopleStop(ctx, 'One person at a time'),
    { tab: 'location', targets: [hostPlaceCard(ctx)] },
    { tab: 'availability', targets: [
      { sel: 'tabs', title: 'The other tabs', text: 'Attendance shows who is coming. Details has the rest, including invites by email.' },
    ] },
    { tab: 'availability', targets: [
      { sel: 'lock', title: 'Lock it in', text: ctx.placeMode === 'remote' ? 'Pick a time. Everyone gets the details and can RSVP.' : 'Pick a time and place. Everyone gets the details and can RSVP.', tryIt: 'Press it to see the best time. Nothing is final until you confirm.' },
      { sel: 'create', title: 'Your own plan', text: 'Start your own plan here.' },
    ] },
    { end: true },
  ]
}

// the guest's tour once the plan is locked in. There is no Edit mine on a settled
// grid, so telling somebody to press it would point at nothing; what is asked of
// them now is whether they are coming.
function guestLockedStops(ctx: TourContext): Stop[] {
  return [
    { tab: 'availability', targets: [
      { sel: 'rsvp', title: 'Say if you can make it', text: ctx.placeMode === 'remote' ? 'The time is set. Let the host know if you are coming.' : 'The time and place are set. Let the host know if you are coming.', tryIt: 'You can change your answer later.' },
    ] },
    { tab: 'availability', targets: [
      { sel: 'grid-all', title: 'When it is', text: ctx.dayPoll ? 'The days that won are marked on the calendar.' : 'The time that won is marked on the grid.' },
    ] },
    { tab: 'attendance', targets: [
      { sel: 'attendance', title: 'Who is coming', text: 'See who has answered and who has not.' },
    ] },
    { tab: 'availability', targets: [
      { sel: 'chat', title: 'Say something', text: 'Everyone on the plan can chat here.' },
    ] },
    { end: true },
  ]
}

// the guest's tour: what a guest actually does here. No invites, no lock-in, no
// host controls; the ballot and the discussion take the last two stops instead.
function guestStops(ctx: TourContext): Stop[] {
  return [
    { tab: 'availability', targets: [gridCard(ctx, 'Start with your times')] },
    ...peopleStop(ctx, 'Who else has answered'),
    { tab: 'location', targets: [guestPlaceCard(ctx)] },
    { tab: 'availability', targets: [
      { sel: 'tabs', title: 'The other tabs', text: 'Attendance shows who is coming. Details has the rest.' },
    ] },
    { tab: 'availability', targets: [
      { sel: 'chat', title: 'Say something', text: 'Everyone on the plan can chat here.' },
    ] },
    { end: true },
  ]
}

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
// where the card goes for a spotlight: beside a small target when there is room,
// under or over a wide one, in the middle with no target. On a phone the card takes
// the half of the screen the target is not in. It always sat at the bottom, which is
// where the chat bubble and the tab bar live, so the stop about the chat covered the
// very thing it asked you to open; now a low target puts the card up top, and a high
// one puts it at the foot, clear of the tab bar
function placeCard(b: Box | null, cardH: number): { left: number; top: number; width: number } {
  const vw = window.innerWidth, vh = window.innerHeight
  const width = Math.min(360, vw - 32)
  const H = cardH || 220
  if (vw < 640) {
    const low = !b || b.y + b.h / 2 > vh / 2
    const bottom = Math.max(16, vh - H - 92) // the tab bar and the chat bubble own the last 92
    return { left: 16, top: low ? Math.min(16, bottom) : bottom, width }
  }
  if (!b) return { left: (vw - width) / 2, top: Math.max(16, vh / 2 - H / 2), width }
  const clampTop = (t: number) => Math.max(16, Math.min(t, vh - H - 16))
  if (b.w < vw * 0.5) {
    if (b.x >= width + 28) return { left: b.x - width - 16, top: clampTop(b.y), width }
    if (vw - (b.x + b.w) >= width + 28) return { left: b.x + b.w + 16, top: clampTop(b.y), width }
  }
  let top = b.y + b.h + 12
  if (top + H > vh) top = b.y - 12 - H
  if (top < 16) top = Math.max(16, vh - H - 16)
  return { left: Math.max(16, Math.min(b.x, vw - width - 16)), top, width }
}

export function Tour({ host = false, locked = false, ctx = PLAIN }: { host?: boolean; locked?: boolean; ctx?: TourContext }) {
  // read when the tour starts, not when this renders: the script is built once per run
  const ctxRef = useRef(ctx)
  useEffect(() => { ctxRef.current = ctx })
  const heatLine = useHeatLine() // what the grid colours mean, in this theme's words
  // the clips link carries the event it was followed from, so Help can offer the way back
  const pathname = usePathname()
  const eventId = /^\/events\/([^/]+)/.exec(pathname ?? '')?.[1]
  const watchHref = eventId ? `/help?from=${encodeURIComponent(eventId)}#watch` : '/help#watch'
  const [plan, setPlan] = useState<Stop[] | null>(null)
  const [i, setI] = useState(0)
  const [cand, setCand] = useState<Candidate | null>(null)
  const [box, setBox] = useState<Box | null>(null)
  const el = useRef<HTMLElement | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const hole = useRef<SVGRectElement>(null)
  const glow = useRef<SVGRectElement>(null)
  const card = useRef<HTMLDivElement>(null)
  const first = useRef(true)
  // where the keyboard was when the tour began, so leaving it puts focus back there
  const opener = useRef<HTMLElement | null>(null)
  const titleId = useId()

  // the hole in the dim and the line drawn around it are the same rectangle, so
  // they are always moved together
  const place = (b: Box, animate = false) => {
    const attr = { x: b.x, y: b.y, width: b.w, height: b.h }
    for (const el of [hole.current, glow.current]) {
      if (!el) continue
      if (animate) gsap.to(el, { attr, duration: 0.4, ease: 'power3.inOut', overwrite: 'auto' })
      else gsap.set(el, { attr })
    }
  }

  // start: asked for, not done, and room for it. Stops on the current tab are
  // checked now; stops on other tabs are taken on trust and checked when reached.
  // The same start answers a later ask (the guest popup, Settings) on this page.
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null
    const begin = (delay: number) => {
      if (!tourWanted() || hintDismissed('tour') || window.innerWidth < 360) return
      if (t) clearTimeout(t)
      t = setTimeout(() => {
        const here = activeTab()
        const script = host ? hostStops(ctxRef.current) : locked ? guestLockedStops(ctxRef.current) : guestStops(ctxRef.current)
        const have = script.filter((s) => 'end' in s || s.tab !== here || find(s))
        // the request is spent the moment the tour is actually on screen, not when it
        // is finished. Walking away from it — the back button, a tap through to
        // another page, closing the tab — used to leave it armed, and it would then
        // ambush the next event opened, days later and on an event that was never
        // the practice one. Escape, Skip and Done still mark it done properly.
        if (have.length > 1) {
          const was = document.activeElement
          opener.current = was instanceof HTMLElement && was !== document.body ? was : null
          first.current = true; setI(0); setPlan(have); setTourWanted(false)
        }
      }, delay)
    }
    begin(800)
    const onStart = () => begin(300)
    window.addEventListener(TOUR_START, onStart)
    return () => { if (t) clearTimeout(t); window.removeEventListener(TOUR_START, onStart) }
  }, [host, locked])

  const finish = useCallback(() => {
    dismissHint('tour')
    setTourWanted(false)
    setPlan(null)
    // focus goes back to where it was, unless it has since moved on to the page
    const back = opener.current
    opener.current = null
    const now = document.activeElement
    if (back?.isConnected && (!now || now === document.body || card.current?.contains(now))) back.focus({ preventScroll: true })
  }, [])

  // point at the current stop: switch its tab, wait for the element, bring it on screen
  useEffect(() => {
    if (!plan) return
    const stop = plan[i]
    let tries = 0
    const timer = setInterval(() => {
      if ('end' in stop) { clearInterval(timer); el.current = null; setCand(null); setBox(null); return }
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
      requestAnimationFrame(() => { setCand(found.c); setBox(boxOf(found.el)) })
    }, 100)
    return () => clearInterval(timer)
  }, [plan, i])

  // the page is live under the tour, so the element moves: the hole and the card
  // follow it every frame, straight onto the DOM, with no animation in between
  useEffect(() => {
    if (!plan) return
    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const target = el.current
      if (!target || !document.contains(target) || !hole.current || !card.current) return
      const b = boxOf(target)
      place(b)
      const p = placeCard(b, card.current.offsetHeight)
      card.current.style.left = `${p.left}px`; card.current.style.top = `${p.top}px`; card.current.style.width = `${p.width}px`
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [plan])

  // the card takes focus each time it shows a new stop, so the keyboard and a screen
  // reader are always on what it says. It is not modal: Tab carries on into the page.
  const shown = !plan?.[i] ? null : 'end' in plan[i] ? 'end' : cand ? `${cand.sel}|${cand.title}` : null
  useEffect(() => {
    if (shown) card.current?.focus({ preventScroll: true })
  }, [shown])

  // Escape leaves from the page itself or from the card, never out of a field being typed in
  useEffect(() => {
    if (!plan) return
    const onKey = (e: KeyboardEvent) => {
      const a = document.activeElement
      if (e.key === 'Escape' && (a === document.body || !!card.current?.contains(a))) finish()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [plan, finish])

  // the hole slides from stop to stop; the card fades in beside it
  useGSAP(() => {
    if (!plan) return
    if (box) {
      if (first.current) { first.current = false; place(box); gsap.fromTo('.tour-dim', { opacity: 0 }, { opacity: 1, duration: 0.3 }) }
      else place(box, true)
      // the line breathes rather than sitting there, which is what says "here"
      gsap.fromTo('.tour-glow', { opacity: 0 }, { opacity: 1, duration: 0.35 })
      if (!reducedMotion()) gsap.to('.tour-glow', { opacity: 0.45, duration: 1.1, ease: 'sine.inOut', repeat: -1, yoyo: true, delay: 0.35 })
    } else {
      for (const el of [hole.current, glow.current]) if (el) gsap.to(el, { attr: { width: 0, height: 0 }, duration: 0.3, overwrite: 'auto' })
    }
    gsap.fromTo('.tour-card', { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.3, delay: 0.15, ease: 'power3.out' })
  }, { dependencies: [i, cand === null], scope: root })

  if (!plan) return null
  const stop = plan[i]
  const ending = 'end' in stop
  if (!ending && (!cand || !box)) return null
  const count = plan.filter((s) => !('end' in s)).length
  const isLast = i === plan.length - 1
  // first placement with the usual height; the follow loop corrects it a frame later
  const pos = placeCard(box, 0)

  return createPortal(
    // z-[42]: over the page and its header, under popovers (z-50) and the lock-in modal
    <div ref={root} className="pointer-events-none fixed inset-0 z-[42]">
      <svg className="tour-dim absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <mask id="tour-hole">
            <rect width="100%" height="100%" fill="#fff" />
            <rect ref={hole} x={box?.x ?? 0} y={box?.y ?? 0} width={box?.w ?? 0} height={box?.h ?? 0} rx="12" fill="#000" />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="var(--tour-dim)" mask="url(#tour-hole)" />
        {/* the lit edge: the same rectangle again, drawn rather than cut out */}
        <rect
          ref={glow} className="tour-glow" x={box?.x ?? 0} y={box?.y ?? 0} width={box?.w ?? 0} height={box?.h ?? 0}
          rx="12" fill="none" stroke="var(--tour-lit)" strokeWidth="2.5" opacity="0"
          style={{ filter: 'drop-shadow(0 0 5px var(--tour-lit)) drop-shadow(0 0 13px var(--tour-lit))' }}
        />
      </svg>
      <div
        ref={card}
        role="dialog"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="tour-card pointer-events-auto absolute rounded-xl border border-border bg-s1 p-4 shadow-soft outline-none"
        style={pos}
      >
        {ending ? (
          <>
            <div className="text-[11px] font-semibold uppercase tracking-[.13em] text-faint">The end</div>
            <div id={titleId} className="mt-1 font-serif text-[21px] leading-[1.15] tracking-[-0.01em]">That is the tour</div>
            <p className="mt-1.5 text-[13.5px] leading-[1.55] text-dim">{host ? 'This practice plan is yours to play with. The Help page has a short clip of each step.' : 'Your answers save as you go. The Help page has a short clip of each step.'}</p>
            <div className="mt-3.5 flex items-center justify-between gap-3">
              <Link href={watchHref} onClick={finish} className="flex items-center gap-1.5 text-[13px] font-semibold text-accent-text hover:underline">
                <PlayCircle size={15} /> Watch the clips
              </Link>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setI(i - 1)} aria-label="Back" className="grid h-9 w-9 place-items-center rounded-[9px] border border-border2 text-dim hover:bg-s2 hover:text-text"><ArrowLeft size={15} /></button>
                <button type="button" onClick={finish} className="flex h-9 items-center gap-1.5 rounded-full bg-accent px-3.5 text-[13.5px] font-semibold text-on-accent">
                  Done <Check size={14} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="text-[11px] font-semibold uppercase tracking-[.13em] text-faint">Stop {i + 1} of {count}</div>
            <div id={titleId} className="mt-1 font-serif text-[21px] leading-[1.15] tracking-[-0.01em]">{cand!.title}</div>
            <p className="mt-1.5 text-[13.5px] leading-[1.55] text-dim">{withHeatLine(cand!.text, heatLine)}</p>
            {cand!.tryIt && (
              <p className="mt-2 text-[13.5px] leading-[1.55]"><span className="font-semibold text-accent-text">Try it.</span> <span className="text-text">{cand!.tryIt}</span></p>
            )}
            <div className="mt-3.5 flex items-center justify-between gap-3">
              <button type="button" onClick={finish} className="text-[13px] font-semibold text-dim hover:text-text">Skip the tour</button>
              <div className="flex items-center gap-2">
                {i > 0 && (
                  <button type="button" onClick={() => setI(i - 1)} aria-label="Back" className="grid h-9 w-9 place-items-center rounded-[9px] border border-border2 text-dim hover:bg-s2 hover:text-text"><ArrowLeft size={15} /></button>
                )}
                <button
                  type="button"
                  onClick={() => (isLast ? finish() : setI(i + 1))}
                  className="flex h-9 items-center gap-1.5 rounded-full bg-accent px-3.5 text-[13.5px] font-semibold text-on-accent"
                >
                  Next <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
