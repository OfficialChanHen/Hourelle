/* Forgiving input: take what people type or paste the way they wrote it, and keep
   only what the app needs. A pasted "Sam Lee <sam@x.com>" is an address, "$1,250.75"
   is a budget of 1250, and "mailto:" or a trailing comma is never an error. */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// an address inside a longer run of text: stops at spaces, brackets, quotes and list marks
const EMAIL_IN_TEXT = /[^\s<>()[\]"',;:]+@[^\s<>()[\]"',;:]+\.[^\s<>()[\]"',;:.]+/g

export const isEmail = (s: string) => EMAIL_RE.test(s)

/* one address as typed or pasted: trims, lowercases, drops "mailto:", angle brackets
   and a name in front of them, and a full stop or comma left at the end */
export function cleanEmail(raw: string): string {
  const s = raw.trim().replace(/^mailto:/i, '')
  const found = s.match(EMAIL_IN_TEXT)
  if (found && found.length === 1) return found[0].toLowerCase()
  return s.replace(/[.,;]+$/, '').toLowerCase()
}

/* every address in a pasted list, in order and once each, whatever separates them
   (commas, semicolons, new lines, "Name <address>" from a mail client). `bad` is the
   first piece that looks meant as an address and is not one, or the whole text when
   nothing in it is an address at all. */
export function pickEmails(raw: string): { emails: string[]; bad: string | null } {
  const text = raw.replace(/mailto:/gi, ' ')
  const emails = Array.from(new Set((text.match(EMAIL_IN_TEXT) ?? []).map((e) => e.toLowerCase())))
  const rest = text.replace(EMAIL_IN_TEXT, ' ')
  const broken = rest.split(/[\s,;<>()"']+/).find((t) => t.includes('@'))
  if (broken) return { emails, bad: broken }
  if (!emails.length && raw.trim()) return { emails, bad: raw.trim().split(/[\s,;]+/)[0] }
  return { emails, bad: null }
}

/* a whole-dollar amount from whatever was typed: "$1,250.75" is "1250", "20 bucks"
   is "20". Cents are dropped, never folded into the dollars. */
export function wholeAmount(raw: string, maxDigits = 7): string {
  const dollars = raw.replace(/[^\d.]/g, '').split('.')[0]
  return dollars.replace(/^0+(?=\d)/, '').slice(0, maxDigits)
}
