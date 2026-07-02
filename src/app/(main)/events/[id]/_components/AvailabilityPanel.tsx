'use client'

import { useMemo, useRef, useState } from 'react'
import {
  ChevronLeft, ChevronRight, CalendarPlus, MessageCircle, X, Send,
} from 'lucide-react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { Avatar } from '@/components/ui/Avatar'
import { AvatarRow } from '@/components/ui/AvatarRow'
import { TimezonePill } from '@/components/ui/TimezonePill'
import { av, avs } from '@/lib/people'
import { avail as seedAvail, gridDays, gridTimes, participantIds, event, messages as seedMsgs, type ChatMessage } from '@/lib/sample'

type Mode = 'view' | 'edit'
type Gran = '15' | '30' | '60'

function heat(n: number) {
  return n === 0 ? 'var(--s2)' : n <= 2 ? '#EBF1EB' : n <= 4 ? '#CFE0D2' : n <= 6 ? '#9DBBA4' : '#2E4A3C'
}

export function AvailabilityPanel() {
  const [mode, setMode] = useState<Mode>('view')
  const [gran, setGran] = useState<Gran>('30')
  const [chatOpen, setChatOpen] = useState(true)
  const [avail, setAvail] = useState<Record<string, string[][]>>(() =>
    Object.fromEntries(Object.entries(seedAvail).map(([k, v]) => [k, v.map((c) => [...c])])),
  )

  function toggleCell(dayKey: string, ti: number) {
    if (mode !== 'edit') return
    setAvail((prev) => {
      const next = { ...prev, [dayKey]: prev[dayKey].map((c) => [...c]) }
      const cell = next[dayKey][ti]
      const i = cell.indexOf('JM')
      if (i >= 0) cell.splice(i, 1)
      else cell.push('JM')
      return next
    })
  }

  return (
    <div className="flex min-h-[540px] overflow-hidden rounded-2xl border border-border bg-s1">
      {/* grid area */}
      <div className="flex min-w-0 flex-1 flex-col p-4">
        {/* toolbar */}
        <div className="flex flex-wrap items-center gap-[9px] border-b border-border pb-[13px]">
          <Segment
            value={mode}
            onChange={(v) => setMode(v as Mode)}
            options={[{ v: 'view', l: 'View' }, { v: 'edit', l: 'Edit mine' }]}
          />
          <span className="h-5 w-px bg-border" />
          <div className="flex items-center gap-[3px]">
            <IconBtn><ChevronLeft size={15} /></IconBtn>
            <span className="px-1 text-[12px] font-semibold">Jun 30 – Jul 4</span>
            <IconBtn><ChevronRight size={15} /></IconBtn>
          </div>
          <button className="flex h-7 items-center gap-1.5 rounded-lg border border-border bg-s1 px-[11px] text-[11.5px] font-medium hover:border-border2">
            <CalendarPlus size={13} /> Google Calendar
          </button>
          <div className="flex-1" />
          <Segment
            value={gran}
            onChange={(v) => setGran(v as Gran)}
            options={[{ v: '15', l: '15 min' }, { v: '30', l: '30 min' }, { v: '60', l: '1 hr' }]}
            compact
          />
          {!chatOpen && (
            <button
              onClick={() => setChatOpen(true)}
              className="flex h-7 items-center gap-1.5 rounded-lg border border-border bg-s1 px-[11px] text-[11.5px] font-semibold hover:border-border2"
            >
              <MessageCircle size={13} /> Discussion
              <span className="flex h-[15px] items-center rounded-[10px] bg-accent px-[5px] text-[9px] text-on-accent">4</span>
            </button>
          )}
        </div>

        {/* participants */}
        <div className="flex items-center gap-2.5 py-[11px]">
          <span className="text-[11px] text-dim">Participants</span>
          <AvatarRow people={avs(participantIds)} size={22} max={8} overlap={5} />
          <span className="ml-1.5 text-[11px] text-dim">8 of 8 responded</span>
        </div>

        {/* grid */}
        <div className="scroll-slim flex-1 overflow-auto rounded-[10px] border border-border">
          <div className="grid min-w-[520px]" style={{ gridTemplateColumns: `54px repeat(${gridDays.length}, 1fr)` }}>
            {/* header row */}
            <div className="sticky top-0 z-20 border-b border-r border-border bg-s0" />
            {gridDays.map((d) => (
              <div
                key={d.key}
                className="sticky top-0 z-10 border-b border-r border-border px-1.5 py-2 text-center"
                style={{
                  background: d.best ? 'var(--teal-bg)' : 'var(--s0)',
                  borderBottomColor: d.best ? 'var(--teal-border)' : 'var(--border)',
                }}
              >
                <div className="text-[10px] text-dim">{d.dow}</div>
                <div className="text-[12.5px] font-semibold" style={{ color: d.best ? 'var(--teal-text)' : 'var(--text)' }}>
                  {d.date}
                </div>
                {d.best && (
                  <span className="mt-[3px] inline-block rounded-[5px] border border-teal-border bg-teal-bg px-[5px] py-px text-[8.5px] font-semibold text-teal-text">
                    Best day
                  </span>
                )}
              </div>
            ))}

            {/* body */}
            {gridTimes.map((time, ti) => (
              <div key={time} className="contents">
                <div className="border-b border-r border-border bg-s0 p-1.5 text-right text-[10.5px] font-medium text-dim">
                  {time}
                </div>
                {gridDays.map((d) => {
                  const ids = avail[d.key][ti]
                  const n = ids.length
                  const mine = ids.includes('JM')
                  let bg: string
                  let shown: string[]
                  let countColor: string
                  if (mode === 'edit') {
                    if (mine) {
                      bg = n <= 2 ? '#F3EAD9' : n <= 4 ? '#EAD9BE' : '#DCC8A2'
                      shown = ['JM']
                      countColor = '#6E5523'
                    } else {
                      bg = heat(n)
                      shown = []
                      countColor = n >= 7 ? '#F4F1EA' : '#46604F'
                    }
                  } else {
                    bg = heat(n)
                    shown = ids
                    countColor = n === 0 ? 'var(--faint)' : n >= 7 ? '#F4F1EA' : '#46604F'
                  }
                  return (
                    <div
                      key={d.key}
                      onClick={() => toggleCell(d.key, ti)}
                      className={`relative flex min-h-[50px] flex-wrap content-start gap-0.5 border-b border-r border-border p-[5px] ${
                        mode === 'edit' ? 'cursor-pointer' : ''
                      }`}
                      style={{
                        background: bg,
                        boxShadow: d.best ? 'inset 1px 0 0 0 var(--teal-border), inset -1px 0 0 0 var(--teal-border)' : undefined,
                      }}
                      title={n ? `${n} of 8 free` : 'No one free'}
                    >
                      {shown.map((id) => (
                        <Avatar key={id} initials={id} color={av(id).color} size={15} font={7.5} title={av(id).name} />
                      ))}
                      {n > 0 && (
                        <span className="absolute bottom-[3px] right-1 text-[8.5px] font-bold" style={{ color: countColor }}>
                          {n}/8
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>

        {/* selected footer */}
        <div className="mt-0.5 flex flex-wrap items-center gap-2.5 border-t border-border px-0.5 pt-3">
          <span className="text-[11px] text-dim">Selected</span>
          <span className="text-[12.5px] font-semibold">Wed, Jul 2 · 9:00 AM</span>
          <TimezonePill tz={event.timezone} />
          <span className="text-[11px] font-semibold text-teal-text">8 of 8 free</span>
          <div className="ml-auto">
            <AvatarRow people={avs(avail.wed[0])} size={20} max={8} overlap={5} />
          </div>
        </div>
      </div>

      {chatOpen && <ChatPanel onClose={() => setChatOpen(false)} />}
    </div>
  )
}

// ─── inline chat side panel ───
function ChatPanel({ onClose }: { onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const [msgs, setMsgs] = useState<ChatMessage[]>(seedMsgs)
  const [draft, setDraft] = useState('')

  useGSAP(
    () => {
      gsap.fromTo(panel.current, { x: 18, opacity: 0 }, { x: 0, opacity: 1, duration: 0.4, ease: 'power3.out' })
    },
    { scope: panel },
  )

  function send() {
    const text = draft.trim()
    if (!text) return
    setMsgs((m) => [...m, { id: 'JM', name: 'You', time: 'now', text, you: true }])
    setDraft('')
    requestAnimationFrame(() => {
      if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight
    })
  }

  return (
    <div ref={panel} className="flex w-[300px] flex-none flex-col border-l border-border bg-s0">
      <div className="flex items-center justify-between border-b border-border px-3.5 py-[13px]">
        <div className="flex items-center gap-1.5 text-[12.5px] font-semibold">
          <MessageCircle size={14} className="text-accent-text" />
          Event discussion
          <span className="rounded-[10px] border border-accent-border bg-accent-bg px-1.5 py-px text-[9.5px] font-semibold text-accent-text">
            8 members
          </span>
        </div>
        <button onClick={onClose} aria-label="Close chat" className="grid h-[26px] w-[26px] place-items-center rounded-lg text-dim hover:text-text">
          <X size={15} />
        </button>
      </div>

      <div ref={scroller} className="scroll-slim flex flex-1 flex-col gap-3.5 overflow-auto p-3.5">
        {msgs.map((m, i) => (
          <div key={i} className={`flex flex-col gap-1.5 ${m.you ? 'items-end' : 'items-start'}`}>
            <div className="flex items-center gap-1.5 text-[10px] text-dim">
              {!m.you && <Avatar initials={m.id} color={av(m.id).color} size={16} font={7.5} />}
              <span className="font-semibold text-text">{m.name}</span>
              <span>{m.time}</span>
            </div>
            <div
              className="max-w-[86%] rounded-[13px] border px-[11px] py-2 text-[11.5px] leading-[1.45]"
              style={
                m.you
                  ? { background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' }
                  : { background: 'var(--s2)', color: 'var(--text)', borderColor: 'var(--border)' }
              }
            >
              {m.text}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 border-t border-border p-[11px]">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Add a comment…"
          className="h-[34px] flex-1 rounded-[9px] border border-border bg-s1 px-[11px] text-[12px] outline-none placeholder:text-faint focus:border-accent-border"
        />
        <button onClick={send} aria-label="Send" className="grid h-[34px] w-[34px] place-items-center rounded-[9px] bg-accent text-on-accent">
          <Send size={14} />
        </button>
      </div>
    </div>
  )
}

// ─── small controls ───
function Segment({
  value, onChange, options, compact,
}: {
  value: string
  onChange: (v: string) => void
  options: { v: string; l: string }[]
  compact?: boolean
}) {
  return (
    <div className="flex rounded-[9px] bg-s2 p-0.5">
      {options.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          className={`flex h-7 items-center rounded-[7px] font-semibold transition-colors ${compact ? 'px-2.5 text-[11px]' : 'px-3 text-[11.5px]'} ${
            value === o.v ? 'bg-s0 text-text shadow-soft' : 'text-dim hover:text-text'
          }`}
        >
          {o.l}
        </button>
      ))}
    </div>
  )
}

function IconBtn({ children }: { children: React.ReactNode }) {
  return (
    <button className="grid h-7 w-7 place-items-center rounded-[7px] border border-border bg-s1 text-dim hover:text-text">
      {children}
    </button>
  )
}
