'use client'

import { useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Minus, Plus, SlidersHorizontal, X } from 'lucide-react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { Popover, PopoverTitle } from './Popover'
import { Switch } from './Switch'
import { layerOf } from '@/lib/layers'
import { reducedMotion } from '@/lib/prefs'

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
   - on a phone (under 640px) the same settings open as a sheet from the bottom
     instead of a dropdown: a dropdown squeezed onto a small screen flipped and
     clipped, and a sheet is where a thumb already is. It covers the lower part of
     the screen only, so the grid above still shows each change as it lands

   Everything applies as it is changed; there is no Save. The sheet's Done only
   closes it. */

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
  const phone = useSyncExternalStore(subscribePhone, () => window.matchMedia(PHONE).matches, () => false)
  if (phone) {
    return <SettingsSheet title={title} label={label} iconOnly={iconOnly} button={button} className={className}>{children}</SettingsSheet>
  }
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

const PHONE = '(max-width: 639px)'
const subscribePhone = (cb: () => void) => {
  const mq = window.matchMedia(PHONE)
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}

/* The phone's settings: a sheet from the bottom edge, over the tab bar like any
   modal (lib/layers), at most most of the screen tall and scrolling inside past
   that. Radix Dialog carries the modal parts: focus moves in and comes back to the
   button, the page behind is locked and hidden from screen readers, Escape and a
   tap on the dimmed page close it. A downward drag on the top of the sheet closes
   it too, the way a phone's own sheets go. GSAP slides it in and out. */
function SettingsSheet({ title, label, iconOnly, button, className, children }: {
  title: ReactNode
  label?: string
  iconOnly?: boolean
  button?: ReactNode
  className?: string
  children: (close: () => void) => ReactNode
}) {
  const [open, setOpen] = useState(false)
  // over the chat or the places sheet when it opens from inside one
  const [z, setZ] = useState(50)
  const trig = useRef<HTMLButtonElement>(null)
  // the sheet and its shade as state, not refs: Radix mounts them a render after the
  // dialog opens, so the slide in waits for the elements to exist
  const [sheetEl, setSheetEl] = useState<HTMLDivElement | null>(null)
  const [shadeEl, setShadeEl] = useState<HTMLDivElement | null>(null)
  const closing = useRef(false)
  const drag = useRef<{ y: number; dy: number } | null>(null)

  useGSAP(() => {
    if (!sheetEl || !shadeEl || reducedMotion()) return
    gsap.fromTo(shadeEl, { opacity: 0 }, { opacity: 1, duration: 0.25, ease: 'power2.out' })
    gsap.fromTo(sheetEl, { yPercent: 100 }, { yPercent: 0, duration: 0.34, ease: 'power3.out' })
  }, { dependencies: [sheetEl, shadeEl] })

  function close() {
    if (closing.current) return
    closing.current = true
    if (reducedMotion() || !sheetEl || !shadeEl) { setOpen(false); return }
    gsap.to(shadeEl, { opacity: 0, duration: 0.2, ease: 'power2.in' })
    gsap.to(sheetEl, { y: 0, yPercent: 100, duration: 0.24, ease: 'power3.in', onComplete: () => setOpen(false) })
  }

  // the grab: follow the finger down, and let go past a short distance to close
  function onDown(e: React.PointerEvent) {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button')) return
    drag.current = { y: e.clientY, dy: 0 }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  function onMove(e: React.PointerEvent) {
    if (!drag.current || !sheetEl) return
    drag.current.dy = Math.max(0, e.clientY - drag.current.y)
    gsap.set(sheetEl, { y: drag.current.dy })
  }
  function onUp() {
    const d = drag.current
    drag.current = null
    if (!d || !sheetEl) return
    if (d.dy > 80) close()
    else gsap.to(sheetEl, { y: 0, duration: 0.2, ease: 'power2.out' })
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (o) { closing.current = false; setZ(layerOf(trig.current) === 'modal' ? 75 : 50); setOpen(true) }
        else close()
      }}
    >
      <Dialog.Trigger asChild>
        <button ref={trig} type="button" aria-label={label} className={className}>
          <SettingsButton open={open} iconOnly={iconOnly}>{button}</SettingsButton>
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay ref={setShadeEl} className="fixed inset-0 bg-[rgba(0,0,0,.32)]" style={{ zIndex: z }} />
        <Dialog.Content
          ref={setSheetEl}
          aria-modal="true"
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 flex max-h-[85dvh] flex-col rounded-t-2xl border-t border-border bg-s1 shadow-soft outline-none"
          style={{ zIndex: z, paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} className="flex-none touch-none select-none">
            <span aria-hidden className="mx-auto mt-2 block h-1 w-10 rounded-full bg-border2" />
            <div className="flex items-center justify-between gap-3 border-b border-border py-1 pl-5 pr-2">
              <Dialog.Title className="text-[15px] font-semibold text-text">{title}</Dialog.Title>
              <Dialog.Close asChild>
                <button type="button" aria-label="Close" className="grid h-11 w-11 place-items-center rounded-full text-dim hover:bg-s2 hover:text-text"><X size={18} /></button>
              </Dialog.Close>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2.5">
            {/* close reads its refs only when called, from a control in here */}
            {/* eslint-disable-next-line react-hooks/refs */}
            <div className="flex flex-col divide-y divide-border">{children(close)}</div>
          </div>
          <div className="flex-none border-t border-border px-5 py-3">
            <button type="button" onClick={close} className="flex h-11 w-full items-center justify-center rounded-full bg-accent text-[14px] font-semibold text-on-accent">Done</button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
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
