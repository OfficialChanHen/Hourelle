'use client'

import { useRef, useState } from 'react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { Avatar } from '@/components/ui/Avatar'
import { messages as seed, participants, type ChatMessage } from '@/lib/sample'

function authorOf(id: string) {
  return participants.find((p) => p.id === id) ?? participants[0]
}

export function ChatDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const backdrop = useRef<HTMLDivElement>(null)
  const drawer = useRef<HTMLDivElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const [msgs, setMsgs] = useState<ChatMessage[]>(seed)
  const [draft, setDraft] = useState('')

  // backdrop + drawer animate together as one timeline
  useGSAP(
    () => {
      if (open) {
        gsap.set([backdrop.current, drawer.current], { display: 'block' })
        const tl = gsap.timeline()
        tl.to(backdrop.current, { opacity: 1, duration: 0.3, ease: 'power2.out' })
          .fromTo(drawer.current, { x: '100%' }, { x: '0%', duration: 0.42, ease: 'power3.out' }, '<')
      } else {
        const tl = gsap.timeline({
          onComplete: () => gsap.set([backdrop.current, drawer.current], { display: 'none' }),
        })
        tl.to(drawer.current, { x: '100%', duration: 0.32, ease: 'power3.in' })
          .to(backdrop.current, { opacity: 0, duration: 0.24, ease: 'power2.in' }, '<')
      }
    },
    { dependencies: [open] },
  )

  function send() {
    const body = draft.trim()
    if (!body) return
    setMsgs((m) => [...m, { id: `me-${m.length}`, authorId: 'p0', body, time: 'now', mine: true }])
    setDraft('')
    requestAnimationFrame(() => {
      if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight
    })
  }

  return (
    <>
      <div
        ref={backdrop}
        onClick={onClose}
        className="absolute inset-0 z-40 hidden opacity-0"
        style={{ background: 'rgba(0,0,0,0.16)', display: 'none' }}
      />
      <div
        ref={drawer}
        className="absolute right-0 top-0 z-50 hidden h-full w-[340px] max-w-[88vw] translate-x-full border-l border-border bg-s1 shadow-soft"
        style={{ display: 'none' }}
      >
        <div className="flex h-full flex-col">
          {/* header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[.13em] text-faint">Event chat</p>
              <p className="font-serif text-[19px] leading-none tracking-[-0.01em]">Discussion</p>
            </div>
            <button onClick={onClose} aria-label="Close chat" className="grid h-8 w-8 place-items-center rounded-lg border border-border text-dim hover:text-text">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          </div>

          {/* messages */}
          <div ref={scroller} className="scroll-slim flex-1 space-y-4 overflow-y-auto px-4 py-4">
            {msgs.map((m) => {
              const a = authorOf(m.authorId)
              if (m.mine) {
                return (
                  <div key={m.id} className="flex flex-col items-end">
                    <div className="max-w-[80%] rounded-2xl rounded-br-md bg-accent px-3.5 py-2 text-[13px] leading-snug text-on-accent">
                      {m.body}
                    </div>
                    <span className="mt-1 text-[10px] text-faint">{m.time}</span>
                  </div>
                )
              }
              return (
                <div key={m.id} className="flex gap-2.5">
                  <Avatar initials={a.initials} color={a.color} size="md" />
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-[12.5px] font-semibold">{a.name}</span>
                      <span className="text-[10px] text-faint">{m.time}</span>
                    </div>
                    <div className="mt-1 max-w-[80%] rounded-2xl rounded-tl-md border border-border bg-s0 px-3.5 py-2 text-[13px] leading-snug text-text">
                      {m.body}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* composer */}
          <div className="border-t border-border p-3">
            <div className="flex items-end gap-2 rounded-xl border border-border bg-s0 px-3 py-2 focus-within:border-accent-border">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    send()
                  }
                }}
                rows={1}
                placeholder="Message the group…"
                className="max-h-24 w-full resize-none bg-transparent text-[13px] outline-none placeholder:text-faint"
              />
              <button
                onClick={send}
                aria-label="Send"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent text-on-accent transition-transform hover:-translate-y-px"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
