'use client'

import { useId, useRef, useState } from 'react'
import { Check, Copy, Link2, Mail, MessageCircle, Share, Smartphone, X } from 'lucide-react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { availIvOf, phaseOf, type AppEvent } from '@/lib/events'
import { canEmail } from '@/lib/mail'
import { reducedMotion } from '@/lib/prefs'
import { useAccount } from '@/hooks/useAccount'
import { Popover, PopoverItem, PopoverTitle } from '@/components/ui/Popover'

/* ── the first thing a new event needs ──
   Right after creating an event the only useful next step is handing out the link,
   so until somebody else is here the page leads with it. The header's share button
   and the phone menu stay where they are; this is the same link, said once, big.

   It is the host's, on a real event that is still being planned, and it goes away on
   its own the moment a guest arrives. Hidden by hand, it stays hidden for this event
   on this device. */

const hiddenKey = (id: string) => `hourelle.share-first.${id}`

/** Has anybody besides the host arrived? The same test the chat uses for arrival
 *  (`arrivalOf`): a stamp from opening the event, or, for people who were active
 *  before stamps existed, a line in the chat or an answer on the grid. Someone who
 *  was only invited is on the list but has not arrived. Built once per render as
 *  sets, so a long invite list costs one pass rather than one grid scan per person. */
export function guestHasArrived(event: AppEvent): boolean {
  const others = event.participants.filter((p) => !p.host && !p.you)
  if (others.length === 0) return false
  if (others.some((p) => p.joinedAt)) return true
  const removed = new Set(event.removedIds ?? [])
  const active = new Set<string>(event.unavailableIds ?? [])
  for (const m of event.messages) active.add(m.id)
  for (const byPid of Object.values(availIvOf(event))) {
    for (const [pid, ivs] of Object.entries(byPid)) if (ivs.length) active.add(pid)
  }
  return others.some((p) => !removed.has(p.id) && active.has(p.id))
}

export function ShareFirst({ event, joinUrl, copied, onCopy, onInviteByEmail }: {
  event: AppEvent
  joinUrl: string
  copied: boolean
  onCopy: () => void
  onInviteByEmail: () => void
}) {
  const account = useAccount()
  const [hidden, setHidden] = useState(() => {
    try { return localStorage.getItem(hiddenKey(event.id)) === '1' } catch { return false }
  })
  const show = event.hostedByYou && !event.demo && !event.practice && phaseOf(event) === 'planning'
    && !hidden && !guestHasArrived(event)

  if (!show) return null
  return (
    <ShareFirstCard
      title={event.title}
      joinUrl={joinUrl}
      copied={copied}
      onCopy={onCopy}
      onInviteByEmail={canEmail(account.signedIn) ? onInviteByEmail : undefined}
      onHide={() => {
        try { localStorage.setItem(hiddenKey(event.id), '1') } catch { /* hides for this visit only */ }
        setHidden(true)
        // the card held focus; hand it to the tab row below rather than the page top
        requestAnimationFrame(() => document.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus())
      }}
    />
  )
}

