'use client'

import { useState } from 'react'
import { Check, ExternalLink, Gift, Loader2, Sparkles } from 'lucide-react'
import { PLANS, type PlanKey } from '@/content/plans'
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
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <SegmentedControl
            size="sm" value={period} onChange={(v) => setPeriod(v as Period)}
            options={[{ v: 'yearly', l: 'Yearly' }, { v: 'monthly', l: 'Monthly' }]}
          />
          <span className="text-[12.5px] text-dim">{period === 'yearly' ? PLANS.plus.yearlyNote : PLANS.plus.monthlyNote}</span>
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
                    <button type="button" onClick={() => void buy()} disabled={busy !== null} className="flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-accent text-[14px] font-semibold text-on-accent disabled:opacity-60">
                      {busy === 'buy' ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} Get Plus
                    </button>
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
    </div>
  )
}
