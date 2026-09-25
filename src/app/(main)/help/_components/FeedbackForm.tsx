'use client'

// Report a bug, suggest an idea, or ask a question. Posts to /api/feedback, which
// stores the report and emails a copy when an inbox is configured. If nothing is set
// up yet the page says so instead of pretending.

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { Bug, Check, HelpCircle, Lightbulb, Loader2 } from 'lucide-react'
import { useAccount } from '@/hooks/useAccount'

type Kind = 'bug' | 'idea' | 'question'
const KINDS: { key: Kind; label: string; icon: typeof Bug; ask: string }[] = [
  { key: 'bug', label: 'Something broke', icon: Bug, ask: 'What were you doing, and what happened instead?' },
  { key: 'idea', label: 'An idea', icon: Lightbulb, ask: 'What would you like Hourelle to do?' },
  { key: 'question', label: 'A question', icon: HelpCircle, ask: 'What can we help with?' },
]

export function FeedbackForm() {
  const pathname = usePathname()
  const account = useAccount()
  const [kind, setKind] = useState<Kind>('bug')
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [state, setState] = useState<'idle' | 'sent' | 'stored' | 'nowhere' | 'error'>('idle')
  const current = KINDS.find((k) => k.key === kind)!
  // signed in, the account's email is offered for a reply, not assumed: the toggle is
  // on by default and switching it off sends nothing that identifies the account.
  // Signed out, the field below is the only email there is, and it is optional.
  const [includeAccount, setIncludeAccount] = useState(true)
  const identified = account.signedIn && includeAccount
  const from = account.signedIn ? (identified ? account.email ?? '' : '') : email.trim()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!message.trim() || busy) return
    setBusy(true); setState('idle')
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, message: message.trim(), email: from, page: pathname, accountId: identified ? account.id : undefined }),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; emailed?: boolean; stored?: boolean }
      if (res.status === 503) setState('nowhere')
      else if (!res.ok || !data.ok) setState('error')
      else { setState(data.emailed ? 'sent' : 'stored'); setMessage('') }
    } catch {
      setState('error')
    } finally {
      setBusy(false)
    }
  }

  const field = 'w-full rounded-[10px] border border-border bg-s0 px-3.5 text-[14px] outline-none placeholder:text-faint focus:border-accent'

  return (
    <form onSubmit={submit} className="rounded-2xl border border-border bg-s1 p-5">
      <div className="flex flex-wrap gap-1.5">
        {KINDS.map(({ key, label, icon: Icon }) => (
          <button
            key={key} type="button" onClick={() => setKind(key)} aria-pressed={kind === key}
            className={`flex h-9 items-center gap-1.5 rounded-[9px] border px-3 text-[13px] font-semibold ${kind === key ? 'border-accent bg-accent text-on-accent' : 'border-border bg-s1 text-dim hover:bg-s2 hover:text-text'}`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      <label htmlFor="fb-message" className="mt-4 block text-[12.5px] font-semibold text-dim">{current.ask}</label>
      <textarea
        id="fb-message" value={message} onChange={(e) => setMessage(e.target.value)} rows={5} maxLength={4000}
        className={`${field} mt-1.5 resize-y py-2.5 leading-[1.5]`}
      />
      <p className="mt-1 text-[12px] text-faint">The page you were on is included automatically, so you do not need to describe where.</p>

      {account.signedIn && account.email ? (
        <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-[13px] leading-[1.5]">
          <input
            type="checkbox" checked={includeAccount} onChange={(e) => setIncludeAccount(e.target.checked)}
            className="mt-0.5 h-4 w-4 flex-none accent-[var(--accent)]"
          />
          <span>
            <span className="font-semibold">Include my email so you can reply</span>
            <span className="block text-[12px] text-faint">{account.email}. Switch this off to send the report with nothing that identifies your account.</span>
          </span>
        </label>
      ) : (
        <>
          <label htmlFor="fb-email" className="mt-3.5 block text-[12.5px] font-semibold text-dim">Email (Optional)</label>
          <input
            id="fb-email" type="email" autoComplete="email" inputMode="email" value={email}
            onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"
            className={`${field} mt-1.5 h-11`}
          />
          <p className="mt-1 text-[12px] text-faint">Only used to reply to you about this. No account needed to send a report.</p>
        </>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="submit" disabled={!message.trim() || busy}
          className="flex h-11 items-center gap-2 rounded-[10px] bg-accent px-5 text-[14px] font-semibold text-on-accent disabled:opacity-40"
        >
          {busy && <Loader2 size={15} className="animate-spin" />} Send
        </button>
      </div>

      {state === 'sent' && <p role="status" className="mt-4 flex items-center gap-2 rounded-[10px] border border-teal-border bg-teal-bg px-3.5 py-3 text-[13px] text-teal-text"><Check size={15} /> Sent. Thank you, it landed in the inbox.</p>}
      {state === 'stored' && <p role="status" className="mt-4 flex items-center gap-2 rounded-[10px] border border-teal-border bg-teal-bg px-3.5 py-3 text-[13px] text-teal-text"><Check size={15} /> Got it. Thank you.</p>}
      {state === 'nowhere' && (
        <p role="alert" className="mt-4 rounded-[10px] border border-ochre-border bg-ochre-bg px-3.5 py-3 text-[13px] leading-[1.55] text-ochre-text">
          Reports are not wired to an inbox on this copy of Hourelle yet. Please try again later.
        </p>
      )}
      {state === 'error' && <p role="alert" className="mt-4 rounded-[10px] border border-brick-border bg-brick-bg px-3.5 py-3 text-[13px] text-brick-text">That did not go through. Try again in a moment.</p>}
    </form>
  )
}
