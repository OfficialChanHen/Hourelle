'use client'

/* ── who is coming, and the room they talk in ──
   An RSVP row you can answer and the headcount it moves, above a chat where two
   lines arrive as the frame comes into view and a quiet note marks a reply. Type
   something and press Enter and it lands in the room as you. Nothing leaves the
   page: this is a picture of the product that happens to work. */

import { useRef, useState } from 'react'
import { useGSAP } from '@gsap/react'
import { Check, HelpCircle, SendHorizontal, X } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import type { PersonColor } from '@/lib/colors'
import { prefersReducedMotion, useInView, VignetteFrame } from './Vignette'

type Rsvp = 'going' | 'maybe' | 'no' | null
type Msg = { id: number; who: string; name: string; color: PersonColor; text: string; you?: boolean; system?: boolean }
const OTHERS: { i: string; c: PersonColor; r: Exclude<Rsvp, null> }[] = [
  { i: 'SR', c: 'teal', r: 'going' }, { i: 'AT', c: 'coral', r: 'going' }, { i: 'KL', c: 'blue', r: 'maybe' }, { i: 'PR', c: 'pink', r: 'going' }, { i: 'MN', c: 'amber', r: 'no' },
]
const ARRIVING: Msg[] = [
  { id: 1, who: 'SR', name: 'Sarah', color: 'teal', text: 'Wednesday works. Should we book the big table?' },
  { id: 2, who: 'AT', name: 'Alex', color: 'coral', text: 'Yes, and I can be there early to grab it' },
  { id: 3, who: 'PR', name: 'Priya', color: 'pink', text: 'is going', system: true },
]

