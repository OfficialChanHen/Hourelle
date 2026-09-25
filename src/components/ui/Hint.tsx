'use client'

import { useSyncExternalStore, type ReactNode } from 'react'
import { Info, X } from 'lucide-react'
import { PREFS_CHANGED, dismissHint, hintDismissed } from '@/lib/prefs'

/* One line about how a surface works, shown until dismissed on this browser. It
   arrives when the thing is in front of the person, which is the only moment such
   a line gets read. Settings can bring every hint back. */
const subscribe = (cb: () => void) => {
  window.addEventListener(PREFS_CHANGED, cb)
  return () => window.removeEventListener(PREFS_CHANGED, cb)
}

export function Hint({ name, children, className = '' }: { name: string; children: ReactNode; className?: string }) {
  // dismissed on the server, so the first paint never shows a hint the browser has closed
  const dismissed = useSyncExternalStore(subscribe, () => hintDismissed(name), () => true)
  if (dismissed) return null
  return (
    <div className={`flex items-start gap-2 rounded-[10px] border border-border bg-s2 px-3 py-2 ${className}`}>
      <Info size={14} className="mt-0.5 flex-none text-accent-text" />
      <span className="min-w-0 flex-1 text-[12.5px] leading-[1.5] text-dim">{children}</span>
      <button type="button" onClick={() => dismissHint(name)} aria-label="Got it" className="relative flex-none text-faint hover:text-text before:absolute before:-inset-[5px] before:content-['']"><X size={14} /></button>
    </div>
  )
}
