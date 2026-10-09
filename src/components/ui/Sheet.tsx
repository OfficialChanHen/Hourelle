'use client'

import { useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { Popover } from './Popover'
import { layerOf } from '@/lib/layers'
import { reducedMotion } from '@/lib/prefs'

/* The phone's sheet: a panel from the bottom edge, over the tab bar like any modal
   (lib/layers), at most most of the screen tall and scrolling inside past that.
   Radix Dialog carries the modal parts: focus moves in and comes back to the button,
   the page behind is locked and hidden from screen readers, Escape and a tap on the
   dimmed page close it. A downward drag on the top of the sheet closes it too, the
   way a phone's own sheets go. GSAP slides it in and out.

   `title` heads it (rich content is fine: a plan's picture and name), `children` is
   the body and `footer` an optional bar under it; both are handed `close`. */
export function Sheet({ trigger, label, triggerClassName, title, children, footer }: {
  trigger: (open: boolean) => ReactNode
  label?: string
  triggerClassName?: string
  title: ReactNode
  children: (close: () => void) => ReactNode
  footer?: (close: () => void) => ReactNode
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
        <button ref={trig} type="button" aria-label={label} className={triggerClassName}>{trigger(open)}</button>
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
              <Dialog.Title asChild><div className="min-w-0 flex-1 text-[15px] font-semibold text-text">{title}</div></Dialog.Title>
              <Dialog.Close asChild>
                <button type="button" aria-label="Close" className="grid h-11 w-11 flex-none place-items-center rounded-full text-dim hover:bg-s2 hover:text-text"><X size={18} /></button>
              </Dialog.Close>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2.5">
            {/* close reads its refs only when called, from a control in here */}
            {/* eslint-disable-next-line react-hooks/refs */}
            {children(close)}
          </div>
          {/* eslint-disable-next-line react-hooks/refs */}
          {footer && <div className="flex-none border-t border-border px-5 py-3">{footer(close)}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

const PHONE = '(max-width: 639px)'
const subscribePhone = (cb: () => void) => {
  const mq = window.matchMedia(PHONE)
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}
/** Under 640px: a phone, where a menu opens as a sheet from the bottom. */
export function usePhone() {
  return useSyncExternalStore(subscribePhone, () => window.matchMedia(PHONE).matches, () => false)
}

/** A short menu: a sheet on a phone, a dropdown from its button on anything wider.
 *  `title` heads either one; the items are handed `close`. */
export function MenuSheet({ trigger, label, triggerClassName, title, width = 240, children }: {
  trigger: (open: boolean) => ReactNode
  label: string
  triggerClassName?: string
  title: ReactNode
  width?: number
  children: (close: () => void) => ReactNode
}) {
  const phone = usePhone()
  if (phone) {
    return (
      <Sheet trigger={trigger} label={label} triggerClassName={triggerClassName} title={title}>
        {(close) => <div className="flex flex-col py-1.5">{children(close)}</div>}
      </Sheet>
    )
  }
  return (
    <Popover align="end" width={width} label={label} className={triggerClassName} trigger={trigger}>
      {(close) => (
        <>
          <div className="mb-1 border-b border-border px-2.5 pb-2 pt-1.5">{title}</div>
          {children(close)}
        </>
      )}
    </Popover>
  )
}
