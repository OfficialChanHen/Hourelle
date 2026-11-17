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

// a link somewhere in pasted text, and a bare one typed without its https
const LINK_IN_TEXT = /https?:\/\/[^\s<>"']+/i
const BARE_LINK = /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i

/* a meeting link as pasted: the link out of an invite line like "Join Zoom Meeting
   <https://…>", with https added when it was typed without. Empty when nothing in it
   is an http link, so it is always safe as an href. */
export function meetingHref(raw: string): string {
  const s = raw.trim()
  const found = s.match(LINK_IN_TEXT)?.[0] ?? (BARE_LINK.test(s) ? `https://${s}` : '')
  if (!found) return ''
  try {
    const url = new URL(found.replace(/[.,;:)\]]+$/, ''))
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : ''
  } catch { return '' }
}

// the big call platforms by the host their links live on; a subdomain counts
// (us02web.zoom.us, acme.webex.com), a lookalike (zoom.us.evil.com) does not
const MEETING_HOSTS: [host: string, name: string][] = [
  ['zoom.us', 'Zoom'], ['zoom.com', 'Zoom'], ['zoomgov.com', 'Zoom'],
  ['meet.google.com', 'Google Meet'],
  ['teams.microsoft.com', 'Teams'], ['teams.live.com', 'Teams'],
  ['discord.gg', 'Discord'], ['discord.com', 'Discord'], ['discordapp.com', 'Discord'],
  ['webex.com', 'Webex'],
  ['meet.jit.si', 'Jitsi'],
  ['whereby.com', 'Whereby'],
  ['facetime.apple.com', 'FaceTime'],
  ['slack.com', 'Slack'],
  ['whatsapp.com', 'WhatsApp'],
  ['skype.com', 'Skype'],
  ['gotomeeting.com', 'GoTo Meeting'], ['goto.com', 'GoTo Meeting'],
]

/* where an online plan meets, read off its link: "Zoom", "Google Meet" and so on,
   or "Custom" when the link is empty or not one of the big platforms */
export function meetingSource(raw: string): string {
  const href = meetingHref(raw)
  if (!href) return 'Custom'
  const host = new URL(href).hostname.replace(/^www\./, '')
  return MEETING_HOSTS.find(([h]) => host === h || host.endsWith(`.${h}`))?.[1] ?? 'Custom'
}

/* the same, to follow "on" in a sentence: "on Zoom", "on a custom link" */
export function onMeeting(raw: string): string {
  const source = meetingSource(raw)
  return source === 'Custom' ? 'a custom link' : source
}
