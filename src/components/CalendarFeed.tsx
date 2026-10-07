'use client'

/* ── add every locked-in plan to my calendar, once ──
   A subscription rather than one entry per plan: the calendar keeps fetching the
   feed, so a plan that locks in later shows up on its own, one that locks again
   moves, and one that reopens or that you can't make leaves. Google refreshes
   subscriptions slowly (hours), Apple and Outlook sooner; a plan's own Add to
   calendar button is still there for a same-day change. */

import { useEffect, useState } from 'react'
import { CalendarCheck, ChevronDown, Copy, RotateCcw } from 'lucide-react'
import { Popover, PopoverItem, PopoverNote, PopoverSep, PopoverTitle } from '@/components/ui/Popover'
import { feedSoon, feedUrl, subscribeLinks } from '@/lib/calendar-feed'
import { backendOn } from '@/lib/db'

// the Plans page's two calendar buttons share one look: on a phone they split the
// row in half under the filters, from a small screen up they sit at the row's end
export const calButtonWrap = 'flex-1 sm:flex-none'
export const calButton = 'flex h-11 w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-border2 bg-s1 px-3 text-[13.5px] font-medium hover:bg-s2 sm:h-9 sm:px-3.5'

export function CalendarFeed() {
  const soon = feedSoon(backendOn)
  return (
    <Popover
      align="end"
      width={260}
      className={calButtonWrap}
      trigger={(open) => (
        <span className={calButton}>
          <CalendarCheck size={15} /> <span className="sm:hidden">Add to calendar</span><span className="hidden sm:inline">Add plans to my calendar</span> <ChevronDown size={13} className={`hidden text-faint transition-transform sm:block ${open ? 'rotate-180' : ''}`} />
        </span>
      )}
    >
      {(close) => soon ? (
        <>
          <PopoverTitle>Coming soon</PopoverTitle>
          <p className="px-2.5 pb-2 text-[12.5px] leading-[1.5] text-dim">Adding every locked-in plan to Google Calendar, Outlook or Apple Calendar at once is almost ready. For now, use Add to calendar on each plan.</p>
        </>
      ) : <FeedMenu close={close} />}
    </Popover>
  )
}

function FeedMenu({ close }: { close: () => void }) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [reset, setReset] = useState(false)
  useEffect(() => {
    let live = true
    void feedUrl().then((r) => { if (!live) return; if ('url' in r) setUrl(r.url); else setError(r.error) })
    return () => { live = false }
  }, [])
  if (error) return <PopoverNote>{error}</PopoverNote>
  if (!url) return <PopoverNote>Getting your link…</PopoverNote>
  const links = subscribeLinks(url)
  const go = (href: string) => { window.open(href, '_blank', 'noopener'); close() }
  return (
    <>
      <PopoverTitle>Every locked-in plan</PopoverTitle>
      <PopoverItem onClick={() => go(links.google)} icon={<CalendarCheck size={15} className="text-accent-text" />}>Google Calendar</PopoverItem>
      <PopoverItem onClick={() => go(links.outlook)} icon={<CalendarCheck size={15} className="text-accent-text" />}>Outlook</PopoverItem>
      <PopoverItem onClick={() => { window.location.href = links.apple; close() }} icon={<CalendarCheck size={15} className="text-accent-text" />}>Apple Calendar</PopoverItem>
      <PopoverItem
        onClick={() => { void navigator.clipboard?.writeText(url).then(() => setCopied(true)) }}
        icon={<Copy size={15} />}
        trailing={copied ? 'Copied' : undefined}
      >
        Copy link
      </PopoverItem>
      <PopoverSep />
      <PopoverItem
        onClick={() => { void feedUrl(true).then((r) => { if ('url' in r) { setUrl(r.url); setReset(true); setCopied(false) } else setError(r.error) }) }}
        icon={<RotateCcw size={15} />}
      >
        Reset link
      </PopoverItem>
      <PopoverNote>{reset ? 'New link made. Calendars using the old one stop updating.' : 'Anyone with the link can see these plans.'}</PopoverNote>
    </>
  )
}
