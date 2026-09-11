'use client'

/* ── "How it works" as one frame that changes as you scroll ──
   Four steps down the side; beside them (above them on a phone) a product frame
   that stays put and plays each step as a short scene: the plan gets named, the
   link goes out and people arrive, the grid fills as they answer, the plan locks.
   The scenes are the product's own chrome, drawn small, driven by GSAP timelines
   that scroll position starts and a small button can pause. With reduced motion
   on, each scene shows its finished state and nothing moves. */

import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { CalendarRange, Check, Copy, Link2, Lock, Pause, Play, MousePointer2, MapPin, Clock } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { LifecycleStrip } from '@/components/ui/LifecycleStrip'
import type { PersonColor } from '@/lib/colors'

gsap.registerPlugin(ScrollTrigger)

const STEPS = [
  { title: 'Name the plan', body: 'A title and a stretch of days. Thirty seconds, no settings to get right first.' },
  { title: 'Share one link', body: 'Send it anywhere. Whoever opens it adds their name and they are in, no account needed.' },
  { title: 'Everyone answers', body: 'People mark when they are free, suggest places, vote, and say if they are coming.' },
  { title: 'Lock it in', body: 'The best window shows itself. One tap makes it the plan, and everyone gets the details.' },
]

const TITLE = 'Rooftop dinner'
const PEOPLE: { i: string; c: PersonColor; n: string }[] = [
  { i: 'SR', c: 'teal', n: 'Sarah' }, { i: 'AT', c: 'coral', n: 'Alex' }, { i: 'KL', c: 'blue', n: 'Kyle' }, { i: 'PR', c: 'pink', n: 'Priya' }, { i: 'MN', c: 'amber', n: 'Mia' },
]
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
const HOURS = ['4 PM', '5 PM', '6 PM', '7 PM', '8 PM']
// free cells per person as [day, hour]: the host's are drawn by the cursor in the
// scene itself, the rest arrive as answers. Wednesday 6–8 is where everyone lands.
const OTHERS: [number, number][][] = [
  [[0, 1], [0, 2], [2, 2], [2, 3], [4, 3]],
  [[1, 0], [1, 1], [2, 1], [2, 2], [2, 3], [3, 3]],
  [[2, 2], [2, 3], [2, 4], [3, 1], [3, 2]],
  [[0, 3], [2, 2], [2, 3], [4, 1], [4, 2]],
  [[2, 1], [2, 2], [2, 3], [3, 2], [1, 3]],
]
const BEST: [number, number][] = [[2, 2], [2, 3]]
const key = (d: number, h: number) => `${d}:${h}`

