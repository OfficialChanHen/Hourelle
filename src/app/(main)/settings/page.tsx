'use client'

import { useEffect, useState } from 'react'
import { ThemeToggle } from '@/components/ThemeToggle'
import { AppearancePicker } from '@/components/AppearancePicker'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { prefH24, setPrefH24, prefNotify, setPrefNotify, type NotifyPrefs } from '@/lib/prefs'

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
      className={`relative h-[22px] w-[38px] flex-none rounded-full border transition-colors ${on ? 'border-accent bg-accent' : 'border-border2 bg-s2'}`}
    >
      <span
        className="absolute top-1/2 h-[16px] w-[16px] -translate-y-1/2 rounded-full bg-s1 shadow-soft transition-all"
        style={{ left: on ? 18 : 2 }}
      />
    </button>
  )
}

export default function SettingsPage() {
  // read after mount so the server render never disagrees with this device
  const [h24, setH24] = useState(false)
  const [notify, setNotify] = useState<NotifyPrefs>({ eventDay: true, deadlines: true, replies: false })
  const [ready, setReady] = useState(false)
  useEffect(() => {
    setH24(prefH24())
    setNotify(prefNotify())
    setReady(true)
  }, [])

  function changeClock(v: string) {
    const on = v === '24'
    setH24(on)
    setPrefH24(on)
  }
  function changeNotify(patch: Partial<NotifyPrefs>) {
    setNotify((n) => ({ ...n, ...patch }))
    setPrefNotify(patch)
  }

  const notifyRows: { key: keyof NotifyPrefs; label: string; sub: string }[] = [
    { key: 'eventDay', label: 'Event reminders', sub: 'The day before and the morning of a locked-in plan.' },
    { key: 'deadlines', label: 'Deadline reminders', sub: 'When a vote, plan-by, or RSVP date is about to pass.' },
    { key: 'replies', label: 'Reply activity', sub: 'When someone answers an event you host.' },
  ]

  return (
    <div className="mx-auto max-w-[760px] px-4 pb-[104px] pt-[34px] sm:px-[26px]">
      <h1 className="font-serif text-[33.5px] leading-[1.04] tracking-[-0.01em]">Settings</h1>
      <p className="mt-1.5 text-[13.5px] text-dim">Saved on this device.</p>

      <Eyebrow>Appearance</Eyebrow>
      <div className="rounded-2xl border border-border bg-s1 px-5 py-4">
        {/* the sun/moon flips light and dark; the cards pick which look the app wears */}
        <div className="flex items-center justify-between">
          <span className="text-[14px] font-medium">Theme</span>
          <ThemeToggle />
        </div>
        <div className="mt-3">
          <AppearancePicker />
        </div>
      </div>

      <Eyebrow>Time</Eyebrow>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-2xl border border-border bg-s1 px-5 py-4">
        <div className="min-w-0">
          <div className="text-[14px] font-medium">Clock style</div>
          <div className="mt-0.5 text-[12.5px] text-dim">How times read on grids and pickers.</div>
        </div>
        {ready && (
          <SegmentedControl
            size="sm"
            value={h24 ? '24' : '12'}
            onChange={changeClock}
            options={[{ v: '12', l: '2:30 PM' }, { v: '24', l: '14:30' }]}
          />
        )}
      </div>

      <Eyebrow>Reminders</Eyebrow>
      <div className="overflow-hidden rounded-2xl border border-border bg-s1">
        {notifyRows.map((r, i) => (
          <div key={r.key} className={`flex items-center justify-between gap-4 px-5 py-4 ${i > 0 ? 'border-t border-border' : ''}`}>
            <div className="min-w-0">
              <div className="text-[14px] font-medium">{r.label}</div>
              <div className="mt-0.5 text-[12.5px] text-dim">{r.sub}</div>
            </div>
            {ready && <Switch on={notify[r.key]} onChange={(v) => changeNotify({ [r.key]: v })} label={r.label} />}
          </div>
        ))}
        <p className="border-t border-border bg-s0 px-5 py-3 text-[12.5px] leading-[1.55] text-faint">
          Your choices are saved now. The emails themselves start going out once accounts exist.
        </p>
      </div>
    </div>
  )
}
