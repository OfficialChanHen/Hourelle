'use client'

/* ── fill my times on every open plan from my calendar ──
   The Plans page's way to answer many plans at once. One button opens a short list of
   the plans still deciding their time; the ones you have not answered are ticked, the
   ones you answered by hand are listed but left off. One press asks the calendar once
   and fills every ticked plan with the same rule the plan page's Import uses: free
   times are added, nothing you marked is removed, busy times are striped. The dialog
   then says what landed on each plan, with one Undo for all of them. */

import { createPortal } from 'react-dom'
import { useEffect, useId, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { CalendarPlus, X } from 'lucide-react'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Popover, PopoverTitle } from '@/components/ui/Popover'
import { calButton, calButtonWrap } from '@/components/CalendarFeed'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { dateRangeText, type AppEvent } from '@/lib/events'
import { applyFill, busyFor, checkedByDefault, fillablePlans, rememberPending, takePending, undoFill, type FillOutcome, type FillProvider } from '@/lib/bulk-calendar'
import { backendOn } from '@/lib/db'
import { importSoon } from '@/lib/calendar-import'
import { connectCalendar, providerToken } from '@/lib/session'
import { reducedMotion } from '@/lib/prefs'

const LABEL: Record<FillProvider, string> = { google: 'Google Calendar', outlook: 'Outlook calendar' }
const LAST = 'hourelle.fill.provider'