export function ChatDemo() {
  const { ref, near, inView } = useInView<HTMLDivElement>()
  const [rsvp, setRsvp] = useState<Rsvp>(null)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [draft, setDraft] = useState('')
  const [taken, setTaken] = useState(false)
  const [done, setDone] = useState(false)
  const [run, setRun] = useState(0)
  const nextId = useRef(100)
  const scroller = useRef<HTMLDivElement>(null)

  // the room fills as the frame arrives; a reduced-motion visitor sees it full
  useGSAP(() => {
    if (!inView) return
    if (prefersReducedMotion()) { setMsgs(ARRIVING); setDone(true); return }
    const timers = ARRIVING.map((m, i) => setTimeout(() => setMsgs((l) => (l.some((x) => x.id === m.id) ? l : [...l, m])), 500 + i * 1100))
    timers.push(setTimeout(() => setDone(true), 500 + ARRIVING.length * 1100))
    return () => timers.forEach(clearTimeout)
  }, { dependencies: [inView, run], revertOnUpdate: true })

  useGSAP(() => {
    if (inView) return
    const t = setTimeout(() => { setTaken(false); setDone(false); setMsgs([]); setRsvp(null); setDraft('') }, 600)
    return () => clearTimeout(t)
  }, { dependencies: [inView] })

  // the newest line stays in view
  useGSAP(() => { scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' }) }, { dependencies: [msgs.length] })

  const going = OTHERS.filter((p) => p.r === 'going').length + (rsvp === 'going' ? 1 : 0)
  const maybe = OTHERS.filter((p) => p.r === 'maybe').length + (rsvp === 'maybe' ? 1 : 0)
  const no = OTHERS.filter((p) => p.r === 'no').length + (rsvp === 'no' ? 1 : 0)

  function send() {
    const text = draft.trim()
    if (!text || !done) return
    setTaken(true)
    setMsgs((l) => [...l, { id: nextId.current++, who: 'JM', name: 'You', color: 'purple', text, you: true }])
    setDraft('')
  }
  function answer(r: Exclude<Rsvp, null>) {
    if (!done) return
    setTaken(true)
    setRsvp((cur) => (cur === r ? null : r))
  }
  const reset = () => { setTaken(false); setDone(false); setMsgs([]); setRsvp(null); setDraft(''); setRun((r) => r + 1) }

  const seg = (r: Exclude<Rsvp, null>, label: string, Icon: typeof Check) => (
    <button type="button" onClick={() => answer(r)} aria-pressed={rsvp === r} disabled={!done} className={`flex h-9 flex-1 items-center justify-center gap-1.5 rounded-[8px] text-[13px] font-semibold transition-colors disabled:cursor-default ${rsvp === r ? 'bg-accent text-on-accent' : 'text-dim hover:bg-s2 hover:text-text'}`}>
      <Icon size={14} /> {label}
    </button>
  )

  return (
    <div ref={ref}>
      <VignetteFrame url="hourelle.com/e/rooftop-dinner" hint={!done ? 'Watch first. It is yours in a moment.' : 'Say whether you are coming, then say it in the room.'} taken={taken} onReset={reset}>
        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-[1fr_1.15fr] sm:p-5">
          {near && (
            <>
              {/* who is coming */}
              <div className="flex flex-col gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[.13em] text-faint">Are you coming?</p>
                  <div className="mt-2 flex gap-1 rounded-[10px] border border-border bg-s0 p-1">
                    {seg('going', 'Going', Check)}{seg('maybe', 'Maybe', HelpCircle)}{seg('no', "Can't", X)}
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-s0 p-3">
                  <p className="font-serif text-[30px] leading-none tracking-[-0.01em]">{going}<span className="ml-1.5 text-[14px] text-dim">going</span></p>
                  <p className="mt-1.5 text-[12.5px] text-dim">{maybe} maybe, {no} can&apos;t, {rsvp ? 0 : 1} no reply</p>
                  <div className="mt-2.5 flex">
                    {OTHERS.filter((p) => p.r === 'going').map((p, i) => <span key={p.i} className={`rounded-full ring-2 ring-s0 ${i ? '-ml-1.5' : ''}`}><Avatar initials={p.i} color={p.c} size={24} font={9} /></span>)}
                    {rsvp === 'going' && <span className="-ml-1.5 rounded-full ring-2 ring-s0"><Avatar initials="JM" color="purple" size={24} font={9} /></span>}
                  </div>
                </div>
              </div>

              {/* the room */}
              <div className="flex h-[250px] flex-col rounded-xl border border-border bg-s0 sm:h-[260px]">
                <div className="flex items-center justify-between border-b border-border px-3 py-2">
                  <span className="text-[12.5px] font-semibold">Rooftop dinner</span>
                  <span className="text-[11.5px] text-faint">{OTHERS.length + 1} people</span>
                </div>
                <div ref={scroller} className="scroll-slim flex-1 space-y-2 overflow-y-auto px-3 py-2.5">
                  {msgs.length === 0 && <p className="pt-6 text-center text-[12px] text-faint">Nothing yet. Say hello.</p>}
                  {msgs.map((m) => m.system ? (
                    <p key={m.id} className="flex items-center justify-center gap-1.5 text-[11.5px] text-faint"><Avatar initials={m.who} color={m.color} size={14} font={6.5} /> <span className="font-semibold text-dim">{m.name}</span> {m.text}</p>
                  ) : (
                    <div key={m.id} className={`flex items-end gap-1.5 ${m.you ? 'flex-row-reverse' : ''}`}>
                      {!m.you && <Avatar initials={m.who} color={m.color} size={18} font={8} />}
                      <div className={`max-w-[85%] rounded-[12px] px-2.5 py-1.5 text-[12.5px] leading-[1.45] ${m.you ? 'bg-accent text-on-accent' : 'bg-s2'}`}>
                        {!m.you && <span className="mr-1 font-semibold">{m.name}</span>}{m.text}
                      </div>
                    </div>
                  ))}
                </div>
                <form onSubmit={(e) => { e.preventDefault(); send() }} className="flex items-center gap-1.5 border-t border-border p-2">
                  <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Write a message" aria-label="Write a message" disabled={!done} className="h-9 min-w-0 flex-1 rounded-[8px] border border-border bg-s1 px-2.5 text-[13px] outline-none placeholder:text-faint focus:border-accent-border" />
                  <button type="submit" aria-label="Send" disabled={!draft.trim()} className="grid h-9 w-9 flex-none place-items-center rounded-[8px] bg-accent text-on-accent disabled:opacity-40"><SendHorizontal size={15} /></button>
                </form>
              </div>
            </>
          )}
        </div>
      </VignetteFrame>
    </div>
  )
}
