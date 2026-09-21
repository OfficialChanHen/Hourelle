'use client'

/* ── out of room in this browser ──
   The moment a write fails for want of space, this says so. It has to, because
   everything above it is built on the opposite assumption: the app writes to the
   browser first and draws from it, so a failed write leaves an answer on screen
   that is already gone.

   What it says depends on whether there is a cloud behind it. Signed in, the change
   did reach everyone else and only this browser will forget it, which is annoying
   rather than serious. With nothing configured, the browser is the only copy and
   the change is simply lost, which is worth stopping to read.

   Either way the advice is the same, because the cause almost always is: photographs.
   A cover picked before covers moved to Storage is still sitting in here, and opening
   that event's cover settings moves it out. */

import { useEffect, useState } from 'react'
import { HardDrive, X } from 'lucide-react'
import { STORAGE_FULL } from '@/lib/local'
import { backendOn } from '@/lib/db'

export function StorageNotice() {
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const onFull = () => setShown(true)
    window.addEventListener(STORAGE_FULL, onFull)
    return () => window.removeEventListener(STORAGE_FULL, onFull)
  }, [])

  if (!shown) return null

  return (
    // the tint is translucent in dark, so it sits on paper: a floating card must not
    // let the page show through it
    <div className="pointer-events-auto max-w-[460px] rounded-2xl bg-s1 shadow-soft">
      <div className="flex items-start gap-2.5 rounded-2xl border border-ochre-border bg-ochre-bg px-4 py-3">
        <HardDrive size={15} className="mt-0.5 flex-none text-ochre-text" />
        <div className="min-w-0">
          <p className="text-[13px] font-semibold leading-[1.5] text-ochre-text">This browser has run out of room.</p>
          <p className="mt-0.5 text-[12.5px] leading-[1.55] text-ochre-text">
            {backendOn
              ? 'Your change is on its way to everyone else, but this browser will forget it when the page reloads. Opening the cover settings on an event with a photo moves that photo out of here and frees the most space.'
              : 'That change was not saved. Removing a photo cover from an event frees the most space, or sign in so your plans are kept in the cloud instead.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShown(false)}
          aria-label="Dismiss"
          className="-mr-1 -mt-1 grid h-8 w-8 flex-none place-items-center rounded-lg text-ochre-text hover:bg-ochre-border/40"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  )
}
