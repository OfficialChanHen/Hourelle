'use client'

import { useState } from 'react'
import { Check, Clock, ExternalLink, Gift, Loader2, Minus, Sparkles } from 'lucide-react'
import { BILLING_TERMS, CRUCIAL, PLANS, PLUS_ADDS, type Answer, type Row } from '@/content/plans'
import { plusInterested, recordPlusInterest } from '@/lib/plan'
import { canBuy, openBillingPortal, startCheckout, type Period } from '@/lib/billing'
import { useAccount } from '@/hooks/useAccount'
import { usePlan } from '@/hooks/usePlan'

/* Three cards: Free, Plus by the month, Plus by the year. The comparison is on
   the cards rather than in a table under them, which is where somebody deciding
   is actually looking: Free ticks what it has and says plainly what it does not,
   and each Plus card is one line for the whole of Free plus what it adds.

   An account already on Plus sees two cards instead of three, because the choice
   between periods is Stripe's portal to make, not this page's. */

function Mark({ a }: { a: Answer }) {
  if (a === 'soon') return <Clock size={15} className="mt-[3px] flex-none text-ochre-text" aria-label="Not built yet" />
  if (a) return <Check size={15} className="mt-[3px] flex-none text-teal-text" aria-label="Included" />
  return <Minus size={15} className="mt-[3px] flex-none text-faint" aria-label="Not included" />
}

