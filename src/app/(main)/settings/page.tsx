'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { AppearancePicker } from '@/components/AppearancePicker'
import { BackLink } from '@/components/ui/BackLink'
import { SecurityCard } from './_components/SecurityCard'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { NOTIFY_DEFAULTS, prefH24, setPrefH24, prefNotify, setPrefNotify, prefSound, setPrefSound, prefWholeWeek, setPrefWholeWeek, resetPrefs, type NotifyPrefs } from '@/lib/prefs'
import { useAccount } from '@/hooks/useAccount'
import { backendOn } from '@/lib/db'
import { loadReminderPrefs, saveReminderPrefs } from '@/lib/mail'
import { resetProfile } from '@/lib/session'
import { restampMe } from '@/lib/events'
import { RotateCcw } from 'lucide-react'

const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <p className="mb-2 mt-7 text-[11px] font-semibold uppercase tracking-[.13em] text-faint">{children}</p>
)

// the plain two-state switch every settings page speaks
function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      // the invisible ::after halo grows the touch target to 44px without changing
      // how the 22×38 switch looks
      className={`relative h-[22px] w-[38px] flex-none rounded-full border transition-colors after:absolute after:-inset-[11px] after:content-[''] ${on ? 'border-accent bg-accent' : 'border-border2 bg-s2'}`}
    >
      <span
        className="absolute top-1/2 h-[16px] w-[16px] -translate-y-1/2 rounded-full bg-s1 shadow-raised transition-all"
        style={{ left: on ? 18 : 2 }}
      />
    </button>
  )
}

export default function SettingsPage() {
  const { theme, setTheme } = useTheme()
  // read after mount so the server render never disagrees with this device
  const [h24, setH24] = useState(false)
  const [notify, setNotify] = useState<NotifyPrefs>({ eventDay: true, deadlines: true, replies: false })
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
    { key: 'eventDay', label: 'Event reminders', sub: 'The day before and the morning of a locked-in plan.' },
    { key: 'deadlines', label: 'Deadline reminders', sub: 'When a vote, plan-by, or RSVP date is about to pass.' },
    { key: 'replies', label: 'Reply activity', sub: 'When someone answers an event you host.' },
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

      <Eyebrow>Reminders</Eyebrow>
      <div className="overflow-hidden rounded-2xl border border-border bg-s1">
        {notifyRows.map((r, i) => (
          <div key={r.key} className={`flex items-center justify-between gap-4 px-5 py-4 ${i > 0 ? 'border-t border-border' : ''}`}>
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
