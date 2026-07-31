'use client'

import { useEffect, useRef, useState } from 'react'
import { CalendarPlus, ChevronDown } from 'lucide-react'
import { fmtMinute, type AppEvent } from '@/lib/events'

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
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('pointerdown', onDown); window.removeEventListener('keydown', onKey) }
  }, [open])

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
      const d = timed.dayKey.replace(/-/g, '')
      g.set('dates', `${d}T${hm(timed.startMin)}/${d}T${hm(timed.endMin)}`)
      o.set('startdt', `${timed.dayKey}T${hmc(timed.startMin)}`)
      o.set('enddt', `${timed.dayKey}T${hmc(timed.endMin)}`)
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
  function exportTo(kind: 'google' | 'outlook') {
    window.open(links()[kind], '_blank', 'noopener')
    setOpen(false)
  }

  if (!canExport) return null
  return (
    <div ref={wrap} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`flex h-11 sm:h-8 items-center gap-1.5 rounded-lg border bg-s1 px-[11px] text-[13px] font-medium hover:border-border2 ${open ? 'border-border2' : 'border-border'}`}
      >
        <CalendarPlus size={15} /> Add to calendar <ChevronDown size={13} className={`text-faint transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className={`absolute top-full z-30 mt-1 w-[228px] rounded-[10px] border border-border bg-s1 p-1 shadow-soft ${align === 'end' ? 'right-0' : 'left-0'}`}>
          <p className="px-2.5 pb-1.5 pt-2 text-[12px] leading-[1.45] text-faint">
            {timed && slotAllDay
              ? <>Adds it as an all-day entry.</>
              : timed
                ? <>Adds {fmtMinute(timed.startMin)} – {fmtMinute(timed.endMin)} ({event.timezone.split('/').pop()?.replace(/_/g, ' ')} time).</>
                : <>No time locked in yet, so this adds the whole date window as an all-day entry.</>}
          </p>
          <button type="button" onClick={() => exportTo('google')} className="flex w-full items-center gap-2 rounded-[7px] px-2.5 py-2 text-left text-[13.5px] font-medium hover:bg-s2">
            <CalendarPlus size={15} className="text-accent-text" /> Google Calendar
          </button>
          <button type="button" onClick={() => exportTo('outlook')} className="flex w-full items-center gap-2 rounded-[7px] px-2.5 py-2 text-left text-[13.5px] font-medium hover:bg-s2">
            <CalendarPlus size={15} className="text-accent-text" /> Outlook
          </button>
        </div>
      )}
    </div>
  )
}
