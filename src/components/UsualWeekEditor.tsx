'use client'

/* ── my usual week, painted on the profile page ──
   Two views of one week, under a switch. Hours is the plan grid itself
   (AvailabilityPanel in its `pattern` mode): the same painting, edge handles, presets
   and day and row checkboxes, on a week with no dates, Monday to Sunday, the whole
   day, with only you on it. Whole days are the weekdays you can usually give a whole
   day to, which is all a plan asking for days reads. It saves as you go. Plans fill
   from it only when you ask (see lib/usual-week.ts). */

import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Eraser } from 'lucide-react'
import { TimezonePill } from '@/components/ui/TimezonePill'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { AvailabilityPanel } from '@/app/(main)/events/[id]/_components/AvailabilityPanel'
import { localTimeZone } from '@/lib/calendar-import'
import { updateUsualWeek, type Account } from '@/lib/session'
import { emptyWeek, hasHours, hasWholeDays, moveWeekToZone, weekHasTime, type UsualWeek } from '@/lib/usual-week'
import { initialsOf, type AppEvent, type Iv } from '@/lib/events'

const COLS = [1, 2, 3, 4, 5, 6, 0] // Monday first; the numbers are Date.getDay()
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DOW_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const SAVE_MS = 600
const ME = 'me'
const keyOf = (wd: number) => `wd${wd}`

type View = 'hours' | 'days'

// the grid's row labels, half hours across the whole day: "12 AM", "12:30 AM", ...
const TIMES = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2), m = i % 2 ? ':30' : ''
  return `${h % 12 === 0 ? 12 : h % 12}${m} ${h < 12 ? 'AM' : 'PM'}`
})

/* The week as a plan the grid can draw: seven undated days, one person, you. It is
   never stored as a plan; the grid's writes come back through `pattern.onChange`. */
function asPlan(week: UsualWeek, account: Account): AppEvent {
  const days = COLS.map((wd) => ({ key: keyOf(wd), dow: DOW[wd], date: DOW[wd] }))
  const availIv = Object.fromEntries(COLS.map((wd) => [keyOf(wd), week.days[wd].length ? { [ME]: week.days[wd] } : {}]))
  return {
    id: 'usual-week', title: 'My usual week', hostName: account.name, hostedByYou: false, description: '',
    timezone: week.tz, startDate: '', endDate: '', granularity: '30', budget: '',
    location: { mode: 'later', planMode: 'vote', places: [], platform: '', meetingLink: '' },
    participants: [{ id: ME, name: account.name, initials: initialsOf(account.name), color: account.color, face: account.face, rsvp: 'pending', you: true }],
    days, times: TIMES, avail: {}, availIv, votes: {}, messages: [], createdAt: 0, status: 'planning',
  } as unknown as AppEvent
}

