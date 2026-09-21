'use client'

import { useState } from 'react'
import { Check, Clock, ExternalLink, Gift, Loader2, Minus, Sparkles } from 'lucide-react'
import { BILLING_TERMS, COMPARISON, PLANS, type Answer, type PlanKey } from '@/content/plans'
import { plusInterested, recordPlusInterest } from '@/lib/plan'
import { canBuy, openBillingPortal, startCheckout, type Period } from '@/lib/billing'
import { useAccount } from '@/hooks/useAccount'
import { usePlan } from '@/hooks/usePlan'
import { SegmentedControl } from './ui/SegmentedControl'

/* The two plans side by side, on the welcome step, in Settings and on the plans
   page. What the Plus card offers depends on where the deployment has got to:
   with Stripe configured it takes you to checkout, without it, it puts you on the
   list. An account that was given Plus says so and has nothing to pay.

   On the welcome step both cards carry a button, because that step is a choice:
   there is no way past it except by picking one. */
export function PlanCards({ onContinueFree, onPicked, comparison = false }: {
  // the welcome step passes both: the Free card carries on, and any other choice
  // still counts as a choice, so the step can let go
  onContinueFree?: () => void
  onPicked?: (what: 'free' | 'plus' | 'list') => void
  // the line-by-line table, for the page whose job is the comparison
  comparison?: boolean
}) {
  const account = useAccount()
  const { plan, source, ready } = usePlan()
  const buyable = canBuy(account.signedIn)
  const [period, setPeriod] = useState<Period>('yearly')
  const [interested, setInterested] = useState<boolean>(() => (typeof window === 'undefined' ? false : plusInterested(account.id)))
  const [busy, setBusy] = useState<'buy' | 'portal' | 'list' | null>(null)
  const [err, setErr] = useState<string | null>(null)

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
    if (e) { setErr(e); setBusy(null) } // otherwise the browser is leaving for Stripe
  }
  async function manage() {
    setBusy('portal'); setErr(null)
    const e = await openBillingPortal()
    if (e) { setErr(e); setBusy(null) }
  }

  const cards: PlanKey[] = ['free', 'plus']
  return (
    <div>
      {/* the two ways to pay, when there is anywhere to pay. Yearly leads because it
          is the better deal and the one worth defaulting somebody to. */}
      {buyable && plan !== 'plus' && (
        <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
          <SegmentedControl
            size="sm" value={period} onChange={(v) => setPeriod(v as Period)}
            options={[{ v: 'yearly', l: 'Yearly' }, { v: 'monthly', l: 'Monthly' }]}
          />
          {/* the chip names the option it recommends, so it still reads right while
              the other one is selected, and the line beside it says why */}
          <span className="rounded-md border border-accent-border bg-accent-bg px-2 py-0.5 text-[11px] font-semibold text-accent-text">
            {BILLING_TERMS.savingChip}
          </span>
          <span className="text-[12.5px] text-dim">{period === 'yearly' ? BILLING_TERMS.yearlyLine : BILLING_TERMS.monthlyLine}</span>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {cards.map((k) => {
          const p = PLANS[k]
          const isPlus = k === 'plus'
          const current = ready && plan === k
          const price = isPlus ? (period === 'yearly' ? p.yearly : p.price) : p.price
          const note = isPlus ? (period === 'yearly' ? p.yearlyNote : p.monthlyNote) : p.priceNote
          return (
            <div key={k} className={`flex flex-col rounded-2xl border bg-s1 p-5 sm:p-6 ${isPlus ? 'border-accent-border' : 'border-border'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {isPlus && <Sparkles size={15} className="text-accent-text" />}
                    <span className="text-[11px] font-semibold uppercase tracking-[.13em] text-faint">{p.name}</span>
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="font-serif text-[36px] leading-none tracking-[-0.01em]">{price}</span>
                    <span className="text-[13px] text-dim">{note}</span>
                  </div>
                  <p className="mt-2 text-[13.5px] leading-[1.55] text-dim">{p.tagline}</p>
                </div>
                {current && (
                  <span className="flex flex-none items-center gap-1 rounded-md border border-teal-border bg-teal-bg px-2 py-0.5 text-[11px] font-semibold text-teal-text">
                    {isPlus && source === 'comped' && <Gift size={11} />} Your plan
                  </span>
                )}
                {isPlus && !current && !buyable && <span className="flex-none rounded-md border border-ochre-border bg-ochre-bg px-2 py-0.5 text-[11px] font-semibold text-ochre-text">Coming soon</span>}
              </div>

              <ul className="mt-5 flex flex-col gap-2.5 border-t border-border pt-4">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2.5 text-[13.5px] leading-[1.5]">
                    <Check size={15} className={`mt-[3px] flex-none ${isPlus ? 'text-accent-text' : 'text-teal-text'}`} />
                    <span className={f === 'Everything in Free' ? 'font-semibold' : ''}>{f}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-auto pt-6">
                {isPlus ? (
                  current ? (
                    source === 'comped' ? (
                      <p className="text-center text-[12.5px] leading-[1.5] text-teal-text">Plus, on the house. Nothing to pay.</p>
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
                      {/* before the button is pressed, not after: it renews on its own, and
                          stopping it is two clicks in Stripe's own portal */}
                      <p className="mt-2 text-center text-[12px] leading-[1.5] text-faint">{BILLING_TERMS.renews} {BILLING_TERMS.cancel}</p>
                    </>
                  ) : (
                    <button
                      type="button" onClick={() => void keepPosted()} disabled={interested || busy !== null}
                      className={`flex h-11 w-full items-center justify-center gap-2 rounded-[10px] text-[14px] font-semibold ${interested ? 'border border-teal-border bg-teal-bg text-teal-text' : 'bg-accent text-on-accent'} disabled:opacity-100`}
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
      {comparison && <Comparison />}
    </div>
  )
}

/* Line by line, both columns. Three answers, not two: a tick, a dash for what a
   plan does not include, and a clock for the one thing that is not built yet, on
   either side, which is the only honest way to show it. */
function Mark({ a }: { a: Answer }) {
  if (a === 'soon') return <span title="Not built yet" className="inline-flex items-center gap-1 text-[11px] font-semibold text-ochre-text"><Clock size={13} /> Soon</span>
  if (a) return <Check size={16} className="text-teal-text" aria-label="Included" />
  return <Minus size={15} className="text-faint" aria-label="Not included" />
}

function Comparison() {
  return (
    <section className="mt-9">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[.13em] text-faint">Side by side</p>
      <div className="overflow-hidden rounded-2xl border border-border bg-s1">
        {/* the header sticks to the top of the card on a long scroll, so the two
            columns never lose their names */}
        <div className="sticky top-0 z-10 grid grid-cols-[minmax(0,1fr)_64px_64px] items-center gap-2 border-b border-border bg-s1 px-4 py-2.5 sm:grid-cols-[minmax(0,1fr)_92px_92px] sm:px-5">
          <span className="text-[12px] font-semibold text-dim">What you get</span>
          <span className="text-center text-[12px] font-semibold text-dim">Free</span>
          <span className="flex items-center justify-center gap-1 text-center text-[12px] font-semibold text-accent-text"><Sparkles size={12} /> Plus</span>
        </div>
        {COMPARISON.map((g) => (
          <div key={g.group}>
            <div className="border-b border-border bg-s0 px-4 py-2 text-[11px] font-semibold uppercase tracking-[.13em] text-faint sm:px-5">{g.group}</div>
            {g.rows.map((r) => (
              <div key={r.label} className="grid grid-cols-[minmax(0,1fr)_64px_64px] items-center gap-2 border-b border-border px-4 py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_92px_92px] sm:px-5">
                <span className="min-w-0 text-[13.5px] leading-[1.45]">
                  {r.label}
                  {r.note && <span className="mt-0.5 block text-[12px] text-faint">{r.note}</span>}
                </span>
                <span className="flex justify-center"><Mark a={r.free} /></span>
                <span className="flex justify-center"><Mark a={r.plus} /></span>
              </div>
            ))}
          </div>
        ))}
      </div>
      <p className="mt-2.5 text-[12px] leading-[1.55] text-faint">
        Nothing in the Free column has ever moved to Plus, and nothing will. Guests never pay and never need an account.
      </p>
    </section>
  )
}
