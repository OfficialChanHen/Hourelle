'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Calendar, CalendarClock, Check, CopyPlus, Link2, MapPin, Pencil, Reply, Trash2, UserRound, UserRoundX, UsersRound, Vote } from 'lucide-react'
import { AvatarRow } from './AvatarRow'
import { TimezonePill } from './TimezonePill'
import { Cover } from './Cover'
import { Tip } from './Tip'
import { daysUntil, daysUntilLabel, dateRangeText, confirmedSlotText, eventTabFor, leadingPlaceOf, phaseOf, respondedCount, type AppEvent, type SameDayInfo } from '@/lib/events'
import { PHASE_BADGE, PHASE_TINT } from './LifecycleStrip'

const COVERS: [string, string][] = [
  ['#E4EDE7', '#CFE0D5'], ['#E7E2EE', '#D9CFE4'], ['#DEE7EC', '#C7DAE2'],
  ['#EFE7D6', '#E4D3B4'], ['#EEE1DD', '#E4CCC7'], ['#E4EADB', '#CDDCBB'],
]
// shared with the home hero, so the same event wears the same cover everywhere
/** The cover height every event card wears, here and on the landing page. */
export const CARD_COVER_H = 'h-[120px]'

export function coverFor(id: string): [string, string] {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return COVERS[h % COVERS.length]
}

// stops a click on an in-card action from following the card's own link
function asAction(fn: () => void) {
  return (ev: React.MouseEvent | React.KeyboardEvent) => {
    if ('key' in ev && ev.key !== 'Enter' && ev.key !== ' ') return
    ev.preventDefault()
    ev.stopPropagation()
    fn()
  }
}

