'use client'


/* ── settings: the device, and the account ──
   Two kinds of setting share this page, and the difference matters.

   Device settings (clock style, sounds, which days the grid opens on, the
   appearance) live in localStorage and work with no backend at all. They are read
   after mount, so the server render never disagrees with this particular browser.

   Account settings (which reminder emails you want) live on the profile row,
   because the reminder job runs on a server with no browser session and has to be
   able to read them. The device copy is kept in step so the switches still show the
   right state offline. */

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import Link from 'next/link'
import { Compass, Lightbulb, Sparkles } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Switch } from '@/components/ui/Switch'
import { PLANS } from '@/content/plans'
import { currentPlan } from '@/lib/plan'
import { AppearancePicker } from '@/components/AppearancePicker'
import { BackLink } from '@/components/ui/BackLink'
import { SecurityCard } from './_components/SecurityCard'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { NOTIFY_DEFAULTS, prefH24, setPrefH24, prefNotify, setPrefNotify, prefSound, setPrefSound, prefWholeWeek, setPrefWholeWeek, resetHint, resetHints, resetPrefs, setTourWanted, type NotifyPrefs } from '@/lib/prefs'
import { useAccount } from '@/hooks/useAccount'
import { backendOn } from '@/lib/db'
import { loadReminderPrefs, saveReminderPrefs } from '@/lib/mail'
import { resetProfile } from '@/lib/session'
import { restampMe } from '@/lib/events'
import { RotateCcw } from 'lucide-react'

const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <p className="mb-2 mt-7 text-[11px] font-semibold uppercase tracking-[.13em] text-faint">{children}</p>
)

