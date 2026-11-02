/* What a plan's link shows when it is pasted into a group chat (iMessage, WhatsApp,
   Discord, Messenger, Instagram): the name, the cover, the host, and where the time
   question stands. Pure, so the page metadata and the preview image agree, and so the
   rule about what a link may show is tested in one place.

   A link never shows more than it grants. The plain link is the plan's invitation and
   opens the join page's teaser, which already shows the name, the cover, the host, the
   dates and the head count, so the preview stays inside that. A personal link
   (?invite=) shows the plan only while its person is still on it: once they are
   removed their token names nobody, and the link falls back to the site's own
   preview, as it would for a plan that does not exist. */

import type { AppEvent } from './events'
import { confirmedSlotText, dateRangeText, participantByInvite, phaseOf, answeredCount, rsvpPool } from './events'
import { answeredLine, goingLine } from './answers'
import { coverFor } from './cover-kind'
import { isAllDay } from './slot'
import { tzAbbr } from '@/components/ui/TimezonePill'

export type PreviewCover =
  | { kind: 'photo'; src: string; fit?: 'fill' | 'fit'; pos?: { x: number; y: number } }
  | { kind: 'preset'; id: string }
  | { kind: 'plain'; from: string; to: string }

export type LinkPreview = {
  id: string
  title: string
  host: string
  // the locked time, or the dates still being asked about
  when: string
  // the zone of a locked time; null when no time of day is shown
  tz: string | null
  // "3 of 8 have answered", "4 of 5 who can make it are going", or that it happened
  status: string
  locked: boolean
  cover: PreviewCover
  // the sentence under the title in the chat's card
  description: string
}

export function previewOf(ev: AppEvent | null | undefined, invite?: string | null): LinkPreview | null {
  if (!ev || ev.demo) return null
  if (invite && !participantByInvite(ev, invite)) return null

  const past = phaseOf(ev) === 'past'
  const slot = ev.confirmed ?? null
  const locked = !!slot && ev.status === 'confirmed'
  const when = (locked && confirmedSlotText(ev)) || dateRangeText(ev)
  const tz = locked && slot && !isAllDay(slot) ? tzAbbr(ev.timezone, slot.dayKey) : null
  const status = past
    ? 'This plan already happened'
    : locked
      ? goingLine(rsvpPool(ev))
      : answeredLine(answeredCount(ev), ev.participants.length)

  const src = ev.image
  const cover: PreviewCover = src?.startsWith('preset:')
    ? { kind: 'preset', id: src.slice(7) }
    : src && (src.startsWith('http') || src.startsWith('data:image/'))
      ? { kind: 'photo', src, fit: ev.imageFit, pos: ev.imagePos }
      : (([from, to]) => ({ kind: 'plain' as const, from, to }))(coverFor(ev.id))

  const time = tz ? `${when} ${tz}` : when
  const description = locked
    ? `${time}. ${status}. Hosted by ${ev.hostName}.`
    : past
      ? `${status}. Hosted by ${ev.hostName}.`
      : `Mark when you're free, ${when}. ${status}. Hosted by ${ev.hostName}.`

  return { id: ev.id, title: ev.title, host: ev.hostName, when, tz, status, locked, cover, description }
}

/** A short tag that changes whenever the picture would, so a chat app that keeps
 *  images by URL fetches a new one after an answer or a lock-in. */
export function previewVersion(p: LinkPreview): string {
  const c = p.cover.kind === 'photo' ? p.cover.src : p.cover.kind === 'preset' ? p.cover.id : ''
  const s = [p.title, p.host, p.when, p.tz ?? '', p.status, c].join('|')
  let h = 0
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return h.toString(36)
}
