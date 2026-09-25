'use client'

// A password input the way people expect one in 2026: a real label, a show/hide
// toggle, a caps-lock warning, and room underneath for a rule that stays visible
// while you type. Placeholders deliberately carry nothing you need to read — they
// disappear on the first keystroke, which is when requirements matter most.
//
// Defined at module scope (not inside a page) so React keeps the same element
// across renders and the field never loses focus mid-word.

import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

export function PasswordField({ id, label, value, onChange, autoComplete, invalid, hint, right }: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  autoComplete: 'current-password' | 'new-password' | 'off'
  invalid?: boolean
  hint?: React.ReactNode
  right?: React.ReactNode // e.g. the "Forgot password?" link, sitting on the label row
}) {
  const [shown, setShown] = useState(false)
  const [caps, setCaps] = useState(false)

  return (
    <>
      <div className="mt-2 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[12.5px] font-semibold text-dim">{label}</label>
        {right}
      </div>
      <div className="relative">
        <input
          id={id}
          type={shown ? 'text' : 'password'}
          value={value}
          autoComplete={autoComplete}
          aria-invalid={invalid || undefined}
          aria-describedby={hint ? `${id}-hint` : undefined}
          onChange={(e) => onChange(e.target.value)}
          onKeyUp={(e) => setCaps(e.getModifierState?.('CapsLock') ?? false)}
          onBlur={() => setCaps(false)}
          className={`h-11 w-full rounded-[10px] border bg-s0 pl-3.5 pr-12 text-[14px] outline-none ${
            invalid ? 'border-brick focus:border-brick' : 'border-border focus:border-accent'
          }`}
        />
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          aria-label={shown ? 'Hide password' : 'Show password'}
          aria-pressed={shown}
          className="absolute right-0 top-0 grid h-11 w-11 place-items-center rounded-r-[10px] text-faint hover:text-dim"
        >
          {shown ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {caps && <p className="text-[12px] text-ochre-text">Caps lock is on.</p>}
      {hint && <div id={`${id}-hint`}>{hint}</div>}
    </>
  )
}
