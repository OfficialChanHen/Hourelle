'use client'

// Re-render a component whenever the signed-in account changes.
// The value itself comes from the synchronous cache in lib/session; this hook only
// subscribes to the "it changed" event so headers, menus and profile screens repaint.

import { useEffect, useState } from 'react'
import { ACCOUNT_CHANGED, currentAccount, STUB, type Account } from '@/lib/session'

export function useAccount(): Account {
  // start from the stub so server and first client render agree, then adopt the
  // real account after mount (localStorage and auth only exist in the browser)
  const [account, setAccount] = useState<Account>(STUB)
  useEffect(() => {
    const sync = () => setAccount(currentAccount())
    sync()
    window.addEventListener(ACCOUNT_CHANGED, sync)
    return () => window.removeEventListener(ACCOUNT_CHANGED, sync)
  }, [])
  return account
}
