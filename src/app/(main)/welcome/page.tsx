'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTheme } from 'next-themes'
import { ArrowRight, Calendar, Check } from 'lucide-react'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Switch } from '@/components/ui/Switch'
import { PlanCards } from '@/components/PlanCards'
import { TimezonePill } from '@/components/ui/TimezonePill'
import { useAccount } from '@/hooks/useAccount'
import { updateProfile } from '@/lib/session'
import { restampMe } from '@/lib/events'
import { loadReminderPrefs, saveReminderPrefs } from '@/lib/mail'
import { prefNotify, setPrefNotify, NOTIFY_DEFAULTS, type NotifyPrefs } from '@/lib/prefs'
import { markWelcomed } from '@/lib/plan'

/* The two steps after an account is made: the settings almost everyone touches
   first, with a small preview, then the plans side by side. Both can be changed
   later in Settings; this is only the first pass. The page is prerendered, so the
   address is read with the hook inside a Suspense boundary. */
export default function WelcomePage() {
  return (
    <Suspense fallback={null}>
      <Welcome />
    </Suspense>
  )
}

function Welcome() {
  const router = useRouter()
  const params = useSearchParams()
  const rawNext = params.get('next') ?? ''
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/home'
  const account = useAccount()
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [step, setStep] = useState<1 | 2>(1)
  const [name, setName] = useState('')
  const [notify, setNotify] = useState<NotifyPrefs>(NOTIFY_DEFAULTS)
  const [ready, setReady] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // read after mount so the server render never disagrees with this device
  useEffect(() => {
    const local = prefNotify()
    const t = setTimeout(() => { setNotify(local); setName(account.name); setReady(true) }, 0)
    if (account.signedIn) void loadReminderPrefs(account.id).then((p) => { if (p) setNotify(p) })
    return () => clearTimeout(t)
  }, [account.signedIn, account.id, account.name])

  function changeEmail(on: boolean) {
    const nextPrefs = { ...notify, email: on }
    setNotify(nextPrefs); setPrefNotify({ email: on })
    if (account.signedIn) void saveReminderPrefs(account.id, nextPrefs)
  }

  async function continueToPlans() {
    setSaving(true); setErr(null)
    const clean = name.trim()
    if (clean && clean !== account.name) {
      const e = await updateProfile({ name: clean })
      if (e) { setErr(e); setSaving(false); return }
      restampMe({ name: clean })
    }
    setSaving(false)
    setStep(2)
    window.scrollTo({ top: 0 })
  }
  function finish() {
    markWelcomed()
    router.replace(next)
  }

  const themeValue = theme ?? 'light'
  const dark = resolvedTheme === 'dark'

  return (
    <div className="mx-auto max-w-[860px] px-4 pb-[104px] pt-[34px] sm:px-[26px]">
      <p className="text-[11px] font-semibold uppercase tracking-[.15em] text-faint">Welcome</p>
      <h1 className="mt-2 font-serif font-normal text-[40px] leading-[1.06] tracking-[-0.01em]">
        {step === 1 ? 'Make it yours.' : 'Pick a plan.'}
      </h1>
      <p className="mt-3 max-w-[560px] text-[15px] leading-[1.65] text-dim">
        {step === 1 ? 'Three things people set first. Everything here can be changed in Settings later.' : 'Hosting is free and stays free. Plus is a thank-you with a few extras, and it is not on sale yet.'}
      </p>

      {/* two dots, the way the event lifecycle strip counts */}
      <div className="mt-5 flex items-center gap-2 text-[12px] font-semibold text-faint" aria-label={`Step ${step} of 2`}>
        {[1, 2].map((n) => (
          <span key={n} className="flex items-center gap-2">
            <span className={`grid h-6 w-6 place-items-center rounded-full border text-[11px] ${n < step ? 'border-teal-border bg-teal-bg text-teal-text' : n === step ? 'border-accent bg-accent text-on-accent' : 'border-border2 text-faint'}`}>{n < step ? <Check size={12} /> : n}</span>
            <span className={n === step ? 'text-text' : ''}>{n === 1 ? 'Settings' : 'Plan'}</span>
            {n === 1 && <span className="mx-1 h-px w-8 bg-border2" aria-hidden />}
          </span>
        ))}
      </div>

      {step === 1 ? (
        <div className="mt-7 grid gap-4 md:grid-cols-[1fr_300px]">
          <div className="overflow-hidden rounded-2xl border border-border bg-s1">
            <div className="px-5 py-4">
              <label htmlFor="welcome-name" className="block text-[14px] font-medium">Your name</label>
              <p className="mt-0.5 text-[12.5px] text-dim">How you appear on events and in the chat. First and last is best.</p>
              <input
                id="welcome-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name"
                className="mt-2.5 h-11 w-full max-w-[380px] rounded-[10px] border border-border bg-s0 px-3.5 text-[14px] outline-none focus:border-accent-border"
              />
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-border px-5 py-4">
              <div className="min-w-0">
                <div className="text-[14px] font-medium">Email reminders</div>
                <div className="mt-0.5 truncate text-[12.5px] text-dim">{account.email ? `Sent to ${account.email}, the day before and the day of.` : 'The day before and the day of an event.'}</div>
              </div>
              {ready ? <Switch on={notify.email} onChange={changeEmail} label="Email reminders" /> : <span className="h-6 w-11 animate-pulse rounded-full bg-s2" aria-hidden />}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border px-5 py-4">
              <div className="min-w-0">
                <div className="text-[14px] font-medium">Theme</div>
                <div className="mt-0.5 text-[12.5px] text-dim">System follows your device.</div>
              </div>
              {ready ? (
                <SegmentedControl size="sm" value={themeValue} onChange={setTheme} options={[{ v: 'light', l: 'Light' }, { v: 'dark', l: 'Dark' }, { v: 'system', l: 'System' }]} />
              ) : <span className="h-8 w-[196px] animate-pulse rounded-[9px] bg-s2" aria-hidden />}
            </div>
          </div>

          {/* the preview: an event card the way it will look, in the chosen theme */}
          <div className="flex flex-col gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[.13em] text-faint">Preview</p>
            <div className="rounded-2xl border border-border bg-s0 p-4">
              <div className="overflow-hidden rounded-[13px] border border-border bg-s1 p-3.5">
                <div className="-mx-3.5 -mt-3.5 mb-3 h-[64px]" style={{ background: dark ? 'linear-gradient(135deg, #2A3A31, #1F2A24)' : 'linear-gradient(135deg, #E4EDE7, #CFE0D5)' }} />
                <div className="mb-1.5 flex items-center gap-1.5 text-[12px] font-medium text-dim">
                  <span className="h-2 w-2 rounded-full bg-ochre" /> Planning
                </div>
                <h3 className="text-[15px] font-semibold tracking-[-0.01em]">Dinner with friends</h3>
                <div className="mt-2 flex items-center gap-1.5 text-[13px] text-dim">
                  <Calendar size={14} /> <span>Fri, Oct 3 – Sun, Oct 5</span> <TimezonePill tz="America/Los_Angeles" />
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-accent-bg text-[9px] font-bold text-accent-text">{(name.trim() || account.name || 'You').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}</span>
                  <span className="truncate text-[12.5px] text-dim">Hosted by {name.trim() || account.name || 'you'}</span>
                </div>
              </div>
              <p className="mt-3 text-[12px] leading-[1.5] text-faint">{notify.email ? 'Reminders arrive by email.' : 'No reminders by email.'} {dark ? 'Dark theme.' : 'Light theme.'}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-7">
          <PlanCards onContinueFree={finish} />
        </div>
      )}

      {err && <p role="alert" className="mt-3 text-[12.5px] font-medium text-brick-text">{err}</p>}

      <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
        {step === 1 ? (
          <>
            <button type="button" onClick={finish} className="text-[13px] font-semibold text-dim hover:text-text">Skip for now</button>
            <button type="button" onClick={() => void continueToPlans()} disabled={saving} className="flex h-11 items-center gap-2 rounded-[10px] bg-accent px-5 text-[14px] font-semibold text-on-accent disabled:opacity-60">
              Continue <ArrowRight size={15} />
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={() => setStep(1)} className="text-[13px] font-semibold text-dim hover:text-text">Back</button>
            <button type="button" onClick={finish} className="flex h-11 items-center gap-2 rounded-[10px] border border-border2 bg-s1 px-5 text-[14px] font-semibold hover:bg-s2">
              Done <ArrowRight size={15} />
            </button>
          </>
        )}
      </div>
    </div>
  )
}
