'use client'

import { useEffect, useState } from 'react'
import { useAccount } from './useAccount'
import { FREE, PLAN_CHANGED, cachedPlan, loadPlan, type PlanState } from '@/lib/plan'

/** The account's plan: what this browser last heard, straight away, then whatever
 *  the profile says. Free for a visitor and a guest, who have no plan at all. */
export function usePlan(): PlanState & { ready: boolean } {
  const account = useAccount()
  const [state, setState] = useState<PlanState>(FREE)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let gone = false
    // after the render, never during it: what this browser remembers first, then
    // whatever the profile says
    const t = setTimeout(() => {
      if (gone) return
      if (!account.signedIn) { setState(FREE); setReady(true); return }
      setState(cachedPlan(account.id))
      void loadPlan(account.id).then((p) => { if (!gone) { setState(p); setReady(true) } })
    }, 0)
    const onChange = () => { if (!gone && account.signedIn) setState(cachedPlan(account.id)) }
    window.addEventListener(PLAN_CHANGED, onChange)
    return () => { gone = true; clearTimeout(t); window.removeEventListener(PLAN_CHANGED, onChange) }
  }, [account.signedIn, account.id])

  return { ...state, ready }
}
