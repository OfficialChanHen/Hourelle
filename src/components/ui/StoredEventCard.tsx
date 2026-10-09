'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Calendar, CalendarClock, Check, CopyPlus, Link2, MapPin, Pencil, Reply, Trash2, UserRound, UserRoundX, UsersRound, Vote } from 'lucide-react'
import { PhotoFrame } from './PhotoFrame'
import { Keepsake, lookOf, withDetail, type Look } from './Keepsake'
import { PeekCard, peopleIn } from './PeekCard'
import { TimezonePill } from './TimezonePill'
import { Cover } from './Cover'
import { HostTag } from './HostTag'
import { Tip } from './Tip'
import { Announce } from './Announce'
import { daysUntil, daysUntilLabel, dateRangeText, confirmedSlotText, eventTabFor, leadingPlaceOf, phaseOf, answeredCount, rsvpPool, type AppEvent, type SameDayInfo } from '@/lib/events'
import { PHASE_BADGE, PHASE_TINT } from './LifecycleStrip'
import { answeredLine, goingLine } from '@/lib/answers'

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

/* One plan on the Plans and Demos shelves, laid down like a photo: the cover in a
   frame lying straight, with its own hand-laid detail (Keepsake, from the plan's id, so it
   keeps its look), and the faces of the people in peeking over the top edge, half
   up at rest and rising on hover or focus. The faces lead: they are who the plan is
   for. `look` comes from the shelf (shelfLooks) so a row shows several details;
   `faded` is for past plans, a photo gone a little pale. */
export function StoredEventCard({ e, sameDay, look: given, faded = false }: { e: AppEvent; sameDay?: SameDayInfo; look?: Look; faded?: boolean }) {
  // the shelf's look, with the host's own pick of detail laid over it
  const look = withDetail(given ?? lookOf(e.id, 0), e.keepsake)
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
  const replied = e.hostedByYou && phase === 'planning' ? answeredCount(e) : null
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
    <>
    {/* the faces of the people in, half up over the frame's top edge, rising on
        hover or focus; each one flips to its initials */}
    <PeekCard people={peopleIn(e)} size={38} restShow={26} upShow={33} className="h-full">
    <PhotoFrame tilt={0} tape={false} pad={look.pad} className="h-full [&>div]:flex [&>div]:h-full [&>div]:flex-col">
    <Link
      href={eventTabFor(e)}
      className="group flex flex-1 flex-col"
    >
      {/* one cover height for every card, photo or scene, so a row of cards lines up:
          the titles start on the same line and the grid reads as a grid. A photo used
          to take 150 and a scene 92, which staggered every row that mixed the two. */}
      <div className="relative mb-3">
        <Cover src={e.image} fit={e.imageFit} pos={e.imagePos} from={from} to={to} className={`${CARD_COVER_H} ${faded ? 'saturate-[.45]' : ''}`} rounded="rounded-lg" />
        <Keepsake look={look} />
        <HostTag e={e} />
        {/* the cover's top corner is the one open spot on the card: the host's way to the details tab */}
        {e.hostedByYou && !e.demo && (
          <span
            role="button" tabIndex={0} onClick={goEdit} onKeyDown={goEdit}
            title="Edit the plan" aria-label="Edit the plan"
            className="absolute right-2.5 top-2.5 grid h-9 w-9 place-items-center rounded-full border border-border bg-s1/90 text-dim shadow-soft backdrop-blur-sm hover:bg-s1 hover:text-text sm:h-8 sm:w-8"
          >
            <Pencil size={14} />
          </span>
        )}
      </div>
      {/* the old badge row as one quiet line: dot for the phase, words for the rest */}
      <div className="mb-1.5 flex items-center gap-1.5 px-1 text-[12px] font-medium text-dim">
        <span className="h-2 w-2 flex-none rounded-full" style={{ background: tint.dot }} />
        <span>{badge.label}</span>
        {phase !== 'past' && du !== null && (
          <>
            <span className="h-3 w-px flex-none bg-border2" aria-hidden />
            <span className={du >= 0 && du <= 14 ? 'text-accent-text' : ''}>{daysUntilLabel(du)}</span>
          </>
        )}
      </div>
      <h3 className="mb-[9px] px-1 font-serif text-[20px] leading-[1.15] tracking-[-0.01em] [overflow-wrap:anywhere]">{e.title}</h3>

      {/* glance lines: a settled time beats a date range; place and host only when they say something */}
      <div className="mb-3 flex flex-col gap-[7px] px-1 text-[13px] text-dim">
        {youPending && (
          // coral, the moment role: this card is waiting on you
          <div className="flex items-center gap-1.5 font-semibold text-moment-text">
            <Reply size={14} className="flex-none" />
            <span>Your turn to reply</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <Calendar size={14} className="flex-none" />
          {slot ? (
            <><span className="truncate">{slot}</span> <TimezonePill tz={e.timezone} day={e.confirmed?.dayKey ?? e.startDate} /></>
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
              {answeredLine(replied, e.participants.length)}
            </span>
          </div>
        )}
        {rsvpWaiting > 0 && (
          <div className="flex items-center gap-1.5">
            <UsersRound size={14} className="flex-none" />
            <span className="truncate">{goingLine(rsvpPool(e))}</span>
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
      <div className="mt-auto flex items-center justify-between gap-2 px-1">
        <div className="flex min-w-0 items-center gap-2">
          {/* the faces are over the top edge; here, how many. While planning nobody
              has committed yet, so count invites; "going" means something once locked */}
          <UsersRound size={14} className="flex-none text-dim" aria-hidden />
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
              title="Duplicate this plan"
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
              title="Delete this plan"
              className="grid h-10 w-10 sm:h-8 sm:w-8 place-items-center rounded-md text-faint hover:bg-brick-bg hover:text-brick-text"
            >
              <Trash2 size={15} />
            </span>
          )}
          {canLeave && (
            <span
              role="button" tabIndex={0} onClick={goDelete} onKeyDown={goDelete}
              title="Leave this plan"
              className="grid h-10 w-10 sm:h-8 sm:w-8 place-items-center rounded-md text-faint hover:bg-brick-bg hover:text-brick-text"
            >
              <UserRoundX size={15} />
            </span>
          )}
        </div>
      </div>
    </Link>
    </PhotoFrame>
    </PeekCard>
    {/* outside the link, so the words never become part of the card's name; it is
        taken out of the flow, so the grid the cards sit in never sees it */}
    {canShare && <Announce text={copied ? 'Link copied' : ''} />}
    </>
  )
}
