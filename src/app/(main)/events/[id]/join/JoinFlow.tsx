'use client'

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { ArrowRight, Calendar, MailCheck, MapPin, User, UsersRound } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { AvatarRow } from '@/components/ui/AvatarRow'
import { TimezonePill } from '@/components/ui/TimezonePill'
import { Cover } from '@/components/ui/Cover'
import { coverFor } from '@/components/ui/StoredEventCard'
import { PHASE_BADGE } from '@/components/ui/LifecycleStrip'
import { AUTH_SETTLED, authSettled, currentAccount, emailHasAccount, sendMagicLink } from '@/lib/session'
import { sendJoinedLink } from '@/lib/mail'
import { pushFlash } from '@/components/ui/FlashToast'
import { backendOn } from '@/lib/db'
import { cloudSynced, fetchEvent } from '@/lib/remote'
import { useAccount } from '@/hooks/useAccount'
import { askAboutTour } from '@/lib/prefs'
import { useLiveEvents } from '@/hooks/useLiveEvents'
import {
  addMeToEvent, adoptParticipant, claimGuestSession, confirmedSlotText, dateRangeText, getEvent, guestSessionId, isAccountId,
  joinEvent, leadingPlaceOf, participantByInvite, phaseOf, type AppEvent, type Participant,
} from '@/lib/events'

// names compare loosely — case and stray spaces shouldn't decide whether two
// people "match"
const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase()

const subscribeAuth = (cb: () => void) => {
  window.addEventListener(AUTH_SETTLED, cb)
  return () => window.removeEventListener(AUTH_SETTLED, cb)
}

/* ── the share-link landing: the event as a teaser, then one ask — your name ──
   No account needed. The grid, the ballot, and the chat stay out of sight until a
   name is given; after that the guest gets the full event page acting as themselves.

   Who gets past this page without typing anything:
   - a browser that already joined (its guest session still matches)
   - a personal invite link (?invite=token) — possession of the link is the identity
   - a signed-in account: on the list already, the host, or an email match on an
     entry made before they had an account (their earlier answers come with them) */
