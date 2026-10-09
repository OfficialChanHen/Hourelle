'use client'

import type { ReactNode } from 'react'
import { Minus, Plus, SlidersHorizontal } from 'lucide-react'
import { Popover, PopoverTitle } from './Popover'
import { Switch } from './Switch'

/* ── one settings panel for every tab ──
   The grid, the place vote, the attendance minimum and a chat poll each had their own
   settings: a labelled pill here, a bare icon there, a square button in the chat,
   uppercase captions over some fields and none over others, checkboxes in one panel
   and switches in the next, three different steppers. They read as four features
   built on four days. This is the one way now:

   - the trigger is the same pill everywhere (icon plus "Settings", or just the icon
     where a card has no room), accent while open
   - the panel is one width, names itself up top (PopoverTitle), and stacks its
     settings with a hairline between each
   - a setting is a sentence-case label with its control under it (SettingField), or
     the label and a switch on one line (SettingToggle); an on/off is always a switch
   - a count is the one stepper (SettingStepper)
   - a line of fine print only where the setting has a consequence worth saying

   Everything applies as it is changed; there is no Save. */

export const SETTINGS_WIDTH = 288

export function SettingsButton({ open, iconOnly, children = 'Settings' }: { open: boolean; iconOnly?: boolean; children?: ReactNode }) {
  return (
    <span className={`flex h-11 items-center justify-center gap-1.5 rounded-full border text-[13px] font-semibold sm:h-8 ${iconOnly ? 'w-11 sm:w-8' : 'px-3.5 sm:px-3'} ${open ? 'border-accent bg-accent-bg text-accent-text' : 'border-border2 bg-s1 text-text hover:bg-s2'}`}>
      <SlidersHorizontal size={14} className="flex-none" />
      {!iconOnly && children}
    </span>
  )
}

/** The trigger and the panel together. `button` swaps the trigger's words (a value
 *  chip like "Need 8"); `iconOnly` keeps it to the icon, and then `label` names it. */
export function SettingsMenu({ title, label, iconOnly, button, className, children }: {
  title: ReactNode
  label?: string
  iconOnly?: boolean
  button?: ReactNode
  className?: string
  children: (close: () => void) => ReactNode
}) {
  return (
    <Popover
      align="end"
      width={SETTINGS_WIDTH}
      className={className}
      label={label}
      trigger={(open) => <SettingsButton open={open} iconOnly={iconOnly}>{button}</SettingsButton>}
    >
      {(close) => (
        <>
          <PopoverTitle>{title}</PopoverTitle>
          <div className="flex flex-col divide-y divide-border">{children(close)}</div>
        </>
      )}
    </Popover>
  )
}

// fine print under a setting: the consequence, never instructions
function Hint({ children }: { children?: ReactNode }) {
  if (!children) return null
  return <p className="mt-1.5 text-[12px] leading-[1.5] text-faint">{children}</p>
}

/** A label, an optional value beside it, and the control under both. */
export function SettingField({ label, value, hint, children }: { label: ReactNode; value?: ReactNode; hint?: ReactNode; children?: ReactNode }) {
  return (
    <div className="px-2.5 py-3">
      <div className="flex min-w-0 items-baseline justify-between gap-3">
        <span className="text-[13px] font-semibold text-text">{label}</span>
        {value != null && <span className="flex-none text-[13px] font-semibold tabular-nums text-accent-text">{value}</span>}
      </div>
      {children && <div className="mt-2">{children}</div>}
      <Hint>{hint}</Hint>
    </div>
  )
}

/** An on/off: the label and a switch on one line. `nested` drops the row's own
 *  padding for a toggle that sits inside a SettingField with its siblings. */
export function SettingToggle({ label, on, onChange, hint, nested }: { label: string; on: boolean; onChange: (v: boolean) => void; hint?: ReactNode; nested?: boolean }) {
  return (
    <div className={nested ? 'py-1.5' : 'px-2.5 py-3'}>
      <div className="flex min-h-6 items-center justify-between gap-3">
        <span className={`text-[13px] text-text ${nested ? 'font-medium' : 'font-semibold'}`}>{label}</span>
        <Switch on={on} onChange={onChange} label={label} />
      </div>
      <Hint>{hint}</Hint>
    </div>
  )
}

/** A count: less, the number, more, as one pill. `of` names the ceiling beside it. */
export function SettingStepper({ value, min = 1, max, onChange, label, of }: {
  value: number
  min?: number
  max: number
  onChange: (n: number) => void
  label: string
  of?: ReactNode
}) {
  const btn = 'grid h-11 w-11 place-items-center text-dim enabled:hover:bg-s2 enabled:hover:text-text disabled:opacity-30 focus-visible:-outline-offset-2 sm:h-8 sm:w-8'
  return (
    <div className="flex items-center gap-2">
      <div role="group" aria-label={label} className="flex items-center overflow-hidden rounded-full border border-border2 bg-s1">
        <button type="button" onClick={() => onChange(value - 1)} disabled={value <= min} aria-label={`Fewer: ${label.toLowerCase()}`} className={btn}><Minus size={14} /></button>
        <span aria-live="polite" className="min-w-[36px] text-center text-[14px] font-semibold tabular-nums">{value}</span>
        <button type="button" onClick={() => onChange(value + 1)} disabled={value >= max} aria-label={`More: ${label.toLowerCase()}`} className={btn}><Plus size={14} /></button>
      </div>
      {of && <span className="text-[12.5px] text-faint">{of}</span>}
    </div>
  )
}
