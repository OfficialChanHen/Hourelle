'use client'

// The password rule, as a checklist that ticks itself off while you type. Sits in
// the hint slot under a PasswordField wherever a new password is being chosen.

import { Check } from 'lucide-react'
import { passwordChecks } from '@/lib/password'

export function PasswordRules({ value }: { value: string }) {
  return (
    <ul className="mt-1 grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2" aria-label="Password rules">
      {passwordChecks(value).map((c) => (
        <li key={c.label} className={`flex items-center gap-1.5 text-[12px] ${c.ok ? 'text-teal-text' : 'text-faint'}`}>
          <span className="grid h-3.5 w-3.5 flex-none place-items-center">
            {c.ok ? <Check size={12} /> : <span className="h-1 w-1 rounded-full bg-current" />}
          </span>
          {c.label}
        </li>
      ))}
    </ul>
  )
}