export function JoinFlow({ id }: { id: string }) {
  const router = useRouter()
  const inviteToken = useSearchParams().get('invite') ?? ''
  const root = useRef<HTMLDivElement>(null)
  const [event, setEvent] = useState<AppEvent | null | undefined>(undefined)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [joining, setJoining] = useState(false)
  // a magic link went out to prove an email — the page waits here
  const [sent, setSent] = useState<string | null>(null)
  // the typed name matches someone already in the event: the guest resolves it here
  // (prove the email, or join under a fuller name) so the host never inherits doubles
  const [collision, setCollision] = useState<Participant | null>(null)
  const [dupeName, setDupeName] = useState('')
  const [claimEmail, setClaimEmail] = useState('')
  const [claimErr, setClaimErr] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // the typed email belongs to an account: the page says so and offers the log-in,
  // since joining as a guest under it would make a double of that person
  const [accountEmail, setAccountEmail] = useState<string | null>(null)

  // re-run the resolution when the account settles (sign-in restored after mount)
  const account = useAccount()
  // and do not resolve at all until auth has had its say. Every branch below turns on
  // who this browser is, and on a device that has not cached the account yet the
  // honest answer for the first moment is "not known", not "not signed in" — which is
  // how a host opening their own link could be handed the guest form, a guest session
  // and the first-timer's tour offer.
  const authReady = useSyncExternalStore(subscribeAuth, authSettled, () => false)

  const go = useCallback(() => router.replace(`/events/${id}`), [router, id])

  // the invited event is fetched by id exactly once; the pull on its own would not
  // bring it, since a visitor is part of nothing yet
  const fetched = useRef(false)
  const resolve = useCallback(() => {
    if (!authReady) return // the skeleton holds until this browser knows who it is
    const ev = getEvent(id)
    if (!ev && !cloudSynced()) return // keep the skeleton until the first pull lands
    if (!ev && backendOn && !fetched.current) {
      fetched.current = true
      void fetchEvent(id).then((found) => { if (!found) setEvent(null) }) // found → EVENTS_SYNCED → resolve again
      return
    }
    if (!ev) { setEvent(null); return }
    // demos are read only for everyone — nothing to join, just look
    if (ev.demo) { go(); return }

    // already joined on this browser → straight in, as that guest
    const gid = guestSessionId(id)
    if (gid && ev.participants.some((p) => p.id === gid)) { go(); return }

    const acc = currentAccount()
    const signedIn = acc.signedIn

    // a personal invite link names its guest — no form
    const invited = participantByInvite(ev, inviteToken)
    if (invited) {
      if (signedIn) adoptParticipant(id, invited.id, acc.id, { name: acc.name })
      // a guest arriving by their personal link for the first time is new here and is
      // asked if they know their way; one coming back to it (on another device) is not
      else { claimGuestSession(id, invited.id); if (!invited.joinedAt) askAboutTour(id) }
      go(); return
    }

    // signed in: you are who you are. Being on the list under your account id is
    // what counts; the stored "hosted by you" is this browser's word, and an
    // invitee's copy came from the host's browser with the host's word in it. The
    // one exception is an ownerless event this browser made before signing in
    // (stub host) — that goes straight in, and the event page claims it.
    if (signedIn) {
      const host = ev.participants.find((p) => p.host)
      const ownerless = !!host && !isAccountId(host.id)
      if (ev.participants.some((p) => p.id === acc.id) || (ownerless && ev.hostedByYou)) { go(); return }
      // an entry made with this email before there was an account: it becomes yours
      const mine = acc.email ? ev.participants.find((p) => p.guest && p.email === acc.email) : undefined
      if (mine) adoptParticipant(id, mine.id, acc.id, { name: acc.name })
      else addMeToEvent(id)
      go(); return
    }
    // no backend: the host is the stub, and their own link opens for them
    if (!backendOn && ev.hostedByYou) { go(); return }

    setEvent(ev)
  }, [id, go, inviteToken, authReady, account.signedIn, account.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { resolve() }, [resolve])
  useLiveEvents(resolve)

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
    // an email comes with the way back: the server mails their personal link once,
    // in the background, and the event page says so when it arrives
    if (guest?.email) void sendJoinedLink(id, guest.id).then((ok) => { if (ok) pushFlash(`Your link is on its way to ${guest.email}. Keep it to get back here from any device.`) })
    // a guest who just gave their name is asked, once per device, whether they know
    // their way around; an account had that offer on the welcome steps
    if (guest) { askAboutTour(id); go() }
    else setJoining(false)
  }

  // prove an email is yours: with a backend that is a magic link (the account it
  // signs in to inherits the entry); without one, a plain match is the best we have
  async function proveEmail(addr: string, entry: Participant) {
    // proving an earlier entry is theirs is a return, not an arrival: no question
    if (!backendOn) { claimGuestSession(id, entry.id); go(); return }
    setError(null); setJoining(true)
    const err = await sendMagicLink(addr, `/events/${id}/join`)
    setJoining(false)
    if (err) { setError(err); return }
    setSent(addr)
  }

  // two characters is the floor; a first and last name is what the roster and the
  // chat avatars want, so the field says so without insisting
  const cleanName = name.trim().replace(/\s+/g, ' ')
  const nameOk = cleanName.length >= 2
  const nameWords = cleanName.split(' ').length

  // an email that already has an account is a way in, not a guest name: the person
  // logs in and joins as themselves. Asked of the database before anything else.
  async function knownAccount(addr: string): Promise<boolean> {
    if (!addr || !backendOn) return false
    setJoining(true)
    const known = await emailHasAccount(addr)
    setJoining(false)
    if (known) setAccountEmail(addr)
    return known
  }

  async function join() {
    const clean = cleanName
    if (!nameOk || joining || !event) return
    const cleanEmail = email.trim().toLowerCase()
    if (await knownAccount(cleanEmail)) return
    // the email is the identity key: same email as an earlier entry means the same
    // person — prove it and resume, instead of creating a double
    const byEmail = cleanEmail ? event.participants.find((p) => p.guest && p.email === cleanEmail) : undefined
    if (byEmail) { void proveEmail(cleanEmail, byEmail); return }
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
  async function claim() {
    if (!collision?.email || joining) return
    const addr = claimEmail.trim().toLowerCase()
    if (addr !== collision.email) { setClaimErr(true); return }
    if (await knownAccount(addr)) return
    void proveEmail(addr, collision)
  }
  function joinRenamed() {
    const n = dupeName.trim().replace(/\s+/g, ' ')
    if (!n || !event || joining) return
    const taken = event.participants.find((p) => norm(p.name) === norm(n))
    if (taken) { setCollision(taken); setClaimErr(false); return }
    doJoin(n)
  }

  if (event === undefined) {
    return (
      <div className="mx-auto max-w-[600px] px-4 pt-[34px] sm:px-[26px] sm:pt-[52px]">
        <div className="overflow-hidden rounded-2xl border border-border bg-s1">
          <div className="h-[120px] animate-pulse bg-s2 sm:h-[150px]" />
          <div className="flex flex-col gap-3 p-6 sm:p-7">
            <div className="h-5 w-20 animate-pulse rounded-full bg-s2" />
            <div className="h-9 w-3/4 animate-pulse rounded-lg bg-s2" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-s2" />
            <div className="h-4 w-2/5 animate-pulse rounded bg-s2" />
            <div className="mt-4 h-11 animate-pulse rounded-[10px] bg-s2" />
          </div>
        </div>
      </div>
    )
  }
  if (event === null) {
    return (
      <div className="mx-auto max-w-[560px] px-[26px] pb-[92px] pt-[72px] text-center">
        <p className="font-serif font-normal text-[33.5px] tracking-[-0.01em]">This invite doesn&apos;t open here</p>
        <p className="mx-auto mt-2 max-w-sm text-[14.5px] leading-[1.55] text-dim">
          The link may have a typo, or the event was deleted. Ask the host to send it again, or plan something of your own.
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
  const host = event.participants.find((p) => p.host)
  const field = 'h-11 w-full rounded-[10px] border border-border bg-s0 px-3.5 text-[14px] outline-none placeholder:text-faint focus:border-accent-border'

  return (
    <div ref={root} className="mx-auto max-w-[600px] px-4 pb-[92px] pt-[34px] sm:px-[26px] sm:pt-[52px]">
      {/* the event as a teaser — enough to know what this is, none of the answers */}
      <div className="overflow-hidden rounded-2xl border border-border bg-s1 shadow-soft">
        <Cover src={event.image} fit={event.imageFit} pos={event.imagePos} from={coverFrom} to={coverTo} className="h-[120px] sm:h-[150px]" />
        <div className="p-6 sm:p-7">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge variant={badge.variant}>{badge.label}</Badge>
          </div>
          <h1 className="font-serif font-normal text-[31px] leading-[1.06] tracking-[-0.01em] sm:text-[34px]">{event.title}</h1>
          <div className="mt-3.5 flex flex-col gap-[9px] text-[13.5px] text-dim">
            <span className="flex items-center gap-2">
              {host ? <Avatar initials={host.initials} color={host.color} size={22} /> : <User size={14} className="flex-none" />}
              Hosted by {event.hostName}
            </span>
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
            ) : sent ? (
              /* the link is on its way; opening it on this device finishes the join */
              <div className="flex items-start gap-3 rounded-[12px] border border-teal-border bg-teal-bg px-4 py-3.5">
                <MailCheck size={17} className="mt-0.5 flex-none text-teal-text" />
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-teal-text">Check your inbox</p>
                  <p className="mt-1 text-[13px] leading-[1.55] text-teal-text">
                    We sent a link to {sent}. Open it on this device and you&apos;ll pick up right where you left off.
                  </p>
                </div>
              </div>
            ) : collision ? (
              /* the typed name is taken — the guest sorts it out here, not the host later */
              <>
                <p className="text-[15px] font-semibold">Someone named {collision.name} is already in this event.</p>
                {collision.guest && collision.email ? (
                  <>
                    <p className="mt-1.5 text-[13px] leading-[1.55] text-dim">
                      If that&apos;s you, enter the email you joined with{backendOn ? ' and we will send you a link' : ''}.
                    </p>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <input
                        type="email"
                        autoComplete="email"
                        value={claimEmail}
                        onChange={(e) => { setClaimEmail(e.target.value); setClaimErr(false); setAccountEmail(null) }}
                        onKeyDown={(e) => { if (e.key === 'Enter') claim() }}
                        aria-label="The email you joined with"
                        placeholder="you@example.com"
                        className={`${field} min-w-0 flex-1`}
                      />
                      <button onClick={() => void claim()} disabled={!claimEmail.trim() || joining} className="h-11 flex-none rounded-[10px] bg-accent px-4 text-[14px] font-semibold text-on-accent disabled:opacity-40">
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
                  <p className="mt-1.5 text-[13px] leading-[1.55] text-dim">
                    They didn&apos;t leave an email, so there&apos;s no way to check that&apos;s you.
                  </p>
                )}

                <div className="mt-5 border-t border-border pt-4">
                  <p className="text-[13.5px] font-semibold">Someone else with the same name?</p>
                  <p className="mt-1 text-[13px] leading-[1.55] text-dim">Add a last name or an initial so people can tell you apart.</p>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <input
                      value={dupeName}
                      onChange={(e) => setDupeName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') joinRenamed() }}
                      aria-label="A fuller name"
                      className={`${field} min-w-0 flex-1`}
                    />
                    <button
                      onClick={joinRenamed}
                      disabled={!dupeName.trim() || norm(dupeName) === norm(collision.name) || joining}
                      className="h-11 flex-none rounded-[10px] bg-accent px-4 text-[14px] font-semibold text-on-accent disabled:opacity-40"
                    >
                      Join with this name
                    </button>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                  <button onClick={() => setCollision(null)} className="-my-2 py-2 text-[13px] font-semibold text-accent-text hover:underline">
                    Back
                  </button>
                  {!(collision.guest && collision.email) && (
                    <button onClick={() => doJoin(name.trim().replace(/\s+/g, ' '))} disabled={joining} className="text-[13px] font-medium text-dim hover:text-text hover:underline">
                      Join as a second {collision.name} anyway
                    </button>
                  )}
                </div>
              </>
            ) : (
              <>
                <p className="text-[15px] font-semibold leading-[1.4]">
                  {locked ? 'Add your name to see the plan and say if you are coming.' : 'Add your name to say when you are free and help pick the place.'}
                </p>
                <div className="mt-4 flex flex-col gap-1.5">
                  <label htmlFor="join-name" className="text-[12.5px] font-semibold text-dim">Your name</label>
                  <input
                    id="join-name"
                    autoComplete="name"
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') void join() }}
                    className={field}
                  />
                  <p className={`text-[12px] leading-[1.55] ${cleanName.length === 1 ? 'text-brick-text' : 'text-faint'}`}>
                    {cleanName.length === 1
                      ? 'At least two characters.'
                      : nameOk && nameWords < 2
                        ? 'Add a last name too, so people can tell who you are.'
                        : 'First and last name is best, so people can tell who you are.'}
                  </p>
                </div>
                <div className="mt-3 flex flex-col gap-1.5">
                  <label htmlFor="join-email" className="text-[12.5px] font-semibold text-dim">Email (Recommended)</label>
                  <input
                    id="join-email"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setAccountEmail(null) }}
                    onKeyDown={(e) => { if (e.key === 'Enter') void join() }}
                    placeholder="you@example.com"
                    className={field}
                  />
                  <p className="text-[12px] leading-[1.55] text-faint">For reminders, and to find your answers again from another device.</p>
                </div>
                <button
                  onClick={() => void join()}
                  disabled={!nameOk || joining}
                  className="mt-5 flex h-11 w-full items-center justify-center gap-1.5 rounded-[10px] bg-accent text-[14.5px] font-semibold text-on-accent disabled:opacity-40"
                >
                  Join event <ArrowRight size={15} />
                </button>
              </>
            )}
            {accountEmail && (
              <div role="status" className="mt-4 flex flex-col gap-2.5 rounded-[10px] border border-accent-border bg-accent-bg px-3.5 py-3">
                <p className="text-[12.5px] leading-[1.55] text-accent-text">
                  <span className="font-semibold">{accountEmail}</span> is registered to a Hourelle account. Log in to it and you join as yourself, with everything you answered before.
                </p>
                <Link
                  href={`/auth/signin?mode=login&email=${encodeURIComponent(accountEmail)}&next=${encodeURIComponent(`/events/${id}/join${inviteToken ? `?invite=${inviteToken}` : ''}`)}`}
                  className="flex h-10 w-fit items-center gap-1.5 rounded-[9px] bg-accent px-3.5 text-[13.5px] font-semibold text-on-accent"
                >
                  Log in <ArrowRight size={14} />
                </Link>
              </div>
            )}
            {error && <p role="alert" className="mt-3 text-[12.5px] font-medium text-brick-text">{error}</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
