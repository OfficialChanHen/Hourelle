'use client'

import { useEffect, useRef, useState } from 'react'
import { MessageCircle, Send, X } from 'lucide-react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { Avatar } from '@/components/ui/Avatar'
import type { AppEvent, ChatMessage, Participant } from '@/lib/events'

/* ── event discussion, reachable from every tab ──
   Desktop: a drawer sliding in from the right over a dimmed backdrop.
   Mobile: a full-height bottom sheet. One shared body between them. */
export function ChatDrawer({ event, messages, onSend, onClose }: {
  event: AppEvent
  messages: ChatMessage[]
  onSend: (text: string) => void
  onClose: () => void
}) {
  const root = useRef<HTMLDivElement>(null)
  const sheet = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    const tl = gsap.timeline()
    tl.fromTo('.cd-back', { opacity: 0 }, { opacity: 1, duration: 0.25 })
      .fromTo('.cd-panel', { x: 26, opacity: 0 }, { x: 0, opacity: 1, duration: 0.35, ease: 'power3.out' }, '<')
      .fromTo('.cd-sheet', { y: '100%' }, { y: 0, duration: 0.36, ease: 'power3.out' }, '<')
  }, { scope: root })

  // the grab bar dismisses the sheet: drag follows the finger, release past the
  // threshold slides it away, a short drag springs back
  const drag = useRef<{ startY: number; dy: number } | null>(null)
  function onGrabDown(e: React.PointerEvent) {
    drag.current = { startY: e.clientY, dy: 0 }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  function onGrabMove(e: React.PointerEvent) {
    if (!drag.current || !sheet.current) return
    drag.current.dy = Math.max(0, e.clientY - drag.current.startY)
    gsap.set(sheet.current, { y: drag.current.dy })
  }
  function onGrabUp() {
    if (!drag.current || !sheet.current) return
    const { dy } = drag.current
    drag.current = null
    if (dy > Math.min(120, sheet.current.clientHeight * 0.22)) {
      gsap.to(sheet.current, { y: '100%', duration: 0.25, ease: 'power2.in', onComplete: onClose })
      if (root.current) gsap.to(root.current.querySelector('.cd-back'), { opacity: 0, duration: 0.25 })
    } else {
      gsap.to(sheet.current, { y: 0, duration: 0.3, ease: 'power3.out' })
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const pById = new Map(event.participants.map((p) => [p.id, p]))
  const avatarOf = (id: string) => {
    const p = pById.get(id)
    return { initials: p?.initials ?? id, name: p?.name ?? id, color: p?.color ?? ('gray' as Participant['color']) }
  }
  const body = <ChatBody members={event.participants.length} messages={messages} onSend={onSend} onClose={onClose} avatarOf={avatarOf} />

  return (
    <div ref={root} className="fixed inset-0 z-50">
      <div className="cd-back absolute inset-0 bg-black/40 lg:bg-black/15" onClick={onClose} />
      {/* desktop: right-side drawer */}
      <div className="cd-panel absolute right-0 top-0 hidden h-full w-[320px] max-w-[88vw] flex-col border-l border-border bg-s0 shadow-soft lg:flex">
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

type ChatProps = { members: number; messages: ChatMessage[]; onSend: (t: string) => void; onClose: () => void; avatarOf: (id: string) => { initials: string; name: string; color: Participant['color'] } }

// header + messages + composer, shared by the drawer and the sheet
function ChatBody({ members, messages, onSend, onClose, avatarOf }: ChatProps) {
  const scroller = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState('')
  useEffect(() => { if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight }, [messages.length])
  function send() { const text = draft.trim(); if (!text) return; onSend(text); setDraft('') }

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <div className="flex flex-none items-center justify-between border-b border-border px-3.5 py-[13px]">
        <div className="flex items-center gap-1.5 text-[14px] font-semibold">
          <MessageCircle size={16} className="text-accent-text" />
          Event discussion
          <span className="rounded-[10px] border border-accent-border bg-accent-bg px-1.5 py-px text-[10.5px] font-semibold text-accent-text">{members} members</span>
        </div>
        <button onClick={onClose} aria-label="Close chat" className="grid h-[30px] w-[30px] place-items-center rounded-lg text-dim hover:text-text"><X size={18} /></button>
      </div>

      <div ref={scroller} className="scroll-slim flex min-h-0 flex-1 flex-col gap-3.5 overflow-auto p-3.5">
        {messages.length === 0 ? (
          <div className="m-auto max-w-[210px] text-center">
            <MessageCircle size={25} className="mx-auto mb-2 text-faint" />
            <p className="text-[13.5px] font-semibold">No messages yet</p>
            <p className="mt-1 text-[12.5px] leading-[1.5] text-dim">Say hi or ask a question. Everyone invited can chat here.</p>
          </div>
        ) : (
          messages.map((m, i) => {
            const a = avatarOf(m.id)
            return (
              <div key={i} className={`flex flex-col gap-1.5 ${m.you ? 'items-end' : 'items-start'}`}>
                <div className="flex items-center gap-1.5 text-[11px] text-dim">
                  {!m.you && <Avatar initials={a.initials} color={a.color} size={18} font={8.5} />}
                  <span className="font-semibold text-text">{m.name}</span>
                  <span>{m.time}</span>
                </div>
                <div className="max-w-[86%] rounded-[13px] border px-[11px] py-2 text-[13px] leading-[1.45]" style={m.you ? { background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' } : { background: 'var(--s2)', color: 'var(--text)', borderColor: 'var(--border)' }}>
                  {m.text}
                </div>
              </div>
            )
          })
        )}
      </div>

      <div className="flex flex-none items-center gap-2 border-t border-border p-[11px]">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="Add a comment…" className="h-[38px] flex-1 rounded-[9px] border border-border bg-s1 px-[11px] text-[13.5px] outline-none placeholder:text-faint focus:border-accent-border" />
        <button onClick={send} aria-label="Send" className="grid h-[38px] w-[38px] flex-none place-items-center rounded-[9px] bg-accent text-on-accent"><Send size={16} /></button>
      </div>
    </div>
  )
}
