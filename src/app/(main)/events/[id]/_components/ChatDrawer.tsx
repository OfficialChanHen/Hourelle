'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, Send, X } from 'lucide-react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { Avatar } from '@/components/ui/Avatar'
import { fmtMinute, type AppEvent, type ChatMessage, type Participant } from '@/lib/events'
import { prefH24 } from '@/lib/prefs'

/* ── event discussion, reachable from every tab ──
   Desktop: a drawer sliding in from the right over a dimmed backdrop.
   Mobile: a full-height bottom sheet. One shared body between them.
   Messages carry an `at` timestamp when they were sent from this app; older
   stored messages and demo seeds only have a display string, which renders as-is. */

const DAY_MS = 86_400_000

function dayKeyOf(at?: number): string | null {
  return at ? new Date(at).toDateString() : null
}

function dayLabel(at: number): string {
  const d = new Date(at)
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return 'Today'
  const yd = new Date(today.getTime() - DAY_MS)
  if (d.toDateString() === yd.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function whenLabel(m: ChatMessage, h24: boolean): string {
  if (!m.at) return m.time
  if (Date.now() - m.at < 60_000) return 'now'
  const d = new Date(m.at)
  const clock = fmtMinute(d.getHours() * 60 + d.getMinutes(), h24)
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return clock
  if (d.toDateString() === new Date(today.getTime() - DAY_MS).toDateString()) return `Yesterday ${clock}`
  if (today.getTime() - m.at < 6 * DAY_MS) return `${d.toLocaleDateString('en-US', { weekday: 'short' })} ${clock}`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function ChatDrawer({ event, messages, unreadFrom, onSend, onClose, readOnly = false }: {
  event: AppEvent
  messages: ChatMessage[]
  unreadFrom?: number // index of the first message that arrived since the drawer was last open
  onSend: (text: string) => void
  onClose: () => void
  readOnly?: boolean // a demo, or nobody here is you: the room can be read, not written
}) {
  const root = useRef<HTMLDivElement>(null)
  const sheet = useRef<HTMLDivElement>(null)
  const closing = useRef(false)

  const { contextSafe } = useGSAP(() => {
    const tl = gsap.timeline()
    tl.fromTo('.cd-back', { opacity: 0 }, { opacity: 1, duration: 0.25 })
      .fromTo('.cd-panel', { x: 26, opacity: 0 }, { x: 0, opacity: 1, duration: 0.35, ease: 'power3.out' }, '<')
      .fromTo('.cd-sheet', { y: '100%' }, { y: 0, duration: 0.36, ease: 'power3.out' }, '<')
  }, { scope: root })

  // every way out plays the same exit: backdrop fades while the panel slides away
  const close = contextSafe(() => {
    if (closing.current) return
    closing.current = true
    const tl = gsap.timeline({ onComplete: onClose })
    tl.to('.cd-back', { opacity: 0, duration: 0.22 }, 0)
      .to('.cd-panel', { x: 26, opacity: 0, duration: 0.25, ease: 'power2.in' }, 0)
      .to('.cd-sheet', { y: '100%', duration: 0.28, ease: 'power2.in' }, 0)
  })

  // the grab bar dismisses the sheet: drag follows the finger, release past the
  // threshold slides it away, a short drag springs back
  const drag = useRef<{ startY: number; dy: number } | null>(null)
  function onGrabDown(e: React.PointerEvent) {
    drag.current = { startY: e.clientY, dy: 0 }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onGrabMove = contextSafe((e: React.PointerEvent) => {
    if (!drag.current || !sheet.current) return
    drag.current.dy = Math.max(0, e.clientY - drag.current.startY)
    gsap.set(sheet.current, { y: drag.current.dy })
  })
  const onGrabUp = contextSafe(() => {
    if (!drag.current || !sheet.current) return
    const { dy } = drag.current
    drag.current = null
    if (dy > Math.min(120, sheet.current.clientHeight * 0.22)) {
      closing.current = true
      gsap.to(sheet.current, { y: '100%', duration: 0.25, ease: 'power2.in', onComplete: onClose })
      if (root.current) gsap.to(root.current.querySelector('.cd-back'), { opacity: 0, duration: 0.25 })
    } else {
      gsap.to(sheet.current, { y: 0, duration: 0.3, ease: 'power3.out' })
    }
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close])

  const pById = new Map(event.participants.map((p) => [p.id, p]))
  const avatarOf = (id: string) => {
    const p = pById.get(id)
    return { initials: p?.initials ?? id, name: p?.name ?? id, color: p?.color ?? ('gray' as Participant['color']) }
  }
  const body = <ChatBody messages={messages} unreadFrom={unreadFrom} onSend={onSend} onClose={close} avatarOf={avatarOf} readOnly={readOnly} />

  return (
    <div ref={root} className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Event discussion">
      <div className="cd-back absolute inset-0 bg-black/40 lg:bg-black/15" onClick={close} />
      {/* desktop: right-side drawer */}
      <div className="cd-panel absolute right-0 top-0 hidden h-full w-[330px] max-w-[88vw] flex-col border-l border-border bg-s0 shadow-soft lg:flex">
        {body}
      </div>
      {/* mobile: full-height bottom sheet, dismissable by dragging the grab bar */}
      <div
        ref={sheet}
        className="cd-sheet absolute inset-x-0 bottom-0 flex h-[88dvh] flex-col overflow-hidden rounded-t-2xl border-t border-border bg-s0 shadow-soft lg:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div
          className="flex flex-none cursor-grab touch-none justify-center py-2.5 active:cursor-grabbing"
          onPointerDown={onGrabDown}
          onPointerMove={onGrabMove}
          onPointerUp={onGrabUp}
          onPointerCancel={onGrabUp}
          aria-label="Drag down to close"
        >
          <span className="h-1 w-10 rounded-full bg-border2" />
        </div>
        {body}
      </div>
    </div>
  )
}

type ChatProps = {
  messages: ChatMessage[]; unreadFrom?: number
  onSend: (t: string) => void; onClose: () => void
  avatarOf: (id: string) => { initials: string; name: string; color: Participant['color'] }
  readOnly: boolean
}

type Row =
  | { kind: 'day'; label: string; key: string }
  | { kind: 'new'; key: string }
  | { kind: 'msg'; m: ChatMessage; key: string; first: boolean } // first: opens a sender run, so it wears the header

// header + messages + composer, shared by the drawer and the sheet
function ChatBody({ messages, unreadFrom, onSend, onClose, avatarOf, readOnly }: ChatProps) {
  const zone = useRef<HTMLDivElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const ta = useRef<HTMLTextAreaElement>(null)
  const [draft, setDraft] = useState('')
  const h24 = prefH24()

  // messages become rows: day dividers where the date turns over, a "new" rule at
  // the first unread, and sender runs so only the first of a run wears the header
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = []
    let prev: ChatMessage | null = null
    messages.forEach((m, i) => {
      let broke = false
      const dk = dayKeyOf(m.at)
      if (dk && dk !== dayKeyOf(prev?.at)) {
        out.push({ kind: 'day', label: dayLabel(m.at!), key: `day-${dk}` })
        broke = true
      }
      if (unreadFrom !== undefined && i === unreadFrom && i > 0) {
        out.push({ kind: 'new', key: 'new' })
        broke = true
      }
      const sameRun = !broke && !!prev && !m.system && !prev.system && prev.id === m.id && prev.you === m.you
        && (m.at && prev.at ? m.at - prev.at < 5 * 60_000 : m.time === prev?.time)
      out.push({ kind: 'msg', m, key: `m-${i}`, first: !sameRun })
      prev = m
    })
    return out
  }, [messages, unreadFrom])

  // stick to the bottom while the reader is there; when they scroll up into
  // history, new arrivals wait behind a jump pill instead of yanking the view
  const pinned = useRef(true)
  const [fresh, setFresh] = useState(false)
  const count = useRef<number | null>(null)

  function onScroll() {
    const el = scroller.current
    if (!el) return
    pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
    if (pinned.current) setFresh(false)
  }
  function jump() {
    const el = scroller.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    setFresh(false)
  }

  // first open lands on the unread rule when there is one, else the latest message
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const mark = el.querySelector('[data-new-rule]')
    if (mark) (mark as HTMLElement).scrollIntoView({ block: 'center' })
    else el.scrollTop = el.scrollHeight
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useGSAP(() => {
    const el = scroller.current
    if (count.current !== null && messages.length > count.current && el) {
      const last = messages[messages.length - 1]
      if (pinned.current || last.you) {
        el.scrollTop = el.scrollHeight
        const node = el.querySelector('.cd-msg:last-child')
        if (node) gsap.from(node, { y: 10, opacity: 0, duration: 0.28, ease: 'power2.out' })
      } else {
        setFresh(true)
      }
    }
    count.current = messages.length
  }, { scope: zone, dependencies: [messages.length] })

  function autosize() {
    const el = ta.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }
  function send() {
    const text = draft.trim()
    if (!text) return
    onSend(text)
    setDraft('')
    requestAnimationFrame(autosize)
  }

  return (
    <div ref={zone} className="flex h-full min-h-0 w-full flex-col">
      <div className="flex flex-none items-center justify-between border-b border-border px-4 py-3">
        <div className="font-serif text-[19px] leading-tight tracking-[-0.01em]">Discussion</div>
        <button onClick={onClose} aria-label="Close chat" className="-mr-1 grid h-[34px] w-[34px] place-items-center rounded-lg text-dim hover:text-text"><X size={18} /></button>
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col">
        <div ref={scroller} onScroll={onScroll} className="scroll-slim min-h-0 flex-1 overflow-auto px-3.5 py-3">
          {messages.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <div className="max-w-[220px] text-center">
                <p className="font-serif text-[19px]">Start the conversation</p>
                <p className="mt-1.5 text-[12.5px] leading-[1.5] text-dim">Say hi or ask a question. Everyone invited can read and reply.</p>
              </div>
            </div>
          ) : (
            rows.map((r) => {
              if (r.kind === 'day') return (
                <div key={r.key} className="mb-1 mt-4 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[.13em] text-faint first:mt-1">
                  <span className="h-px flex-1 bg-border" />{r.label}<span className="h-px flex-1 bg-border" />
                </div>
              )
              if (r.kind === 'new') return (
                <div key={r.key} data-new-rule className="mb-1 mt-4 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[.13em] text-accent-text first:mt-1">
                  <span className="h-px flex-1 bg-accent-border" />New<span className="h-px flex-1 bg-accent-border" />
                </div>
              )
              const { m, first } = r
              const a = avatarOf(m.id)
              // a line the app wrote ("Sam joined", "reopened the plan"): a quiet
              // centered note, never a bubble, so it reads as the room, not a person
              if (m.system) return (
                <div key={r.key} className="mt-3 flex items-center justify-center gap-2 text-[11.5px] text-faint">
                  <Avatar initials={a.initials} color={a.color} size={16} font={7.5} />
                  <span><span className="font-semibold text-dim">{m.name}</span> {m.text}</span>
                  <span>· {whenLabel(m, h24)}</span>
                </div>
              )
              return (
                <div key={r.key} className={`cd-msg flex flex-col ${first ? 'mt-3.5 first:mt-1' : 'mt-1'} ${m.you ? 'items-end' : 'items-start'}`}>
                  {first && (
                    <div className="mb-1 flex items-center gap-1.5 text-[11px] text-dim">
                      {!m.you && <Avatar initials={a.initials} color={a.color} size={18} font={8.5} />}
                      <span className="font-semibold text-text">{m.name}</span>
                      <span>{whenLabel(m, h24)}</span>
                    </div>
                  )}
                  <div
                    title={first ? undefined : whenLabel(m, h24)}
                    className={`max-w-[86%] whitespace-pre-wrap break-words rounded-[14px] border px-[11px] py-2 text-[13px] leading-[1.45] ${
                      m.you
                        ? `border-accent bg-accent text-on-accent ${first ? 'rounded-tr-[5px]' : ''}`
                        : `border-border bg-s2 text-text ${first ? 'rounded-tl-[5px]' : ''}`
                    }`}
                  >
                    {m.text}
                  </div>
                </div>
              )
            })
          )}
        </div>
        {fresh && (
          <button
            onClick={jump}
            className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-accent-border bg-accent-bg px-3 py-1.5 text-[11.5px] font-semibold text-accent-text shadow-soft"
          >
            <ArrowDown size={13} /> New messages
          </button>
        )}
      </div>

      {readOnly ? null : (
      <div className="flex flex-none items-end gap-2 border-t border-border p-[11px]">
        <textarea
          ref={ta}
          value={draft}
          rows={1}
          onChange={(e) => { setDraft(e.target.value); autosize() }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
          }}
          placeholder="Add a comment…"
          aria-label="Write a message"
          className="scroll-slim min-h-11 sm:min-h-[38px] flex-1 resize-none rounded-[12px] border border-border bg-s1 px-[11px] py-[11px] sm:py-[9px] text-[13.5px] leading-[1.4] outline-none placeholder:text-faint focus:border-accent-border"
        />
        <button
          onClick={send}
          disabled={!draft.trim()}
          aria-label="Send"
          className="grid h-11 w-11 sm:h-[38px] sm:w-[38px] flex-none place-items-center rounded-[12px] bg-accent text-on-accent transition-opacity disabled:opacity-40"
        >
          <Send size={16} />
        </button>
      </div>
      )}
    </div>
  )
}
