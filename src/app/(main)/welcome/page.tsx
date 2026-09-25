'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTheme } from 'next-themes'
import { ArrowRight, Calendar, Check } from 'lucide-react'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { AppearancePicker } from '@/components/AppearancePicker'
import { Switch } from '@/components/ui/Switch'
import { PlanCards } from '@/components/PlanCards'
import { TimezonePill } from '@/components/ui/TimezonePill'
import { useAccount } from '@/hooks/useAccount'
import { legalAccepted, recordLegalAcceptance, updateProfile } from '@/lib/session'
import { LegalGate } from '@/components/LegalGate'
import { LEGAL_VERSION } from '@/content/legal'
import { restampMe } from '@/lib/events'
import { loadReminderPrefs, saveReminderPrefs } from '@/lib/mail'
import { prefNotify, setPrefNotify, NOTIFY_DEFAULTS, type NotifyPrefs } from '@/lib/prefs'
import { markWelcomed } from '@/lib/plan'
import { resetAppearance, resetHint, resetHints, setTourWanted } from '@/lib/prefs'
import { ensurePracticeEvent } from '@/lib/practice'

/* The steps after an account is made: the terms first, only when the account never
   accepted them (a Google or Microsoft account made through the log-in button), then
   the settings almost everyone touches first, with a small preview, then the plans
   side by side. Settings and plan can be changed later; the terms cannot be skipped.
   The page is prerendered, so the address is read with the hook inside Suspense. */
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
  type Step = 'terms' | 'settings' | 'plan' | 'tour'
  const [needsTerms, setNeedsTerms] = useState<boolean | null>(null)
  // once the terms step has been shown it stays on the timeline, ticked, so the
  // person can see it was done rather than watching it vanish
  const [termsShown, setTermsShown] = useState(false)
  const [legalOk, setLegalOk] = useState(false)
  const [step, setStep] = useState<Step>('settings')
  const steps: Step[] = needsTerms || termsShown ? ['terms', 'settings', 'plan', 'tour'] : ['settings', 'plan', 'tour']
  const stepIndex = steps.indexOf(step) + 1
  // a new account starts from the house look with the theme following the device,
  // and with every hint and the tour unseen, whatever the last person on this
  // browser chose or dismissed; what they pick on the settings step is theirs
  useEffect(() => {
    if (!account.signedIn) return
    resetAppearance()
    setTheme('system')
    // and the one-line hints are new to them too, not dismissed by whoever was here
    resetHints()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account.signedIn, account.id])
  // does this account have the terms on record? Asked once; the answer decides the
  // first step. Nothing is on screen until it comes back: the page used to open on
  // the settings step, which carries a Skip for now, so a quick hand could leave
  // before the terms step had appeared and never see the documents at all.
  const [checked, setChecked] = useState(false)
  useEffect(() => {
    if (!account.signedIn) return
    let gone = false
    void legalAccepted(account.id).then((ok) => {
      if (gone) return
      setNeedsTerms(!ok)
      if (!ok) { setTermsShown(true); setStep('terms') }
      setChecked(true)
    })
    return () => { gone = true }
  }, [account.signedIn, account.id])
  // a browser with no account never gets an answer, and neither does one whose
  // network is gone; after a moment the steps open rather than waiting for ever
  useEffect(() => {
    const t = setTimeout(() => setChecked(true), 5000)
    return () => clearTimeout(t)
  }, [])
  const waiting = !checked
  function acceptTerms() {
    recordLegalAcceptance(LEGAL_VERSION)
    setNeedsTerms(false)
    setStep('settings')
    window.scrollTo({ top: 0 })
  }
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
    setStep('plan')
    window.scrollTo({ top: 0 })
  }
  function finish() {
    markWelcomed(account.id)
    router.replace(next)
  }
  // the tour runs on the first event page opened: the one they were heading to
  // when that is an event, otherwise a practice event of their own, where
  // everything on the cards can really be tried
  function showAround() {
    // asked for in so many words, so it runs, even on a browser where someone
    // (a deleted account, a previous user) already finished it once
    resetHint('tour')
    setTourWanted(true)
    markWelcomed(account.id)
    router.replace(next.startsWith('/events/') ? next : `/events/${ensurePracticeEvent()}`)
  }

  const themeValue = theme ?? 'light'
  const dark = resolvedTheme === 'dark'

  return (
    <div className="mx-auto max-w-[860px] px-4 pb-[92px] pt-[34px] sm:px-[26px]">
      <p className="text-[11px] font-semibold uppercase tracking-[.15em] text-faint">Welcome</p>
      <h1 className="mt-2 font-serif font-normal text-[40px] leading-[1.06] tracking-[-0.01em]">
        {waiting ? 'One moment.' : step === 'terms' ? 'Before you start.' : step === 'settings' ? 'Make it yours.' : step === 'plan' ? 'Pick a plan.' : 'One more thing.'}
      </h1>
      <p className="mt-3 max-w-[560px] text-[15px] leading-[1.65] text-dim">
        {waiting
          ? 'Setting up your account.'
          : step === 'terms'
          ? 'Two short documents say what Hourelle keeps and how it may be used. Open each one, then tick its box.'
          : step === 'settings' ? 'Three things people set first. Everything here can be changed in Settings later.'
            : step === 'plan' ? 'Hosting is free and stays free. Plus is a thank-you with a few extras, and it is not on sale yet.'
              : 'A short tour walks through an event and lets you try each thing as you go. It runs on a practice event of your own, and you can leave it at any point.'}
      </p>

      {/* the dots, the way the event lifecycle strip counts */}
      {waiting ? (
        <div className="mt-5 flex items-center gap-2" aria-hidden>
          {[0, 1, 2].map((n) => <span key={n} className="h-6 w-[74px] animate-pulse rounded-full bg-s2" />)}
        </div>
      ) : (
      <div className="mt-5 flex flex-wrap items-center gap-2 text-[12px] font-semibold text-faint" aria-label={`Step ${stepIndex} of ${steps.length}`}>
        {steps.map((s, i) => {
          const n = i + 1
          return (
            <span key={s} className="flex items-center gap-2">
              <span className={`grid h-6 w-6 place-items-center rounded-full border text-[11px] ${n < stepIndex ? 'border-teal-border bg-teal-bg text-teal-text' : n === stepIndex ? 'border-accent bg-accent text-on-accent' : 'border-border2 text-faint'}`}>{n < stepIndex ? <Check size={12} /> : n}</span>
              <span className={n === stepIndex ? 'text-text' : ''}>{s === 'terms' ? 'Terms' : s === 'settings' ? 'Settings' : s === 'plan' ? 'Plan' : 'Tour'}</span>
              {n < steps.length && <span className="mx-1 h-px w-8 bg-border2" aria-hidden />}
            </span>
          )
        })}
      </div>
      )}

      {waiting ? (
        <div className="mt-7 max-w-[560px] animate-pulse rounded-2xl border border-border bg-s1 px-5 py-7" aria-hidden>
          <div className="h-4 w-1/3 rounded bg-s2" />
          <div className="mt-3 h-3 w-2/3 rounded bg-s2" />
          <div className="mt-6 h-10 w-full max-w-[380px] rounded-[10px] bg-s2" />
        </div>
      ) : step === 'terms' ? (
        <div className="mt-7 max-w-[560px]">
          <LegalGate onChange={setLegalOk} />
        </div>
      ) : step === 'settings' ? (
        <div className="mt-7 grid gap-4 md:grid-cols-[1fr_300px]">
          <div className="overflow-hidden rounded-2xl border border-border bg-s1">
            <div className="px-5 py-4">
              <label htmlFor="welcome-name" className="block text-[14px] font-medium">Your name</label>
              <p className="mt-0.5 text-[12.5px] text-dim">How you appear on events and in the chat. First and last is best.</p>
              <input
                id="welcome-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name"
                className="mt-2.5 h-11 w-full max-w-[380px] rounded-[10px] border border-border bg-s0 px-3.5 text-[14px] outline-none focus:border-accent"
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
            {/* the four appearances, the same picker Settings has */}
            <div className="border-t border-border px-5 py-4">
              <div className="text-[14px] font-medium">Appearance</div>
              <div className="mt-0.5 text-[12.5px] text-dim">The house warm neutral, or one of three others.</div>
              <div className="mt-3">
                <AppearancePicker />
              </div>
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
      ) : step === 'plan' ? (
        <div className="mt-7">
          <PlanCards
            onContinueFree={() => { setStep('tour'); window.scrollTo({ top: 0 }) }}
            onPicked={(what) => {
              // paying leaves for Stripe and comes back to Settings, so the steps are
              // done with either way; the list is a choice like any other
              if (what === 'plus') markWelcomed(account.id)
              if (what === 'list') { setStep('tour'); window.scrollTo({ top: 0 }) }
            }}
          />
        </div>
      ) : (
        <div className="mt-7 max-w-[560px] rounded-2xl border border-border bg-s1 px-5 py-5">
          <p className="text-[11px] font-semibold uppercase tracking-[.13em] text-faint">What it shows</p>
          <ol className="mt-2 flex flex-col gap-1.5 text-[14px] leading-[1.55] text-dim">
            <li><span className="font-medium text-text">The link.</span> One link, and everyone can answer without an account.</li>
            <li><span className="font-medium text-text">The grid.</span> Drag across the hours you can make.</li>
            <li><span className="font-medium text-text">Location.</span> Places on a ballot, votes, and a route.</li>
            <li><span className="font-medium text-text">Attendance and details.</span> Who is coming, and everything else.</li>
            <li><span className="font-medium text-text">The lock-in.</span> The host sets the plan and everyone gets it.</li>
          </ol>
          <button type="button" onClick={showAround} className="mt-4 flex h-11 items-center gap-2 rounded-[10px] bg-accent px-5 text-[14px] font-semibold text-on-accent">
            Show me around <ArrowRight size={15} />
          </button>
        </div>
      )}

      {err && <p role="alert" className="mt-3 text-[12.5px] font-medium text-brick-text">{err}</p>}

      {!waiting && (
      <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
        {step === 'terms' ? (
          <>
            <span className="text-[12.5px] text-faint">This step cannot be skipped.</span>
            <button type="button" onClick={acceptTerms} disabled={!legalOk} className="flex h-11 items-center gap-2 rounded-[10px] bg-accent px-5 text-[14px] font-semibold text-on-accent disabled:opacity-40">
              Continue <ArrowRight size={15} />
            </button>
          </>
        ) : step === 'settings' ? (
          <>
            <button type="button" onClick={finish} className="text-[13px] font-semibold text-dim hover:text-text">Skip for now</button>
            <button type="button" onClick={() => void continueToPlans()} disabled={saving} className="flex h-11 items-center gap-2 rounded-[10px] bg-accent px-5 text-[14px] font-semibold text-on-accent disabled:opacity-60">
              Continue <ArrowRight size={15} />
            </button>
          </>
        ) : step === 'plan' ? (
          // no Continue here: the two cards are the choice, and one of them has to
          // be taken. A second Continue beside them only asked the question twice.
          <>
            <button type="button" onClick={() => setStep('settings')} className="text-[13px] font-semibold text-dim hover:text-text">Back</button>
            <span className="text-[12.5px] text-faint">Pick one to carry on.</span>
          </>
        ) : (
          <>
            <button type="button" onClick={() => setStep('plan')} className="text-[13px] font-semibold text-dim hover:text-text">Back</button>
            <button type="button" onClick={finish} className="flex h-11 items-center gap-2 rounded-[10px] border border-border2 bg-s1 px-5 text-[14px] font-semibold hover:bg-s2">
              Not now <ArrowRight size={15} />
            </button>
          </>
        )}
      </div>
      )}
    </div>
  )
}