function ShareFirstCard({ title, joinUrl, copied, onCopy, onInviteByEmail, onHide }: {
  title: string
  joinUrl: string
  copied: boolean
  onCopy: () => void
  onInviteByEmail?: () => void
  onHide: () => void
}) {
  const uid = useId()
  const headingId = `${uid}-title`
  const fieldId = `${uid}-link`
  const root = useRef<HTMLElement>(null)
  useGSAP(() => {
    if (reducedMotion()) return
    gsap.fromTo(root.current, { y: 8, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, ease: 'power2.out' })
  }, { scope: root })

  return (
    <section ref={root} aria-labelledby={headingId} className="mb-4 rounded-2xl border border-moment-border bg-s1 p-5 shadow-soft sm:mb-6 sm:p-6">
      <div className="flex items-start gap-3">
        {/* coral: the moment role. This card is the one thing the page is asking of
            the host right now, so its kicker carries the moment colour */}
        <div className="min-w-0 flex-1 pt-1 sm:pt-0.5">
          <p className="mb-1 text-[11.5px] font-semibold uppercase tracking-[.13em] text-moment-text">Your turn</p>
          <h2 id={headingId} className="font-serif text-[22px] leading-tight tracking-[-0.01em] sm:text-[24px]">
            Send the invite link
          </h2>
        </div>
        <button
          type="button"
          onClick={onHide}
          aria-label="Hide"
          className="-mr-2.5 -mt-2 grid h-11 w-11 flex-none place-items-center rounded-full text-faint hover:bg-s2 hover:text-dim sm:-mr-2 sm:h-9 sm:w-9"
        >
          <X size={16} />
        </button>
      </div>

      <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <label htmlFor={fieldId} className="sr-only">Invite link</label>
        <div className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-[10px] border border-border2 bg-s2 px-3 focus-within:border-accent sm:h-10">
          <Link2 size={15} className="flex-none text-dim" aria-hidden />
          <input
            id={fieldId}
            readOnly
            value={joinUrl}
            onFocus={(e) => e.currentTarget.select()}
            className="min-w-0 flex-1 bg-transparent font-mono text-[12.5px] text-text outline-none"
          />
        </div>
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={onCopy}
            className={`flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full px-4 text-[14px] font-semibold sm:h-10 sm:min-w-[120px] sm:flex-none ${copied ? 'border border-teal-border bg-teal-bg text-teal-text' : 'bg-accent text-on-accent'}`}
          >
            {copied ? <><Check size={16} /> Copied</> : <><Copy size={16} /> Copy link</>}
          </button>
          <ShareMenu title={title} url={joinUrl} />
        </div>
      </div>

      {onInviteByEmail && (
        <button
          type="button"
          onClick={onInviteByEmail}
          className="mt-2 inline-flex min-h-11 items-center text-[13.5px] font-medium text-dim underline decoration-border2 underline-offset-4 hover:text-text sm:mt-3 sm:min-h-0"
        >
          Invite by email
        </button>
      )}
    </section>
  )
}

/* Where the link goes besides the clipboard: the apps a group plans in. Each is a
   plain link with the invite written in, so it works on any device without asking
   for anything. Texting is offered where there is a phone to text from, and the
   system sheet (every other app) where the browser has one. */
function ShareMenu({ title, url }: { title: string; url: string }) {
  return (
    <Popover
      align="end"
      width={232}
      className="flex flex-1 sm:flex-none"
      trigger={(isOpen) => (
        <span className={`flex h-11 w-full items-center justify-center gap-1.5 rounded-full border border-border2 px-4 text-[14px] font-semibold sm:h-10 ${isOpen ? 'bg-s2' : 'bg-s1 hover:bg-s2'}`}>
          <Share size={16} /> Share
        </span>
      )}
    >
      {(close) => (
        <>
          <PopoverTitle>Send the link</PopoverTitle>
          <ShareItems title={title} url={url} close={close} />
        </>
      )}
    </Popover>
  )
}

/** The send rows on their own, for any popover that hands out the invite link (this
 *  card's Share, and the header's share buttons). Rendered when the popover opens,
 *  so the device checks run in the browser. */
export function ShareItems({ title, url, close }: { title: string; url: string; close: () => void }) {
  const text = `Join ${title} and mark when you're free`
  const body = `${text}: ${url}`
  const canShare = typeof navigator.share === 'function'
  const phone = window.matchMedia('(pointer: coarse)').matches
  const open = (href: string) => window.open(href, '_blank', 'noopener,noreferrer')
  return (
    <>
      {phone && (
        <PopoverItem icon={<Smartphone size={15} />} href={`sms:?&body=${encodeURIComponent(body)}`} onClick={close}>Text message</PopoverItem>
      )}
      <PopoverItem icon={<MessageCircle size={15} />} onClick={() => { open(`https://wa.me/?text=${encodeURIComponent(body)}`); close() }}>WhatsApp</PopoverItem>
      <PopoverItem icon={<Mail size={15} />} href={`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`} onClick={close}>Email</PopoverItem>
      {canShare && (
        <PopoverItem
          icon={<Share size={15} />}
          onClick={() => {
            close()
            // closing the sheet without picking anything rejects; that is not an error
            navigator.share({ title, text, url }).catch(() => {})
          }}
        >
          More apps
        </PopoverItem>
      )}
    </>
  )
}
