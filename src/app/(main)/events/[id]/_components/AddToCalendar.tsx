'use client'

import { CalendarPlus, ChevronDown, Download } from 'lucide-react'
import { Popover, PopoverItem, PopoverTitle } from '@/components/ui/Popover'
import { fmtMinute, type AppEvent } from '@/lib/events'
import { icsFileName, icsFor } from '@/lib/ics'

/* ── add-to-calendar export (Google / Outlook compose links) ──
   Shown once a time is locked in: adds the confirmed slot as a timed entry.
   Without a slot it falls back to the whole date window as an all-day entry. */
function plusDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d + 1)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

export type CalendarSlot = { dayKey: string; endDayKey?: string; startMin: number; endMin: number }

export function AddToCalendar({ event, slot, align = 'end' }: { event: AppEvent; slot: CalendarSlot | null; align?: 'start' | 'end' }) {
  // a timed entry needs a real date; otherwise export the full date range as all-day.
  // A locked all-day slot (day polls) exports as an all-day entry over its run of days.
  const timed = slot && /^\d{4}-\d{2}-\d{2}$/.test(slot.dayKey) ? slot : null
  const slotAllDay = !!timed && timed.startMin === 0 && timed.endMin === 24 * 60
  const canExport = !!timed || /^\d{4}-\d{2}-\d{2}$/.test(event.startDate)
  const location = event.location.mode === 'remote'
    ? (event.location.meetingLink || event.location.platform)
    : event.location.places.map((p) => p.name).join(', ')

  function links(): { google: string; outlook: string } {
    const g = new URLSearchParams({ action: 'TEMPLATE', text: event.title, details: event.description, location, ctz: event.timezone })
    const o = new URLSearchParams({ path: '/calendar/action/compose', rru: 'addevent', subject: event.title, body: event.description, location })
    if (timed && slotAllDay) {
      const end = plusDay(timed.endDayKey ?? timed.dayKey) // end date is exclusive for all-day entries
      g.set('dates', `${timed.dayKey.replace(/-/g, '')}/${end.replace(/-/g, '')}`)
      o.set('startdt', timed.dayKey)
      o.set('enddt', end)
      o.set('allday', 'true')
    } else if (timed) {
      const hm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}${String(min % 60).padStart(2, '0')}00`
      const hmc = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}:00`
      // a timed run starts on its first day and ends on its last
      const endKey = timed.endDayKey ?? timed.dayKey
      const d = timed.dayKey.replace(/-/g, ''), e = endKey.replace(/-/g, '')
      g.set('dates', `${d}T${hm(timed.startMin)}/${e}T${hm(timed.endMin)}`)
      o.set('startdt', `${timed.dayKey}T${hmc(timed.startMin)}`)
      o.set('enddt', `${endKey}T${hmc(timed.endMin)}`)
    } else {
      const end = plusDay(event.endDate || event.startDate) // end date is exclusive for all-day entries
      g.set('dates', `${event.startDate.replace(/-/g, '')}/${end.replace(/-/g, '')}`)
      o.set('startdt', event.startDate)
      o.set('enddt', end)
      o.set('allday', 'true')
    }
    return {
      google: `https://calendar.google.com/calendar/render?${g}`,
      outlook: `https://outlook.live.com/calendar/0/deeplink/compose?${o}`,
    }
  }
  // the same file the emails carry: Apple Calendar, Thunderbird, a work Outlook with
  // no web compose page — anything that opens .ics. Only once a slot is locked in.
  function downloadIcs() {
    const ics = icsFor(event, `${window.location.origin}/events/${event.id}`)
    if (!ics) return
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url; a.download = icsFileName(event)
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  if (!canExport) return null
  return (
    <Popover
      align={align}
      width={228}
      trigger={(open) => (
        <span className={`flex h-11 items-center gap-1.5 rounded-lg border bg-s1 px-[11px] text-[13px] font-medium hover:border-border2 sm:h-8 ${open ? 'border-border2' : 'border-border'}`}>
          <CalendarPlus size={15} /> Add to calendar <ChevronDown size={13} className={`text-faint transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      )}
    >
      {(close) => {
        const exportTo = (kind: 'google' | 'outlook') => {
          window.open(links()[kind], '_blank', 'noopener')
          close()
        }
        return (
          <>
            {/* what gets added lives in the title, not a caption — the items stay bare */}
            <PopoverTitle>
              {timed && slotAllDay
                ? 'Adds an all-day entry'
                : timed
                  ? `Adds ${fmtMinute(timed.startMin)} – ${fmtMinute(timed.endMin)}`
                  : 'Adds the date window, all day'}
            </PopoverTitle>
            <PopoverItem onClick={() => exportTo('google')} icon={<CalendarPlus size={15} className="text-accent-text" />}>Google Calendar</PopoverItem>
            <PopoverItem onClick={() => exportTo('outlook')} icon={<CalendarPlus size={15} className="text-accent-text" />}>Outlook</PopoverItem>
            {event.confirmed && <PopoverItem onClick={() => { downloadIcs(); close() }} icon={<Download size={15} className="text-accent-text" />}>Apple Calendar or a file</PopoverItem>}
          </>
        )
      }}
    </Popover>
  )
}
