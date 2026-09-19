// Which plan an account is on, and who wants to hear when Plus goes on sale.
// Everyone is on Free until there is a checkout; the interest note is best effort,
// kept on the device and written to the profile when the 0012 columns exist.

import { supabase, backendOn } from './db'
import type { PlanKey } from '@/content/plans'

const INTEREST_KEY = 'hourelle.plus.interest'
const WELCOMED_KEY = 'hourelle.welcomed'

export function currentPlan(): PlanKey {
  return 'free'
}

export function plusInterested(): boolean {
  try { return localStorage.getItem(INTEREST_KEY) === '1' } catch { return false }
}

export async function recordPlusInterest(): Promise<void> {
  try { localStorage.setItem(INTEREST_KEY, '1') } catch { /* private mode */ }
  if (!backendOn) return
  const { data } = await supabase!.auth.getSession()
  if (!data.session) return
  await supabase!.from('profiles').update({ plan_interest_at: new Date().toISOString() }).eq('id', data.session.user.id)
}

/** The welcome steps are shown once per browser after an account is made. */
export function wasWelcomed(): boolean {
  try { return localStorage.getItem(WELCOMED_KEY) === '1' } catch { return true }
}
export function markWelcomed(): void {
  try { localStorage.setItem(WELCOMED_KEY, '1') } catch { /* private mode */ }
}
