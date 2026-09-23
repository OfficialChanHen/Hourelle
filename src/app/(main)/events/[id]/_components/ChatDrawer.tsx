'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, Send, X } from 'lucide-react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { Avatar } from '@/components/ui/Avatar'
import { fmtMinute, type AppEvent, type ChatMessage, type Participant } from '@/lib/events'
import { prefH24 } from '@/lib/prefs'
import { typingLine, type Peer } from '@/lib/room'
import { setWatchingChat } from '@/lib/sound'
import { removedLineTest } from '@/lib/removed'
import { usePhoneScreen } from '@/hooks/usePhoneScreen'

/* ── event discussion, reachable from every tab ──
   Desktop: a drawer sliding in from the right over a dimmed backdrop.
   Mobile: the whole screen, sliding up from the bottom. One shared body between them.
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

export function ChatDrawer({ event, messages, unreadFrom, onSend, onClose, readOnly = false, typing = [], onType, onStopTyping }: {
  event: AppEvent
  messages: ChatMessage[]
  unreadFrom?: number // index of the first message that arrived since the drawer was last open
  onSend: (text: string) => void
  onClose: () => void
  readOnly?: boolean // a demo, or nobody here is you: the room can be read, not written
  // who is here now is said by the faces in the event header; in here the typing line
  // is the live signal, and a second one would only be noise
  typing?: Peer[]         // who is mid-sentence right now
  onType?: () => void     // a keystroke; the room rate-limits the ping itself
  onStopTyping?: () => void
}) {
  const root = useRef<HTMLDivElement>(null)
  const closing = useRef(false)

  // you are reading this room, so a message landing in it is not news to announce
  useEffect(() => {
    setWatchingChat(event.id)
    return () => setWatchingChat(null)
  }, [event.id])

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

  // on a phone the room is the screen, keyboard or not
  usePhoneScreen(root, { lockWide: true })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close])

  const pById = new Map(event.participants.map((p) => [p.id, p]))
  // a sender no longer on the list (merged into someone else, or an old line) is named
  // from the line itself, which kept their name at the time: never from their raw id
  const avatarOf = (id: string, name?: string) => {
    const p = pById.get(id)
    const n = p?.name ?? name ?? 'Someone'
    const initials = p?.initials ?? (n.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?')
    return { initials, name: n, color: p?.color ?? ('stone' as Participant['color']) }
  }
  // lines from people the host took off the event never show, whatever copy they came
  // from, and not even once that person is back on the list
  const hidden = removedLineTest(event)
  const shown = event.removedIds?.length ? messages.filter((m) => !hidden(m)) : messages
  const body = <ChatBody messages={shown} unreadFrom={unreadFrom} onSend={onSend} onClose={close} avatarOf={avatarOf} readOnly={readOnly} typing={typing} onType={onType} onStopTyping={onStopTyping} />

  return (
    <div ref={root} className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Event discussion">
      <div className="cd-back absolute inset-0 bg-black/40 lg:bg-black/15" onClick={close} />
      {/* desktop: right-side drawer */}
      <div className="cd-panel absolute right-0 top-0 hidden h-full w-[330px] max-w-[88vw] flex-col border-l border-border bg-s0 shadow-soft lg:flex">
        {body}
      </div>
      {/* mobile: the whole screen */}
      <div
        className="cd-sheet absolute inset-0 flex flex-col bg-s0 lg:hidden"
        style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* the sheet runs on past its own bottom edge in its own colour. The pin above
            follows the viewport a frame late, and while a keyboard or the browser's bar
            is sliding, that frame used to be a band of the page. Now it is more sheet. */}
        <div className="pointer-events-none absolute inset-x-0 top-full h-[100lvh] bg-s0" aria-hidden />
        {body}
      </div>
    </div>
  )
}

type ChatProps = {
  messages: ChatMessage[]; unreadFrom?: number
  onSend: (t: string) => void; onClose: () => void
  typing: Peer[]; onType?: () => void; onStopTyping?: () => void
  avatarOf: (id: string, name?: string) => { initials: string; name: string; color: Participant['color'] }
  readOnly: boolean
}

