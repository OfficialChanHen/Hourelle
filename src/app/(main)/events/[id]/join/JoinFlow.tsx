'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { ArrowRight, Calendar, MapPin, User, UsersRound } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { AvatarRow } from '@/components/ui/AvatarRow'
import { TimezonePill } from '@/components/ui/TimezonePill'
import { Cover } from '@/components/ui/Cover'
import { coverFor } from '@/components/ui/StoredEventCard'
import { PHASE_BADGE } from '@/components/ui/LifecycleStrip'
import { claimGuestSession, confirmedSlotText, dateRangeText, getEvent, guestSessionId, joinEvent, leadingPlaceOf, phaseOf, type AppEvent, type Participant } from '@/lib/events'

// names compare loosely — case and stray spaces shouldn't decide whether two
// people "match"
const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase()

/* ── the share-link landing: the event as a teaser, then one ask — your name ──
   No account, no sign-in. The grid, the ballot, and the chat stay out of sight
   until a name is given; after that the guest gets the full event page acting
   as themselves. */
export function JoinFlow({ id }: { id: string }) {
  const router = useRouter()
  const root = useRef<HTMLDivElement>(null)
  const [event, setEvent] = useState<AppEvent | null | undefined>(undefined)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [joining, setJoining] = useState(false)
  // "answered before from another device?" — explains how the email brings your
  // answers back
  const [claimOpen, setClaimOpen] = useState(false)
  // the typed name matches someone already in the event: the guest resolves it here
  // (claim with a matching email, or join under a fuller name) so the host never
  // inherits a pile of doubles
  const [collision, setCollision] = useState<Participant | null>(null)
  const [dupeName, setDupeName] = useState('')
  const [claimEmail, setClaimEmail] = useState('')
  const [claimErr, setClaimErr] = useState(false)

  useEffect(() => {
    // already joined on this browser → straight to the event, as that guest
    const ev = getEvent(id)
    if (ev && guestSessionId(id) && ev.participants.some((p) => p.id === guestSessionId(id))) {
      router.replace(`/events/${id}`)
      return
    }
    setEvent(ev)
  }, [id, router])

  useGSAP(
    () => {
      if (event) gsap.fromTo(root.current, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power3.out' })
    },
    { dependencies: [event === undefined] },
  )

  function doJoin(n: string) {
    if (joining) return
    setJoining(true)
    const guest = joinEvent(id, n, email)
    if (guest) router.replace(`/events/${id}`)
    else setJoining(false)
  }
  function join() {
    const clean = name.trim().replace(/\s+/g, ' ')
    if (!clean || joining || !event) return
    // the email is the identity key: same email as an earlier join means same
    // person — resume their entry instead of creating a double
    const cleanEmail = email.trim().toLowerCase()
    const byEmail = cleanEmail ? event.participants.find((p) => p.guest && p.email === cleanEmail) : undefined
    if (byEmail) {
      claimGuestSession(id, byEmail.id)
      router.replace(`/events/${id}`)
      return
    }
    const taken = event.participants.find((p) => norm(p.name) === norm(clean))
    if (taken) {
      setCollision(taken)
      setDupeName(clean)
      setClaimEmail(email.trim())
      setClaimErr(false)
      return
    }
    doJoin(clean)
  }
  // the claim: proof is the email on the earlier entry, never the name alone
  function claim() {
    if (!collision?.email) return
    if (claimEmail.trim().toLowerCase() === collision.email) {
      claimGuestSession(id, collision.id)
      router.replace(`/events/${id}`)
    } else {
      setClaimErr(true)
    }
  }
  function joinRenamed() {
    const n = dupeName.trim().replace(/\s+/g, ' ')
    if (!n || !event || joining) return
    const taken = event.participants.find((p) => norm(p.name) === norm(n))
    if (taken) {
      setCollision(taken)
      setClaimErr(false)
      return
    }
    doJoin(n)
  }

  if (event === undefined) {
    return (
      <div className="mx-auto max-w-[560px] px-[26px] pt-[64px]">
        <div className="h-40 animate-pulse rounded-2xl bg-s2" />
      </div>
    )
  }
  if (event === null) {
    return (
      <div className="mx-auto max-w-[560px] px-[26px] pb-[104px] pt-[72px] text-center">
        <p className="font-serif text-[33.5px] tracking-[-0.01em]">This invite doesn&apos;t open here</p>
        <p className="mx-auto mt-2 max-w-sm text-[14.5px] leading-[1.55] text-dim">
          The event lives on the device that created it for now, so the link only works there. Ask the host to check it, or plan something of your own.
        </p>
        <Link href="/create" className="mt-5 inline-flex h-10 items-center gap-1.5 rounded-[10px] bg-accent px-4 text-[14px] font-semibold text-on-accent">Create an event</Link>
      </div>
    )
  }

  const phase = phaseOf(event)
  const badge = PHASE_BADGE[phase]
  const locked = phase !== 'planning'
  const slot = confirmedSlotText(event)
  const lead = leadingPlaceOf(event)
  const [coverFrom, coverTo] = coverFor(event.id)
  const past = phase === 'past'

  return (
    <div ref={root} className="mx-auto max-w-[560px] px-4 pb-[104px] pt-[34px] sm:px-[26px] sm:pt-[56px]">
      {/* the event as a teaser — enough to know what this is, none of the answers */}
      <div className="overflow-hidden rounded-2xl border border-border bg-s1 shadow-soft">
        <Cover src={event.image} from={coverFrom} to={coverTo} className="h-[110px]" />
        <div className="p-6">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge variant={badge.variant}>{badge.label}</Badge>
          </div>
          <h1 className="font-serif text-[31px] leading-[1.06] tracking-[-0.01em]">{event.title}</h1>
          <div className="mt-3 flex flex-col gap-[7px] text-[13.5px] text-dim">
            <span className="flex items-center gap-1.5"><User size={14} className="flex-none" /> Hosted by {event.hostName}</span>
            <span className="flex flex-wrap items-center gap-1.5">
              <Calendar size={14} className="flex-none" />
              {slot ?? dateRangeText(event)} <TimezonePill tz={event.timezone} />
            </span>
            {lead && (
              <span className="flex items-center gap-1.5">
                <MapPin size={14} className="flex-none" /> {lead.place.name}
                {!lead.confirmed && <span className="text-[12px] text-faint">leading the vote</span>}
              </span>
            )}
            <span className="flex items-center gap-2">
              <UsersRound size={14} className="flex-none" />
              <AvatarRow people={event.participants.map((p) => ({ initials: p.initials, name: p.name, color: p.color }))} size={20} max={5} />
              {event.participants.length} {event.participants.length === 1 ? 'person is' : 'people are'} in
            </span>
          </div>
          {event.description && <p className="mt-3 text-[13.5px] leading-[1.6] text-dim">{event.description}</p>}

          {/* the one ask — everything else waits behind it */}
          <div className="mt-5 border-t border-border pt-5">
            {past ? (
              <p className="text-[13.5px] leading-[1.55] text-dim">This event has already happened, so there is nothing left to join.</p>
            ) : collision ? (
              /* the typed name is taken — the guest sorts it out here, not the host later */
              <>
                <p className="text-[14px] font-semibold">Someone named {collision.name} is already in this event.</p>
                {collision.guest && collision.email ? (
                  <>
                    <p className="mt-1.5 text-[12.5px] leading-[1.55] text-dim">
                      If that&apos;s you, enter the email you joined with and you&apos;ll pick up right where you left off.
                    </p>
                    <div className="mt-2.5 flex flex-col gap-2 sm:flex-row">
                      <input
                        type="email"
                        value={claimEmail}
                        onChange={(e) => { setClaimEmail(e.target.value); setClaimErr(false) }}
                        onKeyDown={(e) => { if (e.key === 'Enter') claim() }}
                        placeholder="Your email"
                        className="h-10 min-w-0 flex-1 rounded-[10px] border border-border bg-s0 px-3.5 text-[13.5px] outline-none placeholder:text-faint focus:border-accent-border"
                      />
                      <button onClick={claim} disabled={!claimEmail.trim()} className="h-10 flex-none rounded-[10px] bg-accent px-4 text-[13.5px] font-semibold text-on-accent disabled:opacity-40">
                        That&apos;s me
                      </button>
                    </div>
                    {claimErr && (
                      <p className="mt-2 text-[12.5px] font-medium text-brick-text">
                        That email doesn&apos;t match. If you&apos;re a different {collision.name.split(' ')[0]}, join with a fuller name below.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="mt-1.5 text-[12.5px] leading-[1.55] text-dim">
                    They didn&apos;t leave an email, so there&apos;s no way to check that&apos;s you. Joining with the same name would show the event two of you.
                  </p>
                )}

                <div className="mt-4 border-t border-border pt-4">
                  <p className="text-[13px] font-semibold">Someone else with the same name?</p>
                  <p className="mt-1 text-[12.5px] leading-[1.55] text-dim">Add a last name or an initial so people can tell you apart.</p>
                  <div className="mt-2.5 flex flex-col gap-2 sm:flex-row">
                    <input
                      value={dupeName}
                      onChange={(e) => setDupeName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') joinRenamed() }}
                      aria-label="A fuller name"
                      className="h-10 min-w-0 flex-1 rounded-[10px] border border-border bg-s0 px-3.5 text-[13.5px] outline-none placeholder:text-faint focus:border-accent-border"
                    />
                    <button
                      onClick={joinRenamed}
                      disabled={!dupeName.trim() || norm(dupeName) === norm(collision.name) || joining}
                      className="h-10 flex-none rounded-[10px] bg-accent px-4 text-[13.5px] font-semibold text-on-accent disabled:opacity-40"
                    >
                      Join with this name
                    </button>
                  </div>
                </div>

                <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                  <button onClick={() => setCollision(null)} className="text-[12.5px] font-semibold text-accent-text hover:underline">
                    Back
                  </button>
                  {!(collision.guest && collision.email) && (
                    <button onClick={() => doJoin(name.trim().replace(/\s+/g, ' '))} disabled={joining} className="text-[12.5px] font-medium text-dim hover:text-text hover:underline">
                      Join as a second {collision.name} anyway
                    </button>
                  )}
                </div>
              </>
            ) : (
              <>
                <label htmlFor="join-name" className="text-[14px] font-semibold">
                  {locked ? 'Add your name to see the plan and say if you are coming.' : 'Add your name to say when you are free and help pick the place.'}
                </label>
                <div className="mt-2.5 flex flex-col gap-2 sm:flex-row">
                  <input
                    id="join-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') join() }}
                    placeholder="Your name"
                    className="h-11 min-w-0 flex-1 rounded-[10px] border border-border bg-s0 px-3.5 text-[14.5px] outline-none placeholder:text-faint focus:border-accent-border"
                  />
                  <button
                    onClick={join}
                    disabled={!name.trim() || joining}
                    className="flex h-11 flex-none items-center justify-center gap-1.5 rounded-[10px] bg-accent px-5 text-[14px] font-semibold text-on-accent disabled:opacity-40"
                  >
                    Join in <ArrowRight size={15} />
                  </button>
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email (Recommended)"
                  aria-label="Email, recommended but optional"
                  className="mt-2 h-10 w-full rounded-[10px] border border-border bg-s0 px-3.5 text-[13.5px] outline-none placeholder:text-faint focus:border-accent-border"
                />
                <p className="mt-2.5 text-[12.5px] leading-[1.55] text-faint">
                  No account needed, and the email is optional. With it you&apos;ll get reminders, and your answers can find you again on another device.
                </p>

                {/* returning from a new device: how the email brings your answers back */}
                <button
                  type="button"
                  onClick={() => setClaimOpen((v) => !v)}
                  className="mt-3 text-[12.5px] font-semibold text-accent-text hover:underline"
                >
                  Answered before from another device?
                </button>
                {claimOpen && (
                  <div className="mt-2 rounded-[10px] border border-border bg-s2 px-3.5 py-3">
                    <p className="text-[12.5px] leading-[1.55] text-dim">
                      If you added an email last time, enter the same name and email above and you&apos;ll continue as yourself. Without one there&apos;s no way to check it&apos;s you, so you&apos;d join as a new person.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* the host opening their own link: name the mirror, keep the way in */}
      {event.hostedByYou && (
        <p className="mt-4 text-center text-[12.5px] leading-[1.55] text-dim">
          This is your event&apos;s invite link, seen as a guest sees it. Joining with a name lets you try that side too, or{' '}
          <Link href={`/events/${event.id}`} className="font-semibold text-accent-text hover:underline">open it as yourself</Link>.
        </p>
      )}
    </div>
  )
}
