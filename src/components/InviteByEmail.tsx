'use client'

import { useMemo, useState } from 'react'
import { Check, Info, Loader2, Mail, Send, X } from 'lucide-react'
import { addEmailInvitees, getEvent, type AppEvent } from '@/lib/events'
import { sendInvites } from '@/lib/mail'

function FieldError({ children }: { children: React.ReactNode }) {
  return <p className="mt-1.5 flex items-center gap-1 text-[12.5px] font-medium text-brick-text"><Info size={12} /> {children}</p>
}

/* ── invite people by email ──
   Used on the "your event is live" screen and on the event page for people the
   host has not invited yet. Addresses collect as chips; a paste of several, split on commas or spaces, lands
   as several. Each address becomes a guest with a personal link and is emailed it
   by the app. Only render it when the app can send (see canEmail): with email off,
   the copy button is the way to share, and nobody is added by hand. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export function InviteByEmail({ event, onAdded, label = 'Or send it by email' }: { event: AppEvent; onAdded: (ev: AppEvent) => void; label?: string }) {
  const [draft, setDraft] = useState('')
  const [list, setList] = useState<string[]>([])
  const [note, setNote] = useState<string | null>(null)
  const [state, setState] = useState<{ kind: 'idle' | 'sending' | 'sent' | 'failed'; text?: string }>({ kind: 'idle' })
  const onRoster = useMemo(() => new Set(event.participants.map((p) => p.email?.toLowerCase()).filter(Boolean)), [event.participants])

  // take whatever is in the box: one address, or a pasted handful
  function take(raw: string): boolean {
    const parts = raw.split(/[\s,;]+/).map((x) => x.trim().toLowerCase()).filter(Boolean)
    if (!parts.length) return false
    const bad = parts.find((x) => !EMAIL_RE.test(x))
    if (bad) { setNote(`${bad} does not look like an email address.`); return false }
    const dup = parts.find((x) => onRoster.has(x))
    if (dup) { setNote(`${dup} is already invited.`); return false }
    setList((l) => Array.from(new Set([...l, ...parts])))
    setNote(null)
    setState({ kind: 'idle' })
    return true
  }
  function add() { if (take(draft)) setDraft('') }
  const remove = (e: string) => setList((l) => l.filter((x) => x !== e))

  async function send() {
    if (draft.trim() && !take(draft)) return
    const emails = draft.trim() ? Array.from(new Set([...list, ...draft.split(/[\s,;]+/).map((x) => x.trim().toLowerCase()).filter(Boolean)])) : list
    if (!emails.length) return
    setDraft('')
    setState({ kind: 'sending' })
    const added = addEmailInvitees(event.id, emails)
    const fresh = getEvent(event.id)
    if (fresh) onAdded(fresh)
    if (!added.length) { setState({ kind: 'failed', text: 'Everyone on that list is already invited.' }); return }
    const r = await sendInvites(event.id, added.map((p) => p.id))
    if (!r.ok) { setState({ kind: 'failed', text: `${r.error} Their personal links are on the event page.` }); return }
    const went = r.data.sent + r.data.already
    if (went === 0) { setState({ kind: 'failed', text: 'The invites could not be sent. Their personal links are on the event page.' }); return }
    setList([])
    setState({ kind: 'sent', text: `${went} ${went === 1 ? 'invite' : 'invites'} emailed with a personal link.${r.data.failed ? ` ${r.data.failed} could not be sent.` : ''}` })
  }

  const count = list.length + (draft.trim() ? 1 : 0)
  return (
    <div className="mx-auto mt-5 w-full max-w-[420px] text-left">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[.13em] text-faint">{label}</span>
        <span className="h-px flex-1 bg-border" />
      </div>
      <div className="rounded-[13px] border border-border bg-s0 p-2">
        <div className="flex gap-1.5">
          <div className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-[9px] border border-border bg-s1 pl-3 pr-1 focus-within:border-accent-border">
            <Mail size={15} className="flex-none text-dim" />
            <input
              value={draft}
              onChange={(e) => { setDraft(e.target.value); setNote(null) }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add() } }}
              onBlur={() => { if (draft.trim()) add() }}
              onPaste={(e) => { const t = e.clipboardData.getData('text'); if (/[\s,;]/.test(t.trim())) { e.preventDefault(); take(t) } }}
              placeholder="name@example.com"
              inputMode="email"
              autoComplete="email"
              aria-label="Email address"
              className="h-full min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-faint"
            />
            {draft.trim() && (
              <button type="button" onClick={add} className="flex h-7 flex-none items-center rounded-[7px] px-2.5 text-[12.5px] font-semibold text-accent-text hover:bg-accent-bg">Add</button>
            )}
          </div>
          <button
            type="button"
            onClick={() => void send()}
            disabled={count === 0 || state.kind === 'sending'}
            className="flex h-10 flex-none items-center gap-1.5 rounded-[9px] bg-accent px-3.5 text-[13.5px] font-semibold text-on-accent disabled:opacity-40"
          >
            {state.kind === 'sending' ? <Loader2 size={15} className="animate-spin" /> : <Send size={14} />}
            {count > 1 ? `Send ${count}` : 'Send'}
          </button>
        </div>
        {list.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-1 pb-1 pt-2">
            {list.map((e) => (
              <span key={e} className="flex h-[28px] max-w-full items-center gap-1 rounded-full border border-border bg-s1 pl-2.5 pr-1 text-[13px]">
                <span className="truncate">{e}</span>
                <button type="button" onClick={() => remove(e)} aria-label={`Remove ${e}`} className="grid h-5 w-5 place-items-center rounded-full text-faint hover:bg-s2 hover:text-brick-text"><X size={13} /></button>
              </span>
            ))}
          </div>
        )}
      </div>
      {note && <FieldError>{note}</FieldError>}
      {state.text && (
        <p className={`mt-2 flex items-start gap-1.5 text-[12.5px] leading-[1.5] ${state.kind === 'failed' ? 'text-brick-text' : 'text-teal-text'}`}>
          {state.kind === 'sent' ? <Check size={14} className="mt-px flex-none" /> : <Info size={14} className="mt-px flex-none" />} {state.text}
        </p>
      )}
      {!note && !state.text && (
        <p className="mt-2 text-[12.5px] leading-[1.5] text-faint">
          Each person gets their own link, so they arrive already named.
        </p>
      )}
    </div>
  )
}