type Row =
  | { kind: 'day'; label: string; key: string }
  | { kind: 'new'; key: string }
  | { kind: 'msg'; m: ChatMessage; key: string; first: boolean } // first: opens a sender run, so it wears the header

// header + messages + composer, shared by the drawer and the sheet
function ChatBody({ messages, unreadFrom, onSend, onClose, avatarOf, readOnly, typing, onType, onStopTyping }: ChatProps) {
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
    onStopTyping?.() // the line clears the moment the message lands, not four seconds later
    requestAnimationFrame(autosize)
  }
  const typingText = typingLine(typing)

  return (
    <div ref={zone} className="flex h-full min-h-0 w-full flex-col">
      <div className="flex flex-none items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0 font-serif text-[19px] leading-tight tracking-[-0.01em]">Discussion</div>
        <button onClick={onClose} aria-label="Close chat" className="-mr-2 grid h-11 w-11 place-items-center sm:-mr-1 sm:h-[34px] sm:w-[34px] rounded-lg text-dim hover:text-text"><X size={18} /></button>
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col">
        <div ref={scroller} onScroll={onScroll} className="scroll-slim min-h-0 flex-1 overflow-auto overscroll-contain px-3.5 py-3">
          {messages.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <div className="max-w-[220px] text-center">
                <p className="font-serif text-[19px]">Start the conversation</p>
                <p className="mt-1.5 text-[12.5px] leading-[1.5] text-dim">Say hi or ask a question. Everyone here can read and reply.</p>
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
              const a = avatarOf(m.id, m.name)
              // a line the app wrote ("Sam joined", "reopened the plan"): a quiet
              // centered note, never a bubble, so it reads as the room, not a person
              if (m.system) return (
                <div key={r.key} className="mt-3 flex flex-col items-center gap-0.5 text-[11.5px] text-faint">
                  <span className="text-[10.5px]">{whenLabel(m, h24)}</span>
                  <span className="flex items-center gap-2">
                    <Avatar initials={a.initials} color={a.color} size={16} font={7.5} />
                    <span><span className="font-semibold text-dim">{m.name}</span> {m.text}</span>
                  </span>
                </div>
              )
              return (
                <div key={r.key} className={`cd-msg flex flex-col ${first ? 'mt-3.5 first:mt-1' : 'mt-1'} ${m.you ? 'items-end' : 'items-start'}`}>
                  {/* only other people are named. Your own messages are the ones in the
                      accent on the right, which says whose they are without a label. */}
                  {first && !m.you && (
                    <div className="mb-1 flex items-center gap-1.5 text-[11px] text-dim">
                      <Avatar initials={a.initials} color={a.color} size={18} font={8.5} />
                      <span className="font-semibold text-text">{m.name}</span>
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
                  {/* the time under the message and on its own side, one line of its
                      own, so a long name and a time can never stack into a column */}
                  {first && (
                    <span className={`mt-0.5 whitespace-nowrap text-[10.5px] leading-none text-faint ${m.you ? 'pr-1 text-right' : 'pl-1 text-left'}`}>
                      {whenLabel(m, h24)}
                    </span>
                  )}
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

      {/* who is mid-sentence. Sits above the composer so it never moves the messages,
          and holds its height so the panel does not jump as people start and stop */}
      <div aria-live="polite" className={`flex-none overflow-hidden px-4 text-[11.5px] italic text-faint transition-[height] ${typingText ? 'h-[19px]' : 'h-0'}`}>
        {typingText}
      </div>

      {readOnly ? null : (
      <div className="flex flex-none items-end gap-2 border-t border-border p-[11px]">
        <textarea
          ref={ta}
          value={draft}
          rows={1}
          onChange={(e) => { setDraft(e.target.value); autosize(); if (e.target.value.trim()) onType?.(); else onStopTyping?.() }}
          onBlur={() => onStopTyping?.()}
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
