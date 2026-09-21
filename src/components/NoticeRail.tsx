'use client'

/* ── the one slot for notices that stay ──
   A refused write and a browser out of room both want the bottom of the page,
   above the phone tab bar, and both can be true at once: a browser fills up, and
   the next push is refused. Drawn separately they landed on top of each other, so
   they share this rail and stack. Each notice draws only its card. */

import { SyncNotice } from './SyncNotice'
import { StorageNotice } from './StorageNotice'

export function NoticeRail() {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[84px] z-50 flex flex-col items-center gap-2 px-4 md:bottom-6">
      <StorageNotice />
      <SyncNotice />
    </div>
  )
}
