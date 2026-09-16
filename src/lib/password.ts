// One password rule for the whole app. Sign-up, the reset page and the security
// card all read it, so the bar and its wording can never drift apart, and the
// same checks are shown while someone types as are enforced when they submit.
//
// Set the same requirements in Supabase (Authentication → Sign In / Providers →
// Email → password requirements: 10 characters, upper and lower case, digits and
// symbols) so the server refuses what the form would.

export const PASSWORD_MIN = 10

export type PasswordCheck = { label: string; ok: boolean }

export function passwordChecks(pw: string): PasswordCheck[] {
  return [
    { label: `At least ${PASSWORD_MIN} characters`, ok: pw.length >= PASSWORD_MIN },
    { label: 'Upper and lower case letters', ok: /\p{Ll}/u.test(pw) && /\p{Lu}/u.test(pw) },
    { label: 'A number', ok: /\d/.test(pw) },
    { label: 'A symbol, like ! or #', ok: /[^\p{L}\p{N}\s]/u.test(pw) },
  ]
}

export function passwordOk(pw: string): boolean {
  return passwordChecks(pw).every((c) => c.ok)
}

/** The first rule a password misses, as one sentence, or null when it passes. */
export function passwordProblem(pw: string): string | null {
  const missed = passwordChecks(pw).find((c) => !c.ok)
  return missed ? `The password needs ${missed.label.charAt(0).toLowerCase()}${missed.label.slice(1)}.` : null
}