export function UsualWeekEditor({ account }: { account: Account }) {
  const [week, setWeek] = useState<UsualWeek>(() => account.usualWeek ?? emptyWeek(localTimeZone()))
  // the grid holds its own marks while you paint; a change made out here (Clear, Undo,
  // a new timezone, the stored week arriving) hands it a fresh copy
  const [rev, setRev] = useState(0)
  const replace = (next: UsualWeek | ((w: UsualWeek) => UsualWeek)) => { setWeek(next); setRev((r) => r + 1) }
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [cleared, setCleared] = useState<UsualWeek | null>(null)
  const [view, setView] = useState<View>(() => {
    const w = account.usualWeek
    return hasWholeDays(w) && !hasHours(w) ? 'days' : 'hours'
  })
  // a plan asking for days links here with #usual-days; a link can set the address
  // after this first draws, so it is read here and on change
  useEffect(() => {
    const read = () => { if (window.location.hash === '#usual-days') setView('days') }
    read()
    window.addEventListener('hashchange', read)
    return () => window.removeEventListener('hashchange', read)
  }, [])

  // saves a beat after the last change, and only a real change
  const stored = useRef(JSON.stringify(account.usualWeek ?? null))
  useEffect(() => {
    const next = weekHasTime(week) ? week : null
    if (JSON.stringify(next) === stored.current) return
    const t = setTimeout(async () => {
      const e = await updateUsualWeek(next)
      setErr(e)
      if (!e) { stored.current = JSON.stringify(next); setSaved(true) }
    }, SAVE_MS)
    return () => clearTimeout(t)
  }, [week])
  // the stored week can arrive after the first render (the account is read from this
  // browser, or from a log-in, a moment after the page draws) or change in another
  // tab; take it whenever it differs from what was last saved here
  const incoming = JSON.stringify(account.usualWeek ?? null)
  useEffect(() => {
    if (incoming === stored.current) return
    stored.current = incoming
    replace(account.usualWeek ?? emptyWeek(localTimeZone()))
  }, [incoming]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!saved) return
    const t = setTimeout(() => setSaved(false), 1600)
    return () => clearTimeout(t)
  }, [saved])
  useEffect(() => {
    if (!cleared) return
    const t = setTimeout(() => setCleared(null), 6000)
    return () => clearTimeout(t)
  }, [cleared])

  // built once per fresh copy, so painting never rebuilds the grid under your pointer
  const plan = useMemo(() => asPlan(week, account), [rev, account.name, account.color, account.face]) // eslint-disable-line react-hooks/exhaustive-deps
  const pattern = useMemo(() => ({
    onChange: (times: Record<string, Iv[]>) => setWeek((w) => ({ ...w, days: w.days.map((d, wd) => times[keyOf(wd)] ?? d) })),
  }), [])

  function toggleWhole(wd: number) {
    setWeek((w) => ({ ...w, wholeDays: w.wholeDays.map((v, i) => (i === wd ? !v : v)) }))
  }
  // clears the view on screen; Undo puts the whole week back as it was
  function clear() {
    setCleared(week)
    replace((w) => (view === 'hours' ? { ...w, days: emptyWeek(w.tz).days } : { ...w, wholeDays: emptyWeek(w.tz).wholeDays }))
  }

  const here = localTimeZone()
  const moved = view === 'hours' && here !== week.tz && hasHours(week)
  const anyHere = view === 'hours' ? hasHours(week) : hasWholeDays(week)
  const city = (tz: string) => tz.split('/').pop()!.replace(/_/g, ' ')

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <SegmentedControl
          label="Show"
          value={view}
          onChange={(v) => setView(v as View)}
          options={[{ v: 'hours', l: 'Hours' }, { v: 'days', l: 'Whole days' }]}
        />
        <div className="flex items-center gap-3">
          {saved && <span className="flex items-center gap-1 text-[12px] font-medium text-teal-text" role="status"><Check size={13} /> Saved</span>}
          {view === 'hours' && <span className="flex items-center gap-1.5 text-[12.5px] text-dim">Times in <TimezonePill tz={week.tz} /></span>}
        </div>
      </div>
      <p className="mt-3 text-[13.5px] leading-[1.5] text-dim">
        {view === 'hours'
          ? 'Paint the times you are usually free. Plans that ask for times fill from these.'
          : 'Pick the days you can usually give a whole day to. Plans that ask for days fill from these only.'}
      </p>
      {moved && (
        <p className="mt-2 text-[12.5px] text-dim">
          Your week is in {city(week.tz)} time.{' '}
          <button type="button" onClick={() => replace((w) => moveWeekToZone(w, here))} className="font-semibold text-accent-text underline underline-offset-2">
            Use {city(here)} time
          </button>
        </p>
      )}

      <div className="mt-4">
        {view === 'hours' ? (
          <AvailabilityPanel key={rev} event={plan} pattern={pattern} />
        ) : (
          <div className="grid grid-cols-7 rounded-2xl border border-grid-edge" role="group" aria-label="Whole days">
            {COLS.map((wd, c) => {
              const mark = week.wholeDays[wd]
              const weekend = wd === 0 || wd === 6
              return (
                <button
                  key={wd}
                  type="button"
                  onClick={() => toggleWhole(wd)}
                  aria-pressed={mark}
                  aria-label={DOW_LONG[wd]}
                  // the ends take the container's corners, so the outline of a picked
                  // Monday or Sunday follows the rounding instead of being cut by it
                  className={`flex h-24 items-start justify-center pt-3 focus-visible:-outline-offset-2 sm:h-28 ${c === 0 ? 'rounded-l-[19px]' : ''} ${c === 6 ? 'rounded-r-[19px]' : ''} ${c < 6 ? 'border-r border-grid-edge' : ''}`}
                  style={{
                    background: mark ? 'linear-gradient(var(--you-some), var(--you-some)), var(--s1)' : 'var(--s2)',
                    boxShadow: mark ? 'inset 0 0 0 1.5px var(--you-text)' : undefined,
                  }}
                >
                  <span className={`text-[12.5px] font-semibold ${weekend && !mark ? 'text-faint' : 'text-text'}`}>
                    <span className="sm:hidden">{DOW[wd][0]}</span><span className="hidden sm:inline">{DOW[wd]}</span>
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        {anyHere && (
          <button type="button" onClick={clear} className="flex h-11 items-center gap-1.5 rounded-full border border-border2 bg-s1 px-3.5 text-[13px] font-semibold text-dim hover:bg-s2 hover:text-text sm:h-9">
            <Eraser size={14} /> Clear
          </button>
        )}
        {cleared && (
          <span className="text-[12.5px] text-dim" role="status">
            Cleared.{' '}
            <button type="button" onClick={() => { replace(cleared); setCleared(null) }} className="font-semibold text-accent-text underline underline-offset-2">Undo</button>
          </span>
        )}
        {err && <p role="alert" className="text-[12.5px] font-medium text-brick-text">{err}</p>}
      </div>
    </div>
  )
}