function Lines({ rows, side }: { rows: Row[]; side: 'free' | 'plus' }) {
  return (
    <ul className="mt-5 flex flex-col gap-2.5 border-t border-border pt-4">
      {rows.map((r) => {
        const a = side === 'free' ? r.free : r.plus
        return (
          <li key={r.label} className={`flex gap-2.5 text-[13.5px] leading-[1.5] ${a === false ? 'text-faint' : ''}`}>
            <Mark a={a} />
            <span>
              {r.label}
              {a === 'soon' && <span className="ml-1.5 rounded border border-ochre-border bg-ochre-bg px-1 py-px text-[10.5px] font-semibold text-ochre-text">Soon</span>}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

export function PlanCards({ onContinueFree, onPicked }: {
  // the welcome step passes both: the Free card carries on, and any other choice
  // still counts as a choice, so the step can let go
  onContinueFree?: () => void
  onPicked?: (what: 'free' | 'plus' | 'list') => void
}) {
  const account = useAccount()
  const { plan, source, ready } = usePlan()
  const buyable = canBuy(account.signedIn)
  const [period, setPeriod] = useState<Period>('yearly')
  const [interested, setInterested] = useState<boolean>(() => (typeof window === 'undefined' ? false : plusInterested(account.id)))
  const [busy, setBusy] = useState<'buy' | 'portal' | 'list' | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const onPlus = ready && plan === 'plus'
  const P = PLANS.plus

  async function keepPosted() {
    setBusy('list'); setErr(null)
    await recordPlusInterest(account.id)
    setInterested(true); setBusy(null)
    onPicked?.('list')
  }
  async function buy() {
    setBusy('buy'); setErr(null)
    onPicked?.('plus') // said before leaving: Stripe brings the browser back to Settings, not here
    const e = await startCheckout(period)
    if (e) { setErr(e); setBusy(null) }
  }
  async function manage() {
    setBusy('portal'); setErr(null)
    const e = await openBillingPortal()
    if (e) { setErr(e); setBusy(null) }
  }

  return (
    <div>
      <div className="grid gap-4 md:grid-cols-2">
        {/* ── Free ── */}
        <div className="flex flex-col rounded-2xl border border-border bg-s1 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span className="text-[11px] font-semibold uppercase tracking-[.13em] text-faint">{PLANS.free.name}</span>
              <div className="mt-2 flex flex-wrap items-baseline gap-x-2">
                <span className="font-serif text-[36px] leading-none tracking-[-0.01em]">{PLANS.free.price}</span>
                <span className="text-[13px] text-dim">{PLANS.free.priceNote}</span>
              </div>
              <p className="mt-2 text-[13.5px] leading-[1.55] text-dim">{PLANS.free.tagline}</p>
            </div>
            {ready && plan === 'free' && (
              <span className="flex-none rounded-md border border-teal-border bg-teal-bg px-2 py-0.5 text-[11px] font-semibold text-teal-text">Your plan</span>
            )}
          </div>
          <Lines rows={CRUCIAL} side="free" />
          <div className="mt-auto pt-6">
            {onContinueFree ? (
              <button type="button" onClick={() => { onPicked?.('free'); onContinueFree() }} className="flex h-11 w-full items-center justify-center rounded-[10px] border border-border2 bg-s1 text-[14px] font-semibold hover:bg-s2">
                Continue with Free
              </button>
            ) : (
              <p className="text-center text-[12.5px] text-faint">Hosting stays free, whatever you choose later.</p>
            )}
          </div>
        </div>

        {/* ── Plus, with the two ways to pay split across the top ──
            The lists are identical for monthly and yearly, so a third card would
            have repeated every line to change one number. The card is one offer
            and the split is the choice inside it. */}
        <div className="flex flex-col rounded-2xl border border-accent-border bg-s1 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sparkles size={15} className="flex-none text-accent-text" />
              <span className="text-[11px] font-semibold uppercase tracking-[.13em] text-faint">{P.name}</span>
            </div>
            {onPlus && (
              <span className="flex flex-none items-center gap-1 rounded-md border border-teal-border bg-teal-bg px-2 py-0.5 text-[11px] font-semibold text-teal-text">
                {source === 'comped' && <Gift size={11} />} Your plan
              </span>
            )}
          </div>

          {onPlus ? (
            <div className="mt-2">
              <span className="font-serif text-[36px] leading-none tracking-[-0.01em]">Thank you</span>
              <p className="mt-2 text-[13.5px] leading-[1.55] text-dim">{source === 'comped' ? 'Plus, on the house.' : 'Plus is on.'}</p>
            </div>
          ) : (
            <>
              <p className="mt-2 text-[13.5px] leading-[1.55] text-dim">{P.tagline}</p>
              {/* the two prices, side by side, one of them chosen. Picking here is
                  what the button then buys, so the choice is never made twice. */}
              <div role="radiogroup" aria-label="How to pay" className="mt-4 grid grid-cols-2 gap-2">
                {([['monthly', P.price, P.monthlyNote ?? 'a month'], ['yearly', P.yearly ?? P.price, P.yearlyNote ?? 'a year']] as const).map(([k, price, note]) => {
                  const on = period === k
                  const best = k === 'yearly'
                  return (
                    <button
                      key={k} type="button" role="radio" aria-checked={on} onClick={() => setPeriod(k)}
                      className={`relative rounded-xl border px-3 py-3 text-left transition-colors ${on ? 'border-[1.5px] border-accent bg-accent-bg' : 'border-border bg-s0 hover:border-border2'}`}
                    >
                      {best && (
                        <span className="absolute -top-2 right-2 rounded bg-accent px-1.5 py-px text-[10px] font-semibold text-on-accent">{BILLING_TERMS.recommended}</span>
                      )}
                      <span className="block font-serif text-[27px] leading-none tracking-[-0.01em]">{price}</span>
                      <span className="mt-1 block text-[12.5px] text-dim">{note}</span>
                      <span className={`mt-1 block text-[11px] font-semibold ${best ? 'text-teal-text' : 'text-faint'}`}>{best ? BILLING_TERMS.saving : 'Cancel any time'}</span>
                    </button>
                  )
                })}
              </div>
            </>
          )}

          <ul className="mt-5 border-t border-border pt-4">
            <li className="flex gap-2.5 text-[13.5px] font-semibold leading-[1.5]">
              <Check size={15} className="mt-[3px] flex-none text-teal-text" /> Everything in Free
            </li>
          </ul>
          <Lines rows={PLUS_ADDS} side="plus" />

          <div className="mt-auto pt-6">
            {onPlus ? (
              source === 'comped' ? (
                <p className="text-center text-[12.5px] leading-[1.5] text-teal-text">Nothing to pay.</p>
              ) : (
                <button type="button" onClick={() => void manage()} disabled={busy !== null} className="flex h-11 w-full items-center justify-center gap-2 rounded-[10px] border border-border2 bg-s1 text-[14px] font-semibold hover:bg-s2 disabled:opacity-60">
                  {busy === 'portal' ? <Loader2 size={15} className="animate-spin" /> : <ExternalLink size={14} />} Manage billing
                </button>
              )
            ) : buyable ? (
              <>
                <button type="button" onClick={() => void buy()} disabled={busy !== null} className="flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-accent text-[14px] font-semibold text-on-accent disabled:opacity-60">
                  {busy === 'buy' ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} Get Plus {period === 'yearly' ? 'yearly' : 'monthly'}
                </button>
                {/* said before the button is pressed, not after */}
                <p className="mt-2 text-[12px] leading-[1.5] text-faint">{BILLING_TERMS.renews} {BILLING_TERMS.cancel}</p>
              </>
            ) : (
              <button
                type="button" onClick={() => void keepPosted()} disabled={interested || busy !== null}
                className={`flex h-11 w-full items-center justify-center gap-2 rounded-[10px] text-[14px] font-semibold ${interested ? 'border border-teal-border bg-teal-bg text-teal-text' : 'bg-accent text-on-accent'} disabled:opacity-100`}
              >
                {interested ? <><Check size={15} /> You are on the list</> : 'Tell me when it is ready'}
              </button>
            )}
          </div>
        </div>
      </div>
      {err && <p role="alert" className="mt-3 text-[12.5px] font-medium text-brick-text">{err}</p>}
    </div>
  )
}
