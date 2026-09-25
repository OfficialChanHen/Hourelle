'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowLeft, ArrowRight, Check, PlayCircle } from 'lucide-react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { TOUR_START, dismissHint, hintDismissed, setTourWanted, tourWanted, reducedMotion } from '@/lib/prefs'

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

// the host's tour: the link they send, the grid, the ballot, the rest, the lock-in
const HOST_STOPS: Stop[] = [
  { tab: 'availability', targets: [
    { sel: 'share', title: 'One link does it all', text: 'Send it to everyone. They open it, add a name and answer. Nobody needs an account.', tryIt: 'Open Share link and copy it.' },
    { sel: 'menu', title: 'One link does it all', text: 'The share link is in this menu. Send it to everyone: they open it, add a name and answer. Nobody needs an account.', tryIt: 'Open the menu and copy the link.' },
  ] },
  { tab: 'availability', targets: [
    { sel: 'grid-all', title: 'When people are free', text: 'In Edit mine, drag across the hours you can make. The greener a slot, the more people can. A block you painted has handles, so it can be trimmed to the minute.', tryIt: 'Press Edit mine, drag a block, then pull one of its edges.' },
  ] },
  { tab: 'availability', targets: [
    { sel: 'people', title: 'One person at a time', text: 'Tap a face to see only that person\u2019s times; tap it again for everyone. The count beside them opens who has answered and who has not.', tryIt: 'Tap a face, then tap it again.' },
  ] },
  { tab: 'location', targets: [
    { sel: 'location', title: 'Where it happens', text: 'Places go on the ballot and everyone votes; the pins carry the count. You lock in the winner, or switch to Itinerary and build a route through the top picks.', tryIt: 'Search for a place and add it, vote for one, then open Itinerary.' },
  ] },
  { tab: 'availability', targets: [
    { sel: 'tabs', title: 'The rest of the plan', text: 'Attendance counts who is coming once the plan is locked in. Event details holds the description, the budget, the dates, the people and the invites by email.', tryIt: 'Open Attendance, then Event details, and come back to Availability.' },
  ] },
  { tab: 'availability', targets: [
    { sel: 'lock', title: 'Lock it in', text: 'When the grid is green enough, lock in a time and a place. Everyone gets the plan, and the RSVPs open.', tryIt: 'Press it and look at the best window it proposes. Nothing is final until you confirm.' },
    { sel: 'create', title: 'Your own event', text: 'This is where yours starts. Name it, pick some days, and the link is ready to send.', tryIt: 'Make one when you are ready.' },
  ] },
  { end: true },
]

// the guest's tour once the plan is locked in. There is no Edit mine on a settled
// grid, so telling somebody to press it would point at nothing; what is asked of
// them now is whether they are coming.
const GUEST_LOCKED_STOPS: Stop[] = [
  { tab: 'availability', targets: [
    { sel: 'rsvp', title: 'Say if you can make it', text: 'The time and the place are settled. All that is left is whether you are there.', tryIt: 'Answer going, maybe or cannot go. You can change it later.' },
  ] },
  { tab: 'availability', targets: [
    { sel: 'grid-all', title: 'When it is', text: 'The grid shows the times everyone gave and the window that won. It is read-only now that the plan is locked.' },
  ] },
  { tab: 'attendance', targets: [
    { sel: 'attendance', title: 'Who is coming', text: 'Everyone who has answered, and who the host is still waiting on.' },
  ] },
  { tab: 'availability', targets: [
    { sel: 'chat', title: 'Say something', text: 'The discussion is per event and everyone on it can write, guests included. It is the place to say you will be late.', tryIt: 'Open it and leave a line.' },
  ] },
  { end: true },
]

// the guest's tour: what a guest actually does here. No invites, no lock-in, no
// host controls; the ballot and the discussion take the last two stops instead.
const GUEST_STOPS: Stop[] = [
  { tab: 'availability', targets: [
    { sel: 'grid-all', title: 'Start with your times', text: 'This is the whole point: in Edit mine, drag across the hours you can make. The greener a slot, the more people can. A block you painted has handles, so it can be trimmed to the minute.', tryIt: 'Press Edit mine, drag a block, then pull one of its edges.' },
  ] },
  { tab: 'availability', targets: [
    { sel: 'people', title: 'Who else has answered', text: 'Tap a face to see only that person\u2019s times; tap it again for everyone. The count beside them says who has answered and who the host is still waiting on.', tryIt: 'Tap a face, then tap it again.' },
  ] },
  { tab: 'location', targets: [
    { sel: 'location', title: 'Have a say in the place', text: 'Every place on the ballot takes one vote from you, and the pins carry the count. The host settles on one in the end, but the votes are what they go by.', tryIt: 'Vote for a place, and add one of your own if the host allowed it.' },
  ] },
  { tab: 'availability', targets: [
    { sel: 'tabs', title: 'The rest of the event', text: 'Attendance says who is coming once the host locks the plan in. Event details holds the description, the dates and the budget the host set. You can read all of it; only the host can change it.', tryIt: 'Open Attendance, then Event details, and come back to Availability.' },
  ] },
  { tab: 'availability', targets: [
    { sel: 'chat', title: 'Say something', text: 'The discussion is per event and everyone on it can write, guests included. It is the place to ask about the times, or say you will be late.', tryIt: 'Open it and leave a line.' },
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

export function Tour({ host = false, locked = false }: { host?: boolean; locked?: boolean }) {
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
        const script = host ? HOST_STOPS : locked ? GUEST_LOCKED_STOPS : GUEST_STOPS
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
            <p className="mt-1.5 text-[13.5px] leading-[1.55] text-dim">{host ? 'This practice event stays yours to play with. Four short clips on the Help page show each step from start to finish: making an event, marking times, picking a place and locking in.' : 'Your answers are saved as you go, and you can change them any time. Four short clips on the Help page show each step from start to finish.'}</p>
            <div className="mt-3.5 flex items-center justify-between gap-3">
              <Link href={watchHref} onClick={finish} className="flex items-center gap-1.5 text-[13px] font-semibold text-accent-text hover:underline">
                <PlayCircle size={15} /> Watch the clips
              </Link>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setI(i - 1)} aria-label="Back" className="grid h-9 w-9 place-items-center rounded-[9px] border border-border2 text-dim hover:bg-s2 hover:text-text"><ArrowLeft size={15} /></button>
                <button type="button" onClick={finish} className="flex h-9 items-center gap-1.5 rounded-[9px] bg-accent px-3.5 text-[13.5px] font-semibold text-on-accent">
                  Done <Check size={14} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="text-[11px] font-semibold uppercase tracking-[.13em] text-faint">Stop {i + 1} of {count}</div>
            <div id={titleId} className="mt-1 font-serif text-[21px] leading-[1.15] tracking-[-0.01em]">{cand!.title}</div>
            <p className="mt-1.5 text-[13.5px] leading-[1.55] text-dim">{cand!.text}</p>
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
                  className="flex h-9 items-center gap-1.5 rounded-[9px] bg-accent px-3.5 text-[13.5px] font-semibold text-on-accent"
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
