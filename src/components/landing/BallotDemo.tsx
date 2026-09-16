'use client'

/* ── the ballot, live ──
   Three places on a small map card and a ballot beside it. Votes land one by one
   as the frame arrives and the ghost cursor casts the host's; tap a place and the
   vote is yours, the counts move, and the pin with the most votes goes deep green.
   The map is a card with pins, not a real map: the landing page stays light. */

import { useRef, useState } from 'react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { ArrowUp, Check } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import type { PersonColor } from '@/lib/colors'
import { cursorTo, GhostCursor, prefersReducedMotion, useInView, VignetteFrame } from './Vignette'

type Person = { i: string; c: PersonColor }
const PEOPLE: Record<string, Person> = { SR: { i: 'SR', c: 'teal' }, AT: { i: 'AT', c: 'coral' }, KL: { i: 'KL', c: 'blue' }, PR: { i: 'PR', c: 'pink' }, MN: { i: 'MN', c: 'amber' } }
const PLACES = [
  { id: 'zuni', name: 'Zuni Café', place: 'Market St, San Francisco', x: 36, y: 44 },
  { id: 'foreign', name: 'Foreign Cinema', place: 'Mission St, San Francisco', x: 64, y: 70 },
  { id: 'tartine', name: 'Tartine Manufactory', place: 'Alabama St, San Francisco', x: 74, y: 30 },
]
// the order votes arrive in as the frame comes into view: two, two and one, so the
// host's vote decides it and moving that vote moves the lead
const ARRIVALS: [string, string][] = [['SR', 'zuni'], ['PR', 'foreign'], ['AT', 'zuni'], ['MN', 'foreign'], ['KL', 'tartine']]

