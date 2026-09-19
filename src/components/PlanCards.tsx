'use client'

import { useState } from 'react'
import { Check, Sparkles } from 'lucide-react'
import { PLANS, type PlanKey } from '@/content/plans'
import { currentPlan, plusInterested, recordPlusInterest } from '@/lib/plan'

/* The two plans side by side. On the welcome step the Free card continues; in
   Settings and on the plans page it says which plan the account is on. Plus is not
   on sale yet, so its button collects interest rather than money. */
export function PlanCards({ onContinueFree }: { onContinueFree?: () => void }) {
  const plan = currentPlan()
  const [interested, setInterested] = useState<boolean>(() => (typeof window === 'undefined' ? false : plusInterested()))
  const [saving, setSaving] = useState(false)
  async function keepPosted() {
    setSaving(true)
    await recordPlusInterest()
    setInterested(true); setSaving(false)
  }
  const cards: PlanKey[] = ['free', 'plus']
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {cards.map((k) => {
        const p = PLANS[k]
        const isPlus = k === 'plus'
        const current = plan === k
        return (
          <div key={k} className={`flex flex-col rounded-2xl border bg-s1 p-5 sm:p-6 ${isPlus ? 'border-accent-border' : 'border-border'}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  {isPlus && <Sparkles size={15} className="text-accent-text" />}
                  <span className="text-[11px] font-semibold uppercase tracking-[.13em] text-faint">{p.name}</span>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="font-serif text-[36px] leading-none tracking-[-0.01em]">{p.price}</span>
                  <span className="text-[13px] text-dim">{p.priceNote}</span>
                </div>
                <p className="mt-2 text-[13.5px] leading-[1.55] text-dim">{p.tagline}</p>
              </div>
              {current && <span className="flex-none rounded-md border border-teal-border bg-teal-bg px-2 py-0.5 text-[11px] font-semibold text-teal-text">Your plan</span>}
              {p.soon && <span className="flex-none rounded-md border border-ochre-border bg-ochre-bg px-2 py-0.5 text-[11px] font-semibold text-ochre-text">Coming soon</span>}
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
                <button
                  type="button" onClick={() => void keepPosted()} disabled={interested || saving}
                  className={`flex h-11 w-full items-center justify-center gap-2 rounded-[10px] text-[14px] font-semibold ${interested ? 'border border-teal-border bg-teal-bg text-teal-text' : 'bg-accent text-on-accent'} disabled:opacity-100`}
                >
                  {interested ? <><Check size={15} /> You are on the list</> : 'Tell me when it is ready'}
                </button>
              ) : onContinueFree ? (
                <button type="button" onClick={onContinueFree} className="flex h-11 w-full items-center justify-center rounded-[10px] border border-border2 bg-s1 text-[14px] font-semibold hover:bg-s2">
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
  )
}
