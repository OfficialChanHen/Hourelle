'use client'

// Where Google (and the email confirmation link) sends the browser back to.
// The provider appends a one-time code to this URL; the Supabase client swaps it
// for a real session, and then we get out of the way. Nothing to look at, so the
// page is a single line of reassurance while the exchange happens.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, backendOn } from '@/lib/db'

export default function AuthCallbackPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!backendOn) { router.replace('/home'); return }
    let done = false
    // the browser client is configured to detect the code in the URL and exchange
    // it on load, so the session usually exists by the time this effect runs —
    // poll briefly rather than racing it
    const finish = async () => {
      for (let i = 0; i < 20 && !done; i++) {
        const { data } = await supabase!.auth.getSession()
        if (data.session) { router.replace('/home'); return }
        await new Promise((r) => setTimeout(r, 150))
      }
      if (!done) setError('That sign-in link did not go through. Try again from the sign-in page.')
    }
    void finish()
    return () => { done = true }
  }, [router])

  return (
    <div className="grid min-h-dvh place-items-center px-6 text-center">
      {error ? (
        <div className="max-w-[320px]">
          <p className="font-serif text-[22px] leading-tight">Sign-in didn&apos;t finish</p>
          <p className="mt-2 text-[13px] leading-[1.55] text-dim">{error}</p>
          <a href="/auth/signin" className="mt-4 inline-flex h-10 items-center rounded-[10px] bg-accent px-4 text-[13.5px] font-semibold text-on-accent">
            Back to sign in
          </a>
        </div>
      ) : (
        <p className="text-[13.5px] text-dim">Signing you in…</p>
      )}
    </div>
  )
}
