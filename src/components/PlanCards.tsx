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

type Card = { key: 'free' | 'monthly' | 'yearly' | 'plus'; name: string; price: string; note: string; tagline: string; plus: boolean }

export function PlanCards({ onContinueFree, onPicked }: {
  // the welcome step passes both: the Free card carries on, and any other choice
  // still counts as a choice, so the step can let go
  onContinueFree?: () => void
  onPicked?: (what: 'free' | 'plus' | 'list') => void
}) {
  const account = useAccount()
  const { plan, source, ready } = usePlan()
  const buyable = canBuy(account.signedIn)
  const [interested, setInterested] = useState<boolean>(() => (typeof window === 'undefined' ? false : plusInterested(account.id)))
  const [busy, setBusy] = useState<Period | 'portal' | 'list' | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const onPlus = ready && plan === 'plus'

  async function keepPosted() {
    setBusy('list'); setErr(null)
    await recordPlusInterest(account.id)
    setInterested(true); setBusy(null)
    onPicked?.('list')
  }
  async function buy(period: Period) {
    setBusy(period); setErr(null)
    onPicked?.('plus') // said before leaving: Stripe brings the browser back to Settings, not here
    const e = await startCheckout(period)
    if (e) { setErr(e); setBusy(null) }
  }
  async function manage() {
    setBusy('portal'); setErr(null)
    const e = await openBillingPortal()
    if (e) { setErr(e); setBusy(null) }
  }

  const P = PLANS.plus
  const cards: Card[] = [
    { key: 'free', name: PLANS.free.name, price: PLANS.free.price, note: PLANS.free.priceNote, tagline: PLANS.free.tagline, plus: false },
    ...(onPlus
      ? [{ key: 'plus' as const, name: P.name, price: P.price, note: P.monthlyNote ?? P.priceNote, tagline: P.tagline, plus: true }]
      : [
          { key: 'monthly' as const, name: `${P.name} monthly`, price: P.price, note: P.monthlyNote ?? 'a month', tagline: P.tagline, plus: true },
          { key: 'yearly' as const, name: `${P.name} yearly`, price: P.yearly ?? P.price, note: P.yearlyNote ?? 'a year', tagline: P.tagline, plus: true },
        ]),
  ]

  return (
    <div>
      <div className={`grid gap-4 ${cards.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
        {cards.map((c) => {
          const best = c.key === 'yearly'
          return (
            <div key={c.key} className={`relative flex flex-col rounded-2xl border bg-s1 p-5 sm:p-6 ${best ? 'border-[1.5px] border-accent' : c.plus ? 'border-accent-border' : 'border-border'}`}>
              {/* the recommendation sits on the card it recommends, so it cannot be read
                  as pointing at the other one */}
              {best && !onPlus && (
                <span className="absolute -top-2.5 left-5 rounded-md bg-accent px-2 py-0.5 text-[11px] font-semibold text-on-accent sm:left-6">{BILLING_TERMS.recommended}</span>
              )}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {c.plus && <Sparkles size={15} className="flex-none text-accent-text" />}
                    <span className="text-[11px] font-semibold uppercase tracking-[.13em] text-faint">{c.name}</span>
                  </div>
                  {/* price and unit on one line, and the unit is two words, so nothing wraps */}
                  <div className="mt-2 flex flex-wrap items-baseline gap-x-2">
                    <span className="font-serif text-[36px] leading-none tracking-[-0.01em]">{c.price}</span>
                    <span className="text-[13px] text-dim">{c.note}</span>
                  </div>
                  {best && <div className="mt-1.5 inline-block rounded-md border border-teal-border bg-teal-bg px-1.5 py-0.5 text-[11px] font-semibold text-teal-text">{BILLING_TERMS.saving}</div>}
                  <p className="mt-2 text-[13.5px] leading-[1.55] text-dim">{c.tagline}</p>
                </div>
                {((c.key === 'free' && ready && plan === 'free') || (c.plus && onPlus)) && (
                  <span className="flex flex-none items-center gap-1 rounded-md border border-teal-border bg-teal-bg px-2 py-0.5 text-[11px] font-semibold text-teal-text">
                    {c.plus && source === 'comped' && <Gift size={11} />} Your plan
                  </span>
                )}
              </div>

              {c.plus ? (
                <>
                  <ul className="mt-5 border-t border-border pt-4">
                    <li className="flex gap-2.5 text-[13.5px] font-semibold leading-[1.5]">
                      <Check size={15} className="mt-[3px] flex-none text-teal-text" /> Everything in Free
                    </li>
                  </ul>
                  <Lines rows={PLUS_ADDS} side="plus" />
                </>
              ) : (
                <Lines rows={CRUCIAL} side="free" />
              )}

              <div className="mt-auto pt-6">
                {c.plus ? (
                  onPlus ? (
                    source === 'comped' ? (
                      <p className="text-center text-[12.5px] leading-[1.5] text-teal-text">Plus, on the house. Nothing to pay.</p>
                    ) : (
                      <button type="button" onClick={() => void manage()} disabled={busy !== null} className="flex h-11 w-full items-center justify-center gap-2 rounded-[10px] border border-border2 bg-s1 text-[14px] font-semibold hover:bg-s2 disabled:opacity-60">
                        {busy === 'portal' ? <Loader2 size={15} className="animate-spin" /> : <ExternalLink size={14} />} Manage billing
                      </button>
                    )
                  ) : buyable ? (
                    <>
                      <button
                        type="button" onClick={() => void buy(c.key === 'yearly' ? 'yearly' : 'monthly')} disabled={busy !== null}
                        className={`flex h-11 w-full items-center justify-center gap-2 rounded-[10px] text-[14px] font-semibold disabled:opacity-60 ${best ? 'bg-accent text-on-accent' : 'border border-border2 bg-s1 hover:bg-s2'}`}
                      >
                        {busy === (c.key === 'yearly' ? 'yearly' : 'monthly') ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} className={best ? '' : 'text-accent-text'} />}
                        Get Plus
                      </button>
                      {/* said before the button is pressed, not after */}
                      <p className="mt-2 text-[12px] leading-[1.5] text-faint">{BILLING_TERMS.renews} {BILLING_TERMS.cancel}</p>
                    </>
                  ) : (
                    <button
                      type="button" onClick={() => void keepPosted()} disabled={interested || busy !== null}
                      className={`flex h-11 w-full items-center justify-center gap-2 rounded-[10px] text-[14px] font-semibold ${interested ? 'border border-teal-border bg-teal-bg text-teal-text' : best ? 'bg-accent text-on-accent' : 'border border-border2 bg-s1 hover:bg-s2'} disabled:opacity-100`}
                    >
                      {interested ? <><Check size={15} /> You are on the list</> : 'Tell me when it is ready'}
                    </button>
                  )
                ) : onContinueFree ? (
                  <button type="button" onClick={() => { onPicked?.('free'); onContinueFree() }} className="flex h-11 w-full items-center justify-center rounded-[10px] border border-border2 bg-s1 text-[14px] font-semibold hover:bg-s2">
                    Continue with Free
                  </button>
                ) : (
                  <p className="text-center text-[12.5px] text-faint">Hosting stays free, whatever you choose later.</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
      {err && <p role="alert" className="mt-3 text-[12.5px] font-medium text-brick-text">{err}</p>}
      <p className="mt-3 text-[12px] leading-[1.55] text-faint">
        Nothing in Free has ever moved to Plus, and nothing will. Guests never pay and never need an account.
      </p>
    </div>
  )
}
