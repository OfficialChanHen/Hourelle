'use client'

// Where Google (and the email confirmation link) sends the browser back to.
// The provider appends a one-time code to this URL; the Supabase client swaps it
// for a real session, and then we get out of the way. Nothing to look at, so the
// page is a single line of reassurance while the exchange happens.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, backendOn } from '@/lib/db'
import { wasWelcomed } from '@/lib/plan'
import { legalAccepted } from '@/lib/session'

// an account made moments ago through Google or Microsoft has not seen the welcome
// steps; one made earlier has. The session's own user says when it was made, which
// is true the instant the session exists — the profile row is written by a trigger
// and can still be on its way, and reading a row that is not there yet used to read
// as "not new", which is how an account made again after a deletion missed the steps.
function isNewAccount(user: { created_at?: string }): boolean {
  const at = user.created_at ? Date.parse(user.created_at) : 0
  return !!at && Date.now() - at < 3 * 60_000
}

export default function AuthCallbackPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // a magic link from an invite carries ?next=/events/<id>/join so the join page
    // can finish what the email started; everything else lands on home
    const raw = new URLSearchParams(window.location.search).get('next') ?? ''
    const next = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/home'
    if (!backendOn) { router.replace(next); return }
    let done = false
    // the browser client is configured to detect the code in the URL and exchange
    // it on load, so the session usually exists by the time this effect runs —
    // poll briefly rather than racing it
    const finish = async () => {
      for (let i = 0; i < 20 && !done; i++) {
        const { data } = await supabase!.auth.getSession()
        if (data.session) {
          const uid = data.session.user.id
          // a return that is finishing a deletion goes straight there: nothing to welcome
          // an account that is about to end, and the terms step must not stand in the way
          const deleting = next.includes('confirmDelete=1')
          // a Google or Microsoft account made through the log-in button never saw the
          // terms: the welcome steps open on them, and cannot be skipped past them
          if (!deleting && (!(await legalAccepted(uid)) || (!wasWelcomed(uid) && isNewAccount(data.session.user)))) { router.replace(`/welcome?next=${encodeURIComponent(next)}`); return }
          router.replace(next); return
        }
        await new Promise((r) => setTimeout(r, 150))
      }
      if (!done) setError('That log-in link did not go through. Try again from the log-in page.')
    }
    void finish()
    return () => { done = true }
  }, [router])

  return (
    <div className="grid min-h-dvh place-items-center px-6 text-center">
      {error ? (
        <div className="max-w-[320px]">
          <p className="font-serif text-[22px] leading-tight">Log-in didn&apos;t finish</p>
          <p className="mt-2 text-[13px] leading-[1.55] text-dim">{error}</p>
          <a href="/auth/signin" className="mt-4 inline-flex h-10 items-center rounded-[10px] bg-accent px-4 text-[13.5px] font-semibold text-on-accent">
            Back to log in
          </a>
        </div>
      ) : (
        <p className="text-[13.5px] text-dim">Signing you in…</p>
      )}
    </div>
  )
}
