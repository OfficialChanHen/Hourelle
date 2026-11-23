// The code in the sign-up email. Supabase sends 6 digits by default and can be set
// to anything up to 10 (Authentication → Sign In / Providers → Email → OTP length),
// so the box takes the whole range rather than guessing one length.
//
// People paste these from mail apps that add spaces, dashes or a whole sentence, so
// everything but the digits is dropped instead of refused.

export const CODE_MIN = 6
export const CODE_MAX = 10

export function cleanCode(raw: string): string {
  return raw.normalize('NFKC').replace(/\D/g, '').slice(0, CODE_MAX)
}

export function codeReady(code: string): boolean {
  return code.length >= CODE_MIN
}

/** The page where a code is typed, with the address filled in. */
export function verifyHref(email: string, next = '/home'): string {
  const q = new URLSearchParams({ email })
  if (next !== '/home') q.set('next', next)
  return `/auth/verify?${q}`
}
