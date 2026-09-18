'use client'

/* How you log in. One row per door: the email and password you signed up with, the
   Google button and the Microsoft one. Connecting a provider adds it to the account
   you are already in, which is what makes every door open the same place; it is also
   what lets that provider's calendar be imported into your grid. An email can only
   ever belong to one account, so there is nothing here about merging two. */

import { useCallback, useEffect, useState } from 'react'
import { Check, Loader2, Link2, Link2Off } from 'lucide-react'
import { pushFlash } from '@/components/ui/FlashToast'
import { listIdentities, linkProvider, unlinkProvider, PROVIDER_LABEL, type Account, type Identity, type OAuthProvider } from '@/lib/session'
import { backendOn } from '@/lib/db'

function GoogleMark() {
  return (
    <svg width="17" height="17" viewBox="0 0 18 18" aria-hidden>
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z" />
    </svg>
  )
}

function MicrosoftMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 21 21" aria-hidden>
      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
  )
}

const Row = ({ children, first }: { children: React.ReactNode; first?: boolean }) => (
  <div className={`px-5 py-4 ${first ? '' : 'border-t border-border'}`}>{children}</div>
)

export function SignInMethods({ account }: { account: Account }) {
  const [identities, setIdentities] = useState<Identity[] | null>(null)
  const [busy, setBusy] = useState<'link' | 'unlink' | null>(null)
  const [busyOn, setBusyOn] = useState<OAuthProvider | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const read = useCallback(() => { void listIdentities().then(setIdentities) }, [])
  useEffect(() => {
    read()
    // coming back from Google, the callback lands here with ?linked=google. The
    // row below says "connected" on its own once the identities land, so the only
    // thing left to do is say it out loud once and tidy the address bar
    const p = new URLSearchParams(window.location.search)
    const linked = p.get('linked')
    if (linked === 'google' || linked === 'azure') {
      pushFlash(`${PROVIDER_LABEL[linked]} is connected. Every way in opens the same account now.`, 'accent')
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [read])

  const hasPassword = !!identities?.some((i) => i.provider === 'email')
  const onlyDoor = (identities?.length ?? 0) < 2

  async function connect(provider: OAuthProvider) {
    setBusy('link'); setBusyOn(provider); setErr(null); setDone(null)
    const error = await linkProvider(provider, `/profile?linked=${provider}`)
    if (error) { setErr(error); setBusy(null); setBusyOn(null) } // no error means the browser is leaving for the provider
  }
  async function disconnect(provider: OAuthProvider) {
    setBusy('unlink'); setBusyOn(provider); setErr(null); setDone(null)
    const error = await unlinkProvider(provider)
    setBusy(null); setBusyOn(null)
    if (error) { setErr(error); return }
    setDone(`${PROVIDER_LABEL[provider]} is disconnected.`)
    read()
  }

  // one row per provider: its mark, its state, and the one button that fits that state
  const providerRow = (provider: OAuthProvider, mark: React.ReactNode) => {
    const identity = identities?.find((i) => i.provider === provider)
    const label = PROVIDER_LABEL[provider]
    return (
      <Row>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-9 w-9 flex-none place-items-center rounded-[10px] border border-border bg-s2">{mark}</span>
            <div className="min-w-0">
              <div className="text-[14px] font-medium">{label}</div>
              <div className="mt-0.5 truncate text-[12.5px] text-dim">
                {identities === null ? 'Checking…' : identity ? identity.email ?? 'Connected' : 'Not connected'}
              </div>
            </div>
          </div>
          {identities !== null && (identity ? (
            <button
              type="button" onClick={() => void disconnect(provider)} disabled={busy !== null || onlyDoor}
              title={onlyDoor ? 'This is the only way in to your account' : undefined}
              className="flex h-9 flex-none items-center gap-1.5 rounded-[9px] border border-border2 bg-s1 px-3.5 text-[13px] font-semibold hover:bg-s2 disabled:opacity-40"
            >
              {busy === 'unlink' && busyOn === provider ? <Loader2 size={14} className="animate-spin" /> : <Link2Off size={15} />} Disconnect
            </button>
          ) : (
            <button
              type="button" onClick={() => void connect(provider)} disabled={busy !== null || !backendOn}
              className="flex h-9 flex-none items-center gap-1.5 rounded-[9px] bg-accent px-3.5 text-[13px] font-semibold text-on-accent disabled:opacity-40"
            >
              {busy === 'link' && busyOn === provider ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={15} />} Connect
            </button>
          ))}
        </div>
      </Row>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-s1">
      <Row first>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <div className="text-[14px] font-medium">Email and password</div>
            <div className="mt-0.5 truncate text-[12.5px] text-dim">
              {hasPassword ? account.email ?? 'Set up' : 'Not set up'}
            </div>
          </div>
          {hasPassword && <span className="flex h-7 flex-none items-center gap-1.5 rounded-[8px] border border-teal-border bg-teal-bg px-2.5 text-[12px] font-semibold text-teal-text"><Check size={13} /> On</span>}
        </div>
      </Row>

      {providerRow('google', <GoogleMark />)}
      {providerRow('azure', <MicrosoftMark />)}

      {(err || done) && (
        <p role={err ? 'alert' : undefined} className={`border-t border-border px-5 py-3 text-[12.5px] leading-[1.55] ${err ? 'font-medium text-brick-text' : 'text-teal-text'}`}>
          {err ?? done}
        </p>
      )}
    </div>
  )
}