function dur(m: number) { return m < 60 ? `${m}m` : m % 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m / 60}h` }

export function FillFromCalendar({ events, onChanged }: { events: AppEvent[]; onChanged: () => void }) {
  const plans = fillablePlans(events)
  const [open, setOpen] = useState(false)
  // back from Google or Microsoft with the permission: open on the fill that sent you
  const [resume, setResume] = useState<{ provider: FillProvider; ids: string[] } | null>(null)
  useEffect(() => {
    const url = new URL(window.location.href)
    if (!url.searchParams.has('fill')) return
    // a tick later, so the state change lands after this render; the marker leaves
    // the address bar only when it is really read, so an effect run twice in
    // development still finds it the second time
    const t = setTimeout(() => {
      url.searchParams.delete('fill')
      window.history.replaceState(window.history.state, '', url.toString())
      const p = takePending()
      if (p) { setResume(p); setOpen(true) }
    }, 0)
    return () => clearTimeout(t)
  }, [])
  if (!plans.length && !open) return null
  // "Coming soon" until the plan page's own Import works: the same switches stand behind both
  if (importSoon(backendOn)) return (
    <Popover
      align="end"
      width={260}
      className={calButtonWrap}
      trigger={() => <span className={calButton}><CalendarPlus size={15} /> Fill my times</span>}
    >
      {() => (
        <>
          <PopoverTitle>Coming soon</PopoverTitle>
          <p className="px-2.5 pb-2 text-[12.5px] leading-[1.5] text-dim">Filling your times on every open plan from Google Calendar or Outlook is almost ready. For now, mark your times on each plan.</p>
        </>
      )}
    </Popover>
  )
  return (
    <div className={calButtonWrap}>
      <button type="button" onClick={() => { setResume(null); setOpen(true) }} className={calButton}>
        <CalendarPlus size={15} /> Fill my times
      </button>
      {open && createPortal(<FillDialog plans={plans} resume={resume} close={() => { setOpen(false); setResume(null) }} onChanged={onChanged} />, document.body)}
    </div>
  )
}

function FillDialog({ plans, resume, close, onChanged }: { plans: AppEvent[]; resume: { provider: FillProvider; ids: string[] } | null; close: () => void; onChanged: () => void }) {
  const root = useRef<HTMLDivElement>(null)
  const card = useRef<HTMLDivElement>(null)
  useGSAP(() => {
    if (reducedMotion()) return
    gsap.timeline()
      .fromTo(root.current, { opacity: 0 }, { opacity: 1, duration: 0.2, ease: 'power2.out' })
      .fromTo(card.current, { y: 12, opacity: 0 }, { y: 0, opacity: 1, duration: 0.3, ease: 'power3.out' }, '<')
  }, { scope: root })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useFocusTrap(root)
  const titleId = useId()

  const [provider, setProvider] = useState<FillProvider>(() => {
    if (resume) return resume.provider
    try { return localStorage.getItem(LAST) === 'outlook' ? 'outlook' : 'google' } catch { return 'google' }
  })
  const [picked, setPicked] = useState<Set<string>>(() => new Set(resume ? resume.ids : plans.filter(checkedByDefault).map((p) => p.id)))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<Extract<FillOutcome, { ok: true }> | null>(null)
  const [undone, setUndone] = useState(false)

  async function run(returned = false) {
    const ids = plans.filter((p) => picked.has(p.id)).map((p) => p.id)
    if (!ids.length) return
    try { localStorage.setItem(LAST, provider) } catch { /* private mode */ }
    setBusy(true); setError(null)
    // with a backend the calendar is real: no token yet means one trip to the provider,
    // which lands back on this page and finishes the same fill
    const remote = provider === 'google' ? 'google' : 'azure'
    const trip = async () => {
      rememberPending(provider, ids)
      const err = await connectCalendar(remote, '/events?fill=1')
      if (err) { setError(err); setBusy(false) }
    }
    const token = backendOn ? await providerToken() : null
    if (backendOn && !token) return trip()
    const chosen = plans.filter((p) => ids.includes(p.id))
    const r = await busyFor(chosen, provider, token)
    if (r.error === 'auth') return trip()
    if (r.error === 'scope') {
      if (!returned) return trip()
      setError(provider === 'google'
        ? 'Google would not share your calendar even after asking. The Calendar API may be off for this app, or the permission was refused.'
        : 'Microsoft would not share your calendar even after asking. The permission may have been refused.')
      setBusy(false)
      return
    }
    if (r.error) { setError(r.error); setBusy(false); return }
    const out = applyFill(ids, r.busy)
    if (out.ok) setDone(out)
    setBusy(false)
    onChanged()
  }
  // the fill that was waiting on the permission trip runs as soon as the dialog opens
  const resumed = useRef(false)
  useEffect(() => {
    if (!resume || resumed.current) return
    resumed.current = true
    void run(true)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (id: string) => setPicked((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })
  const count = plans.filter((p) => picked.has(p.id)).length
  const filled = done?.results.filter((r) => r.addedMin > 0 || r.addedDays > 0) ?? []

  return (
    <div
      ref={root}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 grid place-items-center bg-[rgba(0,0,0,.25)] p-4"
      onPointerDown={(e) => { if (e.target === e.currentTarget) close() }}
    >
      <div ref={card} className="flex max-h-[calc(100dvh-32px)] w-full max-w-[440px] flex-col rounded-2xl border border-border bg-s1 shadow-soft">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-[.13em] text-faint">From your calendar</div>
            <div id={titleId} className="mt-0.5 text-[15.5px] font-semibold">Fill my times</div>
          </div>
          <button onClick={close} aria-label="Close" className="grid h-11 w-11 place-items-center rounded-full text-dim hover:bg-s2 hover:text-text sm:h-8 sm:w-8">
            <X size={16} />
          </button>
        </div>

        {done ? (
          <div className="scroll-slim min-h-0 flex-1 overflow-auto px-5 py-4" role="status">
            {undone ? (
              <p className="text-[14px] text-dim">Put back. Your times are as they were.</p>
            ) : (
              <>
                <p className="text-[14px] font-medium">
                  {filled.length
                    ? `Added free time to ${filled.length} of ${done.results.length} ${done.results.length === 1 ? 'plan' : 'plans'}. Busy times are striped.`
                    : `Nothing new to add from your ${LABEL[provider]}.`}
                </p>
                <ul className="mt-3 divide-y divide-border">
                  {done.results.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3 py-3 text-[13.5px]">
                      <a href={`/events/${r.id}?tab=availability`} className="min-w-0 truncate font-medium hover:underline">{r.title}</a>
                      <span className="flex-none text-dim">
                        {r.dayPoll
                          ? (r.addedDays ? `+${r.addedDays} ${r.addedDays === 1 ? 'day' : 'days'}` : 'Nothing new')
                          : (r.addedMin ? `+${dur(r.addedMin)}` : 'Nothing new')}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        ) : (
          <div className="scroll-slim min-h-0 flex-1 overflow-auto px-5 py-4">
            <SegmentedControl
              value={provider}
              onChange={(v) => setProvider(v as FillProvider)}
              options={[{ v: 'google', l: 'Google' }, { v: 'outlook', l: 'Outlook' }]}
              label="Calendar"
              stretch
            />
            <ul className="mt-4 divide-y divide-border" aria-label="Plans to fill">
              {plans.map((p) => {
                const answered = !checkedByDefault(p)
                return (
                  <li key={p.id}>
                    <label className="flex min-h-11 cursor-pointer items-center gap-3 py-2.5">
                      <input type="checkbox" checked={picked.has(p.id)} onChange={() => toggle(p.id)} className="h-4 w-4 flex-none sm:h-3.5 sm:w-3.5" style={{ accentColor: 'var(--accent)' }} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-medium">{p.title}</span>
                        <span className="block text-[12.5px] text-dim">{dateRangeText(p)}{answered ? ', you answered' : ''}</span>
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
            <p className="mt-3 text-[12.5px] leading-[1.5] text-dim">Adds the free times on your calendar. Nothing you marked is removed.</p>
            {error && <p className="mt-3 rounded-xl border border-brick-border bg-brick-bg px-3 py-2 text-[13px] text-brick-text" role="alert">{error}</p>}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-border px-5 py-3.5">
          {done ? (
            <>
              {!undone && done.undo.length > 0 && (
                <button
                  type="button"
                  onClick={() => { undoFill(done.undo); setUndone(true); onChanged() }}
                  className="flex h-11 items-center rounded-full border border-border2 bg-s1 px-4 text-[14px] font-medium hover:bg-s2 sm:h-9"
                >
                  Undo
                </button>
              )}
              <button type="button" onClick={close} className="flex h-11 items-center rounded-full bg-accent px-4 text-[14px] font-semibold text-on-accent sm:h-9">Done</button>
            </>
          ) : (
            <button
              type="button"
              disabled={!count || busy}
              onClick={() => void run()}
              className="flex h-11 items-center rounded-full bg-accent px-4 text-[14px] font-semibold text-on-accent disabled:opacity-50 sm:h-9"
            >
              {busy ? 'Filling…' : count ? `Fill ${count} ${count === 1 ? 'plan' : 'plans'}` : 'Pick a plan'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