export function HowItWorks() {
  const root = useRef<HTMLDivElement>(null)
  const frame = useRef<HTMLDivElement>(null)
  const cursor = useRef<HTMLDivElement>(null)
  const tl = useRef<gsap.core.Timeline | null>(null)
  const [active, setActive] = useState(0)
  // the frame follows `scene`, a settled copy of `active`: a fast scroll can pass
  // several steps in a moment, and only the one it stops on gets to play
  const [scene, setScene] = useState(0)
  const [paused, setPaused] = useState(false)
  // nothing plays until the section has scrolled into view
  const [seen, setSeen] = useState(false)
  // a click on a step scrolls there; the scroll triggers stay quiet on the way
  const muted = useRef(false)
  const [pressing, setPressing] = useState(false)

  // scene state, all driven by the timelines below
  const [typed, setTyped] = useState('')
  const [dates, setDates] = useState(false)
  const [pressed, setPressed] = useState(false)
  const [copied, setCopied] = useState(false)
  const [joined, setJoined] = useState(0)
  const [you, setYou] = useState<Set<string>>(new Set())
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [answered, setAnswered] = useState(0)
  const [best, setBest] = useState(false)
  const [locked, setLocked] = useState(false)
  const [lockPressed, setLockPressed] = useState(false)

  // where a step's text has to reach for its scene to play, in viewport pixels
  const wide = () => window.matchMedia('(min-width: 1024px)').matches
  function lineY(): number {
    const sticky = frame.current?.parentElement?.parentElement
    if (!frame.current || !sticky) return Math.round(window.innerHeight * 0.6)
    const top = parseFloat(getComputedStyle(sticky).top) || 0
    return Math.round(wide() ? top + frame.current.offsetHeight * 0.75 : top + frame.current.offsetHeight + 14)
  }

  // which step is in view decides the scene; each step is its own scroll trigger
  useGSAP(() => {
    const pick = (i: number) => { if (!muted.current) setActive(i) }
    // the trigger is the step's own text. Beside the frame (wide screens) a step
    // takes over when its top reaches the frame's bottom quarter and keeps the
    // frame until the next step arrives. Under the frame (phones) the text slides
    // out of sight beneath the demo, so a step also hands over the moment its
    // bottom disappears under the frame: the step you can see is the one playing.
    const last = STEPS.length - 1
    gsap.utils.toArray<HTMLElement>('.hiw-step-text').forEach((el, i) => {
      ScrollTrigger.create({
        trigger: el,
        start: () => `top ${lineY()}px`,
        end: () => `bottom ${lineY()}px`,
        invalidateOnRefresh: true,
        onEnter: () => pick(i),
        onEnterBack: () => pick(i),
        // beside the frame, scrolling back up past a step's top hands the frame to
        // the step before it; under the frame that step is still hidden, so the
        // hand-back waits for its bottom to show again (onEnterBack above)
        onLeaveBack: () => { if (wide()) pick(Math.max(0, i - 1)) },
        // on a phone, scrolling on past a step's bottom hands it to the next
        onLeave: () => { if (!wide()) pick(Math.min(last, i + 1)) },
      })
    })
    ScrollTrigger.create({ trigger: root.current, start: 'top 70%', once: true, onEnter: () => setSeen(true) })
  }, { scope: root })

  // a tap on a step (or a dot) goes there: the scene switches now and the page
  // scrolls to the step, with the scroll triggers muted until it arrives
  function go(i: number) {
    setActive(i)
    muted.current = true
    setTimeout(() => { muted.current = false }, 900)
    const el = root.current?.querySelectorAll<HTMLElement>('.hiw-step-text')[i]
    if (!el) return
    const r = el.getBoundingClientRect()
    // beside the frame, the text lines up with the frame's centre; under it on a
    // phone, the text's top lands just below the frame
    const sticky = frame.current?.parentElement?.parentElement
    const centre = wide() && sticky && frame.current ? (parseFloat(getComputedStyle(sticky).top) || 0) + frame.current.offsetHeight / 2 : null
    const delta = centre !== null ? r.top + r.height / 2 - centre : r.top - (lineY() - 6)
    window.scrollBy({ top: delta, behavior: 'smooth' })
  }

  // the scene for the active step, rebuilt whenever the step changes
  useGSAP(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    // reset every scene on the timeline's first tick, then play the active one
    const reset = () => {
      setTyped(''); setDates(false); setPressed(false); setCopied(false); setJoined(0)
      setYou(new Set()); setCounts({}); setAnswered(0); setBest(false); setLocked(false); setLockPressed(false)
    }
    if (cursor.current) gsap.set(cursor.current, { opacity: 0 })
    // the scene plays again after a rest for as long as its step stays in view;
    // the reset sits just past zero so it also runs at the top of every repeat
    // one timeline at a time: the previous scene's loop dies here, and the hook
    // reverts its context on every dependency change too (revertOnUpdate)
    tl.current?.kill()
    const t = gsap.timeline({ paused: paused || !seen, delay: 0.3, repeat: reduce ? 0 : -1, repeatDelay: 1.8 })
    tl.current = t
    t.call(reset, [], 0.01)
    t.call(() => setPressing(false), [], 0.01)

    if (scene === 0) {
      const p = { n: 0 }
      t.to(p, { n: TITLE.length, duration: 1.1, ease: 'none', onUpdate: () => setTyped(TITLE.slice(0, Math.round(p.n))) })
        .call(() => setDates(true), [], '+=0.5')
        .call(() => setPressed(true), [], '+=0.9')
        .call(() => setPressed(false), [], '+=0.25')
    }
    if (scene === 1) {
      t.call(() => setCopied(true), [], 0.8)
      PEOPLE.forEach((_, i) => t.call(() => setJoined(i + 1), [], 1.8 + i * 0.55))
      t.call(() => setCopied(false), [], 3.2)
    }
    if (scene === 2) {
      // the cursor draws the host's block: a press, a drag down Wednesday, a release
      const cellAt = (d: number, h: number) => frame.current?.querySelector<HTMLElement>(`[data-cell="${key(d, h)}"]`)
      // positions are measured against the box the cursor is placed in (the scene
      // area), not the frame, which also holds the browser bar above it
      const at = (d: number, h: number) => {
        const c = cellAt(d, h), f = cursor.current?.offsetParent as HTMLElement | null
        if (!c || !f) return { x: 0, y: 0 }
        const cr = c.getBoundingClientRect(), fr = f.getBoundingClientRect()
        return { x: cr.left - fr.left + cr.width / 2, y: cr.top - fr.top + cr.height / 2 }
      }
      const cur = cursor.current!
      const press = () => { t.to(cur, { scale: 0.85, duration: 0.12 }).call(() => setPressing(true)) }
      const release = () => { t.call(() => setPressing(false)).to(cur, { scale: 1, duration: 0.12 }) }
      // each cell is marked the moment the cursor reaches it, so the block grows
      // under the pointer like a real drag
      const drag = (d: number, hours: number[]) => {
        hours.forEach((h, i) => {
          t.to(cur, { duration: 0.34, ease: 'none', ...at(d, h) }, i === 0 ? '+=0' : '>')
            .call(() => setYou((s) => new Set(s).add(key(d, h))), [], '>-0.12')
        })
      }
      t.set(cur, { opacity: 1, x: 60, y: 30 })
        .to(cur, { duration: 0.6, ease: 'power2.inOut', ...at(2, 1) })
      press(); drag(2, [1, 2, 3]); release()
      t.to(cur, { duration: 0.5, ease: 'power2.inOut', ...at(3, 2) })
      press(); drag(3, [2, 3]); release()
      t.to(cur, { opacity: 0, duration: 0.3, delay: 0.25 })
      // then the others answer, one at a time, and the best window shows itself
      OTHERS.forEach((cells, i) => {
        t.call(() => {
          setAnswered(i + 1)
          setCounts((c) => { const n = { ...c }; for (const [d, h] of cells) n[key(d, h)] = (n[key(d, h)] ?? 0) + 1; return n })
        }, [], '+=0.45')
      })
      t.call(() => setBest(true), [], '+=0.5')
    }
    if (scene === 3) {
      t.call(() => setLockPressed(true), [], 1.0)
        .call(() => { setLockPressed(false); setLocked(true) }, [], 1.35)
    }
    if (reduce) t.progress(1).pause()
    return () => { t.kill(); if (tl.current === t) tl.current = null }
  }, { scope: root, dependencies: [scene, seen], revertOnUpdate: true })

  useEffect(() => {
    const t = setTimeout(() => setScene(active), 160)
    return () => clearTimeout(t)
  }, [active])

  // the pause button holds the current scene where it is
  useEffect(() => { if (paused || !seen) tl.current?.pause(); else tl.current?.play() }, [paused, seen])

  const total = PEOPLE.length + 1
  const heatOf = (n: number) => (n === 0 ? 'var(--s2)' : n / total <= 0.25 ? 'var(--heat-low)' : n / total <= 0.5 ? 'var(--heat-mid)' : n < total ? 'var(--heat-high)' : 'var(--heat-full)')

  return (
    <div ref={root} className="mt-10 lg:grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-14">
      {/* the frame: sticky beside the steps on wide screens, above them on a phone.
          Sticky sits on the direct child so its containing block is the whole
          section (tall) on a phone and the full-height grid column on a desktop. */}
      {/* on a phone the header slides away on a downward scroll, which would leave the
          steps showing through the gap above the pinned frame: the band fills it */}
      <div className="relative sticky top-[70px] z-[5] mb-8 before:absolute before:inset-x-[-24px] before:-top-[70px] before:h-[70px] before:bg-bg lg:order-last lg:top-[96px] lg:mb-0 lg:self-start lg:before:hidden">
        <div>
          <div ref={frame} className="hiw-frame relative overflow-hidden rounded-2xl border border-border bg-s1 shadow-soft">
            {/* browser chrome */}
            <div className="flex items-center gap-2 border-b border-border bg-s0 px-3 py-2">
              <span className="flex gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-s3" /><i className="h-2.5 w-2.5 rounded-full bg-s3" /><i className="h-2.5 w-2.5 rounded-full bg-s3" /></span>
              <span className="ml-1 flex h-6 flex-1 items-center rounded-md bg-s2 px-2.5 font-mono text-[11px] text-faint">aline.app/e/{scene === 0 ? 'new' : 'rooftop-dinner'}</span>
            </div>

            <div className="relative h-[268px] sm:h-[300px]">
              {/* scene 1: the plan gets named */}
              <Scene on={scene === 0}>
                <p className="text-[11px] font-semibold uppercase tracking-[.13em] text-faint">New event</p>
                <div className="mt-2 flex h-11 items-center rounded-[10px] border border-accent-border bg-s0 px-3.5 text-[15px]">
                  {typed || <span className="text-faint">What are you planning?</span>}
                  {typed.length < TITLE.length && <span className="ml-px inline-block h-[18px] w-px animate-pulse bg-text" />}
                </div>
                <div className="mt-3 flex items-center gap-2 text-[13px] text-dim">
                  <CalendarRange size={15} className="flex-none" />
                  <span className={`rounded-[8px] border px-2.5 py-1.5 transition-colors ${dates ? 'border-accent-border bg-accent-bg text-accent-text' : 'border-border text-faint'}`}>Mon, Aug 20</span>
                  <span className="text-faint">to</span>
                  <span className={`rounded-[8px] border px-2.5 py-1.5 transition-colors ${dates ? 'border-accent-border bg-accent-bg text-accent-text' : 'border-border text-faint'}`}>Fri, Aug 24</span>
                </div>
                <div className="mt-5 flex justify-end">
                  <span className={`flex h-10 items-center gap-1.5 rounded-[10px] bg-accent px-4 text-[14px] font-semibold text-on-accent transition-transform ${pressed ? 'scale-95' : ''} ${dates ? '' : 'opacity-40'}`}><Check size={16} /> Create event</span>
                </div>
              </Scene>

              {/* scene 2: the link goes out, people arrive */}
              <Scene on={scene === 1}>
                <p className="font-serif text-[24px] leading-tight tracking-[-0.01em]">Your event is live</p>
                <div className="mt-3 flex h-10 items-center gap-2 rounded-[10px] border border-border2 bg-s2 pl-3 pr-1.5">
                  <Link2 size={15} className="flex-none text-accent-text" />
                  <span className="flex-1 truncate font-mono text-[12.5px]">aline.app/e/rooftop-dinner/join</span>
                  <span className="flex h-7 items-center gap-1 rounded-[7px] bg-accent px-2.5 text-[12px] font-semibold text-on-accent">{copied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}</span>
                </div>
                <div className="mt-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[.13em] text-faint">Who is in</p>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="flex">
                      <span className="rounded-full ring-2 ring-s1"><Avatar initials="JM" color="purple" size={30} font={11} /></span>
                      {PEOPLE.slice(0, joined).map((p) => (
                        <span key={p.i} className="hiw-pop -ml-2 rounded-full ring-2 ring-s1"><Avatar initials={p.i} color={p.c} size={30} font={11} /></span>
                      ))}
                    </div>
                    <span className="text-[13px] text-dim">{joined === 0 ? 'Just you so far' : `${joined + 1} people are in`}</span>
                  </div>
                  <div className="mt-3 space-y-1 text-[12.5px] text-faint">
                    {PEOPLE.slice(0, joined).slice(-2).map((p) => <p key={p.i}>{p.n} joined by the link</p>)}
                  </div>
                </div>
              </Scene>

              {/* scene 3: the grid fills */}
              <Scene on={scene === 2}>
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-[.13em] text-faint">When are you free?</p>
                  <span className="text-[12px] text-dim">{answered + 1} of {total} answered</span>
                </div>
                <div className="mt-2 grid gap-1" style={{ gridTemplateColumns: `34px repeat(${DAYS.length}, minmax(0, 1fr))` }}>
                  <span />
                  {DAYS.map((d) => <span key={d} className="text-center text-[11px] font-semibold text-dim">{d}</span>)}
                  {HOURS.map((h, hi) => (
                    <div key={h} className="contents">
                      <span className="pr-1 text-right text-[10.5px] leading-[26px] text-faint">{h}</span>
                      {DAYS.map((_, di) => {
                        const k = key(di, hi)
                        const mine = you.has(k), n = (counts[k] ?? 0) + (mine ? 1 : 0)
                        const isBest = best && BEST.some(([d, hh]) => d === di && hh === hi)
                        return (
                          <span
                            key={k} data-cell={k}
                            className={`h-[26px] rounded-[5px] transition-colors duration-200 ${isBest ? 'ring-2 ring-ochre ring-offset-1 ring-offset-s1' : mine && pressing ? 'ring-2 ring-accent/60 ring-inset' : ''}`}
                            // your block is the green of a selection; everyone else's answers
                            // are the heat ramp's greens, faded so your block stays the subject.
                            // The ochre is saved for the best window, which comes after.
                            style={mine ? { background: 'var(--accent)' } : { background: heatOf(n), opacity: n === 0 ? 1 : 0.65 }}
                          />
                        )
                      })}
                    </div>
                  ))}
                </div>
                <p className={`mt-2.5 flex items-center gap-1.5 text-[12.5px] transition-opacity ${best ? 'opacity-100' : 'opacity-0'}`}>
                  <Clock size={13} className="text-ochre" /> <span className="font-semibold text-ochre">Best so far: Wed, 6:00 – 8:00 PM</span> <span className="text-dim">everyone free</span>
                </p>
              </Scene>

              {/* scene 4: the plan locks */}
              <Scene on={scene === 3}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-serif text-[22px] leading-tight tracking-[-0.01em] sm:text-[24px]">{TITLE}</p>
                    <div className="mt-1.5"><Badge variant={locked ? 'teal' : 'ochre'}>{locked ? 'RSVPs open' : 'Planning'}</Badge></div>
                  </div>
                  <span className={`flex h-9 flex-none items-center gap-1.5 rounded-[9px] px-3 text-[13px] font-semibold transition-all ${locked ? 'border border-teal-border bg-teal-bg text-teal-text' : 'bg-accent text-on-accent'} ${lockPressed ? 'scale-95' : ''}`}>
                    {locked ? <><Check size={14} /> Locked in</> : <><Lock size={14} /> Lock it in</>}
                  </span>
                </div>
                <div className="mt-4"><LifecycleStrip phase={locked ? 'upcoming' : 'planning'} size="sm" /></div>
                <div className={`mt-4 rounded-[10px] border px-3.5 py-3 transition-colors ${locked ? 'border-teal-border bg-teal-bg/40' : 'border-border bg-s0'}`}>
                  <p className="text-[11px] font-semibold uppercase tracking-[.13em] text-faint">{locked ? 'The plan' : 'Best window'}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[13.5px] font-medium">
                    <span>Wed, Aug 22, 6:00 – 8:00 PM</span>
                    <span className="rounded-[5px] border border-border bg-s2 px-1.5 text-[10.5px] font-semibold text-dim">PDT</span>
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-[12.5px] text-dim"><MapPin size={13} className="text-accent-text" /> Zuni Café, leading with 4 votes</p>
                </div>
                <p className={`mt-3 text-[12.5px] text-dim transition-opacity ${locked ? 'opacity-100' : 'opacity-0'}`}>Everyone gets the details, and a reminder the day before.</p>
              </Scene>

              {/* the ghost cursor scene 3 uses */}
              <div ref={cursor} className="pointer-events-none absolute left-0 top-0 z-[6] -translate-x-1 -translate-y-1 opacity-0 text-text drop-shadow-sm">
                <span className={`absolute -left-2.5 -top-2.5 h-9 w-9 rounded-full bg-accent/25 transition-opacity duration-150 ${pressing ? 'opacity-100' : 'opacity-0'}`} aria-hidden />
                <MousePointer2 size={18} fill="var(--s1)" className="relative" />
              </div>
            </div>

            {/* step dots and the pause control */}
            <div className="flex items-center justify-between border-t border-border bg-s0 px-3 py-2">
              <span className="flex items-center gap-1">
                {STEPS.map((st, i) => (
                  <button key={i} type="button" onClick={() => go(i)} aria-label={`Step ${i + 1}: ${st.title}`} aria-current={i === active ? 'step' : undefined} className="grid h-6 place-items-center px-0.5">
                    <i className={`block h-1.5 rounded-full transition-all ${i === active ? 'w-5 bg-accent' : 'w-1.5 bg-border2 hover:bg-faint'}`} />
                  </button>
                ))}
              </span>
              <button type="button" onClick={() => setPaused((p) => !p)} aria-label={paused ? 'Resume the demo' : 'Pause the demo'} className="grid h-7 w-7 place-items-center rounded-[7px] border border-border bg-s1 text-dim hover:border-border2 hover:text-text">
                {paused ? <Play size={13} /> : <Pause size={13} />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* the four steps: each one is a scroll target for its scene */}
      <ol className="flex flex-col">
        {STEPS.map(({ title, body }, i) => (
          <li key={title} className="hiw-step flex min-h-[44vh] items-center py-6 lg:min-h-[58vh]">
            <button type="button" onClick={() => go(i)} aria-current={i === active ? 'step' : undefined} className={`hiw-step-text block rounded-xl text-left transition-opacity duration-300 ${i === active ? 'opacity-100' : 'opacity-45 hover:opacity-80'}`}>
              <p className="font-serif text-[26px] leading-tight tracking-[-0.01em] sm:text-[30px]">{title}</p>
              <p className="mt-2 max-w-[380px] text-[14.5px] leading-[1.6] text-dim">{body}</p>
            </button>
          </li>
        ))}
      </ol>
    </div>
  )
}

// one scene, stacked with the others and crossfaded by the active flag
function Scene({ on, children }: { on: boolean; children: React.ReactNode }) {
  return (
    <div className={`absolute inset-0 p-4 transition-opacity duration-400 sm:p-5 ${on ? 'opacity-100' : 'pointer-events-none opacity-0'}`} aria-hidden={!on}>
      {children}
    </div>
  )
}
