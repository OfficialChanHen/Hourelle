'use client'

import { Avatar } from './Avatar'
import { usePeek } from '@/hooks/usePeek'
import { useNoHover } from '@/hooks/useNoHover'
import { useStill } from './Still'
import type { AppEvent, Participant } from '@/lib/events'

/* A card with the faces of the people in it tucked behind its top edge. Hover or
   focus anywhere on it and they rise up from behind, then settle back.

   The faces are a sibling of the card, not a child, and sit below it: the card's own
   link or click never wraps them, so every face is a button, named for the person,
   that flips to show their initials. A click on a face flips it and never opens the
   card; a click on the card body opens it. The wrapper leaves room above the card for the raised faces, inside
   itself, so a parent that clips (the Up next carousel does) never cuts them off.

   `restShow` is how much of each face shows at rest (0 hides them until hover, which
   phones never do); `upShow` is how much shows raised. Up to six faces; the rest are
   not drawn. Only a mouse raises them: a touch would move the face it is tapping.

   A screen with no hover never gets the hover, so there every card rests with its
   faces half up (a card that hides them at rest shows half of each). They rise while
   the card is near the middle of the screen and sink back once it is scrolled well
   away, every time it comes back (usePeek). The room above the card is reserved
   either way, so nothing shifts when a phone is detected. */

const MAX = 6

/** Who "is in": the people going once there are RSVPs, else everyone not out. */
export function peopleIn(e: Pick<AppEvent, 'participants'>): Participant[] {
  const going = e.participants.filter((p) => p.rsvp === 'attending')
  // the host is marked going from the start, so that alone is not an answer: until
  // someone else says they are coming, everyone who has not said no is shown
  return going.some((p) => !p.host) ? going : e.participants.filter((p) => p.rsvp !== 'not_going')
}

export function PeekCard({
  people,
  size = 40,
  restShow = 0,
  upShow,
  tilt = 0,
  className = '',
  children,
}: {
  people: Participant[]
  size?: number
  restShow?: number
  upShow?: number
  // the card's own tilt, when it has one (a PhotoFrame): the row of faces turns
  // with it, so every face tucks the same depth behind the slanted top edge
  tilt?: number
  className?: string
  children: React.ReactNode
}) {
  const shown = people.slice(0, MAX)
  const up = upShow ?? size - 6
  const touch = useNoHover()
  const rest = restShow > 0 ? restShow : touch ? Math.round(size / 2) : 0
  const restY = rest > 0 ? -rest : 6
  const restTilt = rest > 0 ? 3 : 0
  // a still copy (a Deck's ghost) keeps its faces at rest: no scroll band, no hover
  const still = useStill()
  const { scope, rise: liveRise, settle: liveSettle } = usePeek({ restY, upY: -up, restTilt, upTilt: 8, band: !still && touch && shown.length > 0 })
  const rise = still ? () => {} : liveRise
  const settle = still ? () => {} : liveSettle
  // room for the raised faces and their tilt, above the card
  const room = up + 6
  return (
    <div
      ref={scope}
      // the wrapper itself takes no pointer, so the empty room above the card does
      // not raise anything; the card and the faces do, and their enter and leave
      // reach it all the same
      className={`pointer-events-none relative flex flex-col ${className}`}
      style={{ paddingTop: shown.length ? room : undefined }}
      onPointerEnter={(e) => { if (e.pointerType === 'mouse') rise() }}
      // a mouse that arrived while a Deck was still moving (and so raised nothing)
      // raises them as soon as it moves again; rise() does nothing if already up
      onPointerMove={(e) => { if (e.pointerType === 'mouse') rise() }}
      onPointerLeave={(e) => { if (e.pointerType === 'mouse') settle() }}
      onFocus={rise}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) settle() }}
    >
      {shown.length > 0 && (
        <div
          className="pointer-events-auto absolute left-5 right-5 z-0 flex gap-2"
          style={{ top: room, transform: tilt ? `rotate(${tilt}deg)` : undefined }}
        >
          {shown.map((p, i) => (
            <span
              key={p.id}
              className="peek-face block"
              style={{ transform: `translateY(${restY}px) rotate(${i % 2 ? restTilt : -restTilt}deg)` }}
            >
              <Avatar initials={p.initials} color={p.color} face={p.face} size={size} font={Math.round(size * 0.34)} title={p.name} flippable />
            </span>
          ))}
        </div>
      )}
      {/* the card's box takes no pointer itself, only what is drawn in it, so a tilted
          card never blocks a face with the empty corner of its unturned box */}
      <div className="pointer-events-none relative z-[1] flex min-h-0 flex-1 flex-col [&>*]:pointer-events-auto">{children}</div>
    </div>
  )
}