export function BallotDemo() {
  const { ref, near, inView } = useInView<HTMLDivElement>()
  const cursor = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const [votes, setVotes] = useState<Record<string, string[]>>({})
  const [mine, setMine] = useState<string | null>(null)
  const [taken, setTaken] = useState(false)
  const [done, setDone] = useState(false)
  const [pressing, setPressing] = useState(false)
  const [run, setRun] = useState(0)

  // the script plays each time the frame arrives (and on Reset); the ballot is
  // locked until it has finished
  useGSAP(() => {
    if (!inView || !cursor.current) return
    const all = () => { const v: Record<string, string[]> = {}; for (const [p, id] of ARRIVALS) (v[id] ??= []).push(p); return v }
    if (prefersReducedMotion()) { setVotes(all()); setMine('zuni'); setDone(true); return }
    const cur = cursor.current
    const t = gsap.timeline({ delay: 0.3 })
    t.call(() => { setVotes({}); setMine(null); setDone(false) }, [], 0.01)
    ARRIVALS.forEach(([p, id], i) => t.call(() => setVotes((v) => ({ ...v, [id]: [...(v[id] ?? []), p] })), [], 0.5 + i * 0.5))
    // then the host votes: the cursor goes to the Zuni row's button and presses it
    const btn = list.current?.querySelector<HTMLElement>('[data-vote="zuni"]') ?? null
    t.set(cur, { opacity: 1, x: 30, y: 30 }, 3.2)
    cursorTo(t, cur, btn, 0.7, 3.25)
    t.to(cur, { scale: 0.85, duration: 0.12 }).call(() => { setPressing(true); setMine('zuni') })
      .call(() => setPressing(false), [], '+=0.15').to(cur, { scale: 1, duration: 0.12 })
      .to(cur, { opacity: 0, duration: 0.3, delay: 0.4 }).call(() => setDone(true))
    return () => { t.kill(); gsap.set(cur, { opacity: 0 }); setPressing(false) }
  }, { dependencies: [inView, run], revertOnUpdate: true })

  useGSAP(() => {
    if (inView) return
    const t = setTimeout(() => { setTaken(false); setDone(false); setVotes({}); setMine(null) }, 600)
    return () => clearTimeout(t)
  }, { dependencies: [inView] })

  const countOf = (id: string) => (votes[id]?.length ?? 0) + (mine === id ? 1 : 0)
  // the lead, or a tie when the top count is shared
  const top = Math.max(0, ...PLACES.map((p) => countOf(p.id)))
  const leaders = top > 0 ? PLACES.filter((p) => countOf(p.id) === top).map((p) => p.id) : []
  const leadOf = (id: string) => leaders.length === 1 && leaders[0] === id
  const tiedOf = (id: string) => leaders.length > 1 && leaders.includes(id)
  const vote = (id: string) => { if (!done) return; setTaken(true); setMine((m) => (m === id ? null : id)) }
  const reset = () => { setTaken(false); setDone(false); setVotes({}); setMine(null); setRun((r) => r + 1) }

  return (
    <div ref={ref}>
      <VignetteFrame url="hourelle.com/e/rooftop-dinner" hint={!done ? 'Watch first. It is yours in a moment.' : 'Tap a place to vote. One vote each, and you can change your mind.'} taken={taken} onReset={reset}>
        <div className="relative grid grid-cols-1 gap-3 p-4 sm:grid-cols-[1fr_1.1fr] sm:p-5">
          {near && (
            <>
              {/* the map card: a plain surface with three pins */}
              <div className="relative h-[170px] overflow-hidden rounded-[10px] border border-border bg-s2 sm:h-auto sm:min-h-[220px]" aria-hidden>
                <span className="absolute left-[-10%] top-[38%] h-px w-[120%] rotate-[-12deg] bg-border2/70" />
                <span className="absolute left-[48%] top-[-10%] h-[120%] w-px rotate-[8deg] bg-border2/70" />
                <span className="absolute left-[-10%] top-[72%] h-px w-[120%] rotate-[6deg] bg-border2/50" />
                {PLACES.map((p) => {
                  const n = countOf(p.id), lead = leadOf(p.id)
                  return (
                    <span key={p.id} data-pin={p.id} className="absolute transition-transform duration-200" style={{ left: `${p.x}%`, top: `${p.y}%`, transform: `translate(-50%, -100%) scale(${lead ? 1.12 : 1})`, transformOrigin: '50% 100%' }}>
                      <svg width="30" height="39" viewBox="0 0 32 42"><path d="M16 41C16 41 2.5 25 2.5 15.5A13.5 13.5 0 0 1 29.5 15.5C29.5 25 16 41 16 41Z" fill={lead ? 'var(--accent)' : '#5E7B69'} stroke="#fff" strokeWidth="2" strokeLinejoin="round" /><text x="16" y="16" textAnchor="middle" dominantBaseline="central" fontSize="13" fontWeight="700" fill="#fff">{n}</text></svg>
                    </span>
                  )
                })}
              </div>

              {/* the ballot */}
              <div ref={list} className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-[.13em] text-faint">Where should it be?</p>
                  <span className="text-[12px] text-dim">1 vote each</span>
                </div>
                {PLACES.map((p) => {
                  const n = countOf(p.id), voters = votes[p.id] ?? [], lead = leadOf(p.id), tied = tiedOf(p.id), isMine = mine === p.id
                  return (
                    <div key={p.id} className={`flex items-center gap-2.5 rounded-xl border p-2.5 transition-colors ${lead ? 'border-accent-border bg-accent-bg/40' : 'border-border bg-s0'}`}>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 text-[13.5px] font-semibold">{p.name}{lead && <Badge variant="accent">Leading</Badge>}{tied && <Badge variant="ochre">Tied</Badge>}</div>
                        <div className="mt-0.5 truncate text-[12px] text-dim">{p.place} ({n} {n === 1 ? 'vote' : 'votes'})</div>
                        <div className="mt-1 flex">
                          {isMine && <span className="rounded-full ring-2 ring-s0"><Avatar initials="JM" color="purple" size={18} font={8} /></span>}
                          {voters.map((v) => <span key={v} className={`rounded-full ring-2 ring-s0 ${isMine || voters[0] !== v ? '-ml-1' : ''}`}><Avatar initials={PEOPLE[v].i} color={PEOPLE[v].c} size={18} font={8} /></span>)}
                        </div>
                      </div>
                      <button type="button" data-vote={p.id} onClick={() => vote(p.id)} aria-pressed={isMine} disabled={!done} className={`flex h-9 w-9 flex-none items-center justify-center rounded-[9px] border transition-colors disabled:cursor-default ${isMine ? 'border-accent bg-accent text-on-accent' : 'border-border2 bg-s1 text-dim hover:border-accent-border hover:text-accent-text'}`} aria-label={isMine ? `Take your vote off ${p.name}` : `Vote for ${p.name}`}>
                        {isMine ? <Check size={16} /> : <ArrowUp size={16} />}
                      </button>
                    </div>
                  )
                })}
              </div>
              <GhostCursor cursorRef={cursor} pressing={pressing} />
            </>
          )}
        </div>
      </VignetteFrame>
    </div>
  )
}