export default function SettingsPage() {
  const { theme, setTheme } = useTheme()
  // read after mount so the server render never disagrees with this device
  const [h24, setH24] = useState(false)
  const [notify, setNotify] = useState<NotifyPrefs>(NOTIFY_DEFAULTS)
  const [sound, setSound] = useState(true)
  const [wholeWeek, setWholeWeek] = useState(false)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    setH24(prefH24())
    setNotify(prefNotify())
    setSound(prefSound())
    setWholeWeek(prefWholeWeek())
    setReady(true)
  }, [])
  function changeSound(v: boolean) { setSound(v); setPrefSound(v) }
  function changeWholeWeek(v: string) { const on = v === 'week'; setWholeWeek(on); setPrefWholeWeek(on) }
  // logged in, the reminder switches live on the account: that is where the
  // reminder job reads them. The device copy is kept in step for the offline case.
  const account = useAccount()
  useEffect(() => {
    if (!account.signedIn) return
    void loadReminderPrefs(account.id).then((p) => { if (p) { setNotify(p); setPrefNotify(p) } })
  }, [account.signedIn, account.id])

  function changeClock(v: string) {
    const on = v === '24'
    setH24(on)
    setPrefH24(on)
  }
  function changeNotify(patch: Partial<NotifyPrefs>) {
    const next = { ...notify, ...patch }
    setNotify(next)
    setPrefNotify(patch)
    if (account.signedIn) void saveReminderPrefs(account.id, next)
  }

  // everything back to the start: this device's choices, and, logged in, the
  // account's name and colour. Asked twice, since it undoes every choice at once.
  const [resetAsk, setResetAsk] = useState(false)
  const [hintsBack, setHintsBack] = useState(false)
  const router = useRouter()
  const [resetState, setResetState] = useState<'idle' | 'busy' | 'done' | 'failed'>('idle')
  const [resetErr, setResetErr] = useState<string | null>(null)
  async function restoreDefaults() {
    setResetState('busy'); setResetErr(null)
    resetPrefs()
    setTheme('light')
    setH24(false); setSound(true); setWholeWeek(false); setNotify(NOTIFY_DEFAULTS)
    if (account.signedIn) {
      void saveReminderPrefs(account.id, NOTIFY_DEFAULTS)
      const r = await resetProfile()
      if ('error' in r) { setResetState('failed'); setResetErr(r.error); setResetAsk(false); return }
      restampMe({ name: r.name })
    }
    setResetState('done'); setResetAsk(false)
  }

  const notifyRows: { key: keyof NotifyPrefs; label: string; sub: string }[] = [
    { key: 'lockIn', label: 'Lock-in announcements', sub: 'When a host locks in the time and place of an event you are on.' },
    { key: 'eventDay', label: 'Event reminders', sub: 'The day before and the morning of a locked-in plan.' },
    { key: 'deadlines', label: 'Deadline reminders', sub: 'When a vote, plan-by, or RSVP date is about to pass.' },
    { key: 'replies', label: 'Reply activity', sub: 'The first time each person marks their times on an event you host.' },
  ]

  return (
    <div className="mx-auto max-w-[760px] px-4 pb-[104px] pt-[34px] sm:px-[26px]">
      <BackLink href="/profile" label="Profile" />
      <h1 className="font-serif font-normal text-[33.5px] leading-[1.04] tracking-[-0.01em]">Settings</h1>
      <p className="mt-1.5 text-[13.5px] text-dim">Saved on this device.</p>

      <Eyebrow>Appearance</Eyebrow>
      <div className="rounded-2xl border border-border bg-s1 px-5 py-4">
        {/* light, dark, or whatever the device says; the cards below pick the palette */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <div className="text-[14px] font-medium">Theme</div>
            <div className="mt-0.5 text-[12.5px] text-dim">System follows your device.</div>
          </div>
          {!ready && <span className="h-8 w-[196px] animate-pulse rounded-[9px] bg-s2" aria-hidden />}
          {ready && (
            <SegmentedControl
              size="sm"
              value={theme ?? 'light'}
              onChange={setTheme}
              options={[{ v: 'light', l: 'Light' }, { v: 'dark', l: 'Dark' }, { v: 'system', l: 'System' }]}
            />
          )}
        </div>
        <div className="mt-3">
          <AppearancePicker />
        </div>
      </div>

      <Eyebrow>Time</Eyebrow>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-2xl border border-border bg-s1 px-5 py-4">
        <div className="min-w-0">
          <div className="text-[14px] font-medium">Clock style</div>
          <div className="mt-0.5 text-[12.5px] text-dim">How times read on grids and pickers. 12-hour shows 2:30 PM, 24-hour shows 14:30.</div>
        </div>
        {!ready && <span className="h-8 w-[150px] animate-pulse rounded-[9px] bg-s2" aria-hidden />}
        {ready && (
          <SegmentedControl
            size="sm"
            value={h24 ? '24' : '12'}
            onChange={changeClock}
            options={[{ v: '12', l: '12-hour' }, { v: '24', l: '24-hour' }]}
          />
        )}
      </div>

      <Eyebrow>Preferences</Eyebrow>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-2xl border border-border bg-s1 px-5 py-4">
        <div className="min-w-0">
          <div className="text-[14px] font-medium">Availability grid</div>
          <div className="mt-0.5 text-[12.5px] text-dim">An event that starts midweek is squared off with days it never asked about.</div>
        </div>
        {!ready && <span className="h-8 w-[170px] animate-pulse rounded-[9px] bg-s2" aria-hidden />}
        {ready && (
          <SegmentedControl
            size="sm"
            value={wholeWeek ? 'week' : 'event'}
            onChange={changeWholeWeek}
            options={[{ v: 'event', l: 'Event days' }, { v: 'week', l: 'Whole week' }]}
          />
        )}
      </div>

      <Eyebrow>Sounds</Eyebrow>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-2xl border border-border bg-s1 px-5 py-4">
        <div className="min-w-0">
          <div className="text-[14px] font-medium">Alert sounds</div>
          <div className="mt-0.5 text-[12.5px] text-dim">A short tone for a new message, a different one for a notification.</div>
        </div>
        {!ready && <span className="h-6 w-11 animate-pulse rounded-full bg-s2" aria-hidden />}
        {ready && <Switch on={sound} onChange={changeSound} label="Alert sounds" />}
      </div>

      {/* only an account has a password to change or sessions to end */}
      {account.signedIn && (
        <>
          <Eyebrow>Security</Eyebrow>
          <SecurityCard account={account} />
        </>
      )}

      <Eyebrow>Plan</Eyebrow>
      <div className="rounded-2xl border border-border bg-s1 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[14px] font-medium">{PLANS[currentPlan()].name} <span className="rounded-md border border-teal-border bg-teal-bg px-1.5 py-px text-[11px] font-semibold text-teal-text">Your plan</span></div>
            <div className="mt-0.5 text-[12.5px] text-dim">Hosting is free and stays free.</div>
          </div>
          <Link href="/plans" className="flex h-9 flex-none items-center gap-1.5 rounded-[9px] border border-border2 bg-s1 px-3.5 text-[13px] font-semibold hover:bg-s2">
            <Sparkles size={14} className="text-accent-text" /> See Hourelle Plus
          </Link>
        </div>
        {/* what Plus adds, in three lines, so the choice is visible without leaving */}
        <ul className="mt-3 flex flex-col gap-1.5 border-t border-border pt-3 text-[13px] text-dim">
          {PLANS.plus.features.slice(1, 4).map((f) => <li key={f} className="flex gap-2"><Sparkles size={13} className="mt-[3px] flex-none text-accent-text" /> <span>{f}</span></li>)}
        </ul>
      </div>

      <Eyebrow>Reminders</Eyebrow>
      <div className="overflow-hidden rounded-2xl border border-border bg-s1">
        {/* the channel first: reminders arrive by email, to the address on the account.
            Off, the rows beneath stay as they are but nothing is sent. */}
        <div className="flex items-center justify-between gap-4 px-5 py-4">
          <div className="min-w-0">
            <div className="text-[14px] font-medium">Email reminders</div>
            <div className="mt-0.5 truncate text-[12.5px] text-dim">
              {account.signedIn && account.email ? `Sent to ${account.email}` : 'Sent to the address on your account.'}
            </div>
          </div>
          {!ready && <span className="h-6 w-11 animate-pulse rounded-full bg-s2" aria-hidden />}
          {ready && <Switch on={notify.email} onChange={(v) => changeNotify({ email: v })} label="Email reminders" />}
        </div>
        {notifyRows.map((r) => (
          <div key={r.key} className={`flex items-center justify-between gap-4 border-t border-border px-5 py-4 ${ready && !notify.email ? 'opacity-50' : ''}`}>
            <div className="min-w-0">
              <div className="text-[14px] font-medium">{r.label}</div>
              <div className="mt-0.5 text-[12.5px] text-dim">{r.sub}</div>
            </div>
            {!ready && <span className="h-6 w-11 animate-pulse rounded-full bg-s2" aria-hidden />}
            {ready && <Switch on={notify[r.key]} onChange={(v) => changeNotify({ [r.key]: v })} label={r.label} />}
          </div>
        ))}
        {(!backendOn || !account.signedIn) && (
          <p className="border-t border-border bg-s0 px-5 py-3 text-[12.5px] leading-[1.55] text-faint">
            {!backendOn
              ? 'Saved on this device. Emails go out once a backend is set up.'
              : 'Log in and these choices follow your account. Reminders go out by email.'}
          </p>
        )}
      </div>

      <Eyebrow>Learning the app</Eyebrow>
      <div className="overflow-hidden rounded-2xl border border-border bg-s1">
        <div className="flex items-center justify-between gap-4 px-5 py-4">
          <div className="min-w-0">
            <div className="text-[14px] font-medium">The tour</div>
            <div className="mt-0.5 text-[12.5px] text-dim">Four stops on a sample event.</div>
          </div>
          <button
            type="button" onClick={() => { resetHint('tour'); setTourWanted(true); router.push('/events/q3-offsite') }}
            className="flex h-9 flex-none items-center gap-1.5 rounded-[9px] border border-border2 bg-s1 px-3 text-[13px] font-semibold text-dim hover:bg-s2 hover:text-text"
          >
            <Compass size={14} /> Take it again
          </button>
        </div>
        <div className="flex items-center justify-between gap-4 border-t border-border px-5 py-4">
          <div className="min-w-0">
            <div className="text-[14px] font-medium">Hints</div>
            <div className="mt-0.5 text-[12.5px] text-dim">{hintsBack ? 'They will show again.' : 'The one-line notes on the grid, the map and the lock-in.'}</div>
          </div>
          <button
            type="button" onClick={() => { resetHints(); setHintsBack(true) }}
            className="flex h-9 flex-none items-center gap-1.5 rounded-[9px] border border-border2 bg-s1 px-3 text-[13px] font-semibold text-dim hover:bg-s2 hover:text-text"
          >
            <Lightbulb size={14} /> Show them again
          </button>
        </div>
      </div>

      <Eyebrow>Start over</Eyebrow>
      <div className="rounded-2xl border border-border bg-s1 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[14px] font-medium">Restore defaults</div>
            {account.signedIn && <div className="mt-0.5 text-[12.5px] leading-[1.5] text-dim">Includes your name and avatar colour.</div>}
          </div>
          {!resetAsk && (
            <button
              type="button" onClick={() => { setResetAsk(true); setResetState('idle') }}
              className="flex h-9 flex-none items-center gap-1.5 rounded-[9px] border border-border2 bg-s1 px-3 text-[13px] font-semibold text-dim hover:bg-s2 hover:text-text"
            >
              <RotateCcw size={14} /> Restore defaults
            </button>
          )}
        </div>
        {resetAsk && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <span className="mr-auto text-[13px] text-dim">Your events are not touched.</span>
            <button type="button" onClick={() => setResetAsk(false)} className="flex h-9 items-center rounded-[9px] border border-border2 px-3 text-[13px] font-semibold hover:bg-s2">Keep my settings</button>
            <button type="button" onClick={() => void restoreDefaults()} disabled={resetState === 'busy'} className="flex h-9 items-center rounded-[9px] bg-accent px-3.5 text-[13px] font-semibold text-on-accent disabled:opacity-60">
              {resetState === 'busy' ? 'Restoring…' : 'Restore'}
            </button>
          </div>
        )}
        {resetState === 'done' && <p className="mt-2 text-[12.5px] text-teal-text">Back to the defaults.</p>}
        {resetState === 'failed' && <p className="mt-2 text-[12.5px] text-brick-text">The device settings are back, but the account could not be reset{resetErr ? `: ${resetErr}` : '.'}</p>}
      </div>
    </div>
  )
}