export function StoredEventCard({ e, sameDay }: { e: AppEvent; sameDay?: SameDayInfo }) {
  const router = useRouter()
  const [copied, setCopied] = useState(false)
  const phase = phaseOf(e)
  const badge = PHASE_BADGE[phase]
  const tint = PHASE_TINT[phase]
  const du = daysUntil(e.confirmed?.dayKey ?? e.startDate)
  const going = e.participants.filter((p) => p.rsvp === 'attending').length
  const slot = confirmedSlotText(e)
  const lead = leadingPlaceOf(e)
  const [from, to] = coverFor(e.id)
  const canShare = e.hostedByYou && phase !== 'past'
  const canDelete = e.hostedByYou && !e.demo
  // someone else's event on your lists (joined via a link): removable on your side
  // only — the same shortcut route, landing on the leave zone instead of delete
  const canLeave = !e.hostedByYou && !e.demo
  // the three glance cues that call for action: your missing reply, how many the
  // host is still waiting on, and a voting deadline that hasn't passed
  const youPending = phase !== 'past' && e.participants.some((p) => p.you && p.rsvp === 'pending')
  const replied = e.hostedByYou && phase === 'planning' ? respondedCount(e.avail, e.unavailableIds) : null
  const voteDays = phase === 'planning' && e.voteDeadline ? daysUntil(e.voteDeadline) : null
  // the locked-stage mirror of `replied`: RSVPs the host is still waiting on
  const rsvpWaiting = e.hostedByYou && phase !== 'planning' && phase !== 'past'
    ? e.participants.filter((p) => p.rsvp === 'pending').length
    : 0

  const copyLink = asAction(() => {
    navigator.clipboard?.writeText(`${window.location.origin}/events/${e.id}/join`).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600) }).catch(() => {})
  })
  const goDelete = asAction(() => router.push(`/events/${e.id}?tab=details&focus=delete`))
  // the same plan again, a week on: the wizard opens filled in, people list included
  const goDuplicate = asAction(() => router.push(`/create?from=${e.id}`))
  // the host's shortcut to the details tab, where everything about the event is edited
  const goEdit = asAction(() => router.push(`/events/${e.id}?tab=details`))

  return (
    <Link
      href={eventTabFor(e)}
      className="group flex flex-col overflow-hidden rounded-[13px] border border-border bg-s1 p-3.5 transition-all hover:-translate-y-0.5 hover:border-border2"
      // status reads from the frame, not from chips: the border wears the phase color
      style={tint.border ? { borderColor: tint.border } : undefined}
    >
      {/* one cover height for every card, photo or scene, so a row of cards lines up:
          the titles start on the same line and the grid reads as a grid. A photo used
          to take 150 and a scene 92, which staggered every row that mixed the two. */}
      <div className="relative -mx-3.5 -mt-3.5 mb-3">
        <Cover src={e.image} fit={e.imageFit} pos={e.imagePos} from={from} to={to} className={CARD_COVER_H} />
        {/* the cover's top corner is the one open spot on the card: the host's way to the details tab */}
        {e.hostedByYou && !e.demo && (
          <span
            role="button" tabIndex={0} onClick={goEdit} onKeyDown={goEdit}
            title="Edit the event" aria-label="Edit the event"
            className="absolute right-2.5 top-2.5 grid h-9 w-9 place-items-center rounded-full border border-border bg-s1/90 text-dim shadow-soft backdrop-blur-sm hover:bg-s1 hover:text-text sm:h-8 sm:w-8"
          >
            <Pencil size={14} />
          </span>
        )}
      </div>
      {/* the old badge row as one quiet line: dot for the phase, words for the rest */}
      <div className="mb-1.5 flex items-center gap-1.5 text-[12px] font-medium text-dim">
        <span className="h-2 w-2 flex-none rounded-full" style={{ background: tint.dot }} />
        <span>{badge.label}</span>
        {phase !== 'past' && du !== null && (
          <>
            <span className="h-3 w-px flex-none bg-border2" aria-hidden />
            <span className={du >= 0 && du <= 14 ? 'text-accent-text' : ''}>{daysUntilLabel(du)}</span>
          </>
        )}
      </div>
      <h3 className="mb-[9px] text-[15px] font-semibold tracking-[-0.01em]">{e.title}</h3>

      {/* glance lines: a settled time beats a date range; place and host only when they say something */}
      <div className="mb-3 flex flex-col gap-[7px] text-[13px] text-dim">
        {youPending && (
          <div className="flex items-center gap-1.5 font-medium text-accent-text">
            <Reply size={14} className="flex-none" />
            <span>You haven&apos;t replied yet</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <Calendar size={14} className="flex-none" />
          {slot ? (
            <><span className="truncate">{slot}</span> <TimezonePill tz={e.timezone} /></>
          ) : (
            <span className="truncate">{dateRangeText(e)}</span>
          )}
        </div>
        {lead && (
          <div className="flex items-center gap-1.5">
            <MapPin size={14} className="flex-none" />
            <span className="truncate">{lead.place.name}</span>
            {!lead.confirmed && <span className="flex-none text-[12px] text-faint">leading the vote</span>}
          </div>
        )}
        {!e.hostedByYou && (
          <div className="flex items-center gap-1.5">
            <UserRound size={14} className="flex-none" />
            <span className="truncate">Hosted by {e.hostName}</span>
          </div>
        )}
        {replied !== null && (
          <div className="flex items-center gap-1.5">
            <UsersRound size={14} className="flex-none" />
            <span className="truncate">
              {replied >= e.participants.length ? 'Everyone has replied' : `${replied} of ${e.participants.length} replied so far`}
            </span>
          </div>
        )}
        {rsvpWaiting > 0 && (
          <div className="flex items-center gap-1.5">
            <UsersRound size={14} className="flex-none" />
            <span className="truncate">Waiting on {rsvpWaiting} {rsvpWaiting === 1 ? 'reply' : 'replies'}</span>
          </div>
        )}
        {voteDays !== null && voteDays >= 0 && (
          <div className={`flex items-center gap-1.5 ${voteDays <= 7 ? 'font-medium text-ochre-text' : ''}`}>
            <Vote size={14} className="flex-none" />
            <span className="truncate">
              {voteDays === 0 ? 'Voting closes today' : voteDays <= 7 ? `Voting closes in ${voteDays} day${voteDays === 1 ? '' : 's'}` : `Voting closes ${dateRangeText({ startDate: e.voteDeadline!, endDate: e.voteDeadline! })}`}
            </span>
          </div>
        )}
        {sameDay && (() => {
          const line = (
            <div className="flex items-center gap-1.5 font-medium text-ochre-text">
              <CalendarClock size={14} className="flex-none" />
              <span className="truncate">Same day as {sameDay.label}</span>
            </div>
          )
          // a single clash is already named in full — the tooltip only earns its
          // tap when there's a count to unpack
          return sameDay.all ? <Tip text={`Same day as ${sameDay.all}`}>{line}</Tip> : line
        })()}
      </div>

      {/* anchored to the card's bottom edge so avatars and actions line up across
          the row even when neighbors carry more metadata lines */}
      <div className="mt-auto flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <AvatarRow people={e.participants.map((p) => ({ initials: p.initials, name: p.name, color: p.color }))} size={24} max={4} />
          {/* while planning, nobody has committed yet — count invites; "going" only
              means something once a time is locked and RSVPs are real */}
          <span className="truncate text-[12.5px] text-dim">
            {phase === 'planning' || going === 0
              ? `${e.participants.length} invited`
              : phase === 'past' ? `${going} went` : `${going} going`}
          </span>
        </div>
        <div className="flex flex-none items-center gap-0.5">
          {!e.demo && (
            <span
              role="button" tabIndex={0} onClick={goDuplicate} onKeyDown={goDuplicate}
              title="Duplicate this event"
              className="grid h-10 w-10 sm:h-8 sm:w-8 place-items-center rounded-md text-faint hover:bg-s2 hover:text-text"
            >
              <CopyPlus size={15} />
            </span>
          )}
          {canShare && (
            <span
              role="button" tabIndex={0} onClick={copyLink} onKeyDown={copyLink}
              title={copied ? 'Link copied' : 'Copy the invite link'}
              className={`grid h-10 w-10 sm:h-8 sm:w-8 place-items-center rounded-md ${copied ? 'text-accent-text' : 'text-faint hover:bg-s2 hover:text-text'}`}
            >
              {copied ? <Check size={15} /> : <Link2 size={15} />}
            </span>
          )}
          {canDelete && (
            <span
              role="button" tabIndex={0} onClick={goDelete} onKeyDown={goDelete}
              title="Delete this event"
              className="grid h-10 w-10 sm:h-8 sm:w-8 place-items-center rounded-md text-faint hover:bg-brick-bg hover:text-brick-text"
            >
              <Trash2 size={15} />
            </span>
          )}
          {canLeave && (
            <span
              role="button" tabIndex={0} onClick={goDelete} onKeyDown={goDelete}
              title="Remove from my events"
              className="grid h-10 w-10 sm:h-8 sm:w-8 place-items-center rounded-md text-faint hover:bg-brick-bg hover:text-brick-text"
            >
              <UserRoundX size={15} />
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
