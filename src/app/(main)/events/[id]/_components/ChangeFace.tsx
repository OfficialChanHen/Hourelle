'use client'

/* "Change face" on your own row of the participant list. A guest has no profile, so
   theirs opens a small picker right here: a preview, Shuffle, and the same part rows
   as the profile. Saving puts the face on their entry in this event only. An account's
   face is the same on every event, so its button goes to the profile's face section. */

import { useRef, useState } from 'react'
import Link from 'next/link'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { Check, Shuffle } from 'lucide-react'
import { Popover, PopoverTitle } from '@/components/ui/Popover'
import { FaceSvg } from '@/components/ui/FaceSvg'
import { FaceParts } from '@/components/ui/FaceParts'
import { defaultFace, sameFace, shuffleFace, type Face } from '@/lib/faces'
import { reducedMotion } from '@/lib/prefs'
import type { Participant } from '@/lib/events'

const BTN = 'flex h-11 flex-none items-center rounded-lg border border-border2 px-2.5 text-[12.5px] font-semibold text-dim hover:bg-s2 hover:text-text sm:h-7'

export function ChangeFace({ me, onSave }: { me: Participant; onSave: (face: Face) => void }) {
  if (!me.guest) return <Link href="/profile#face" className={BTN}>Change face</Link>
  return (
    <Popover width={292} align="end" className={BTN} trigger={() => 'Change face'}>
      {(close) => <Picker me={me} onSave={(f) => { onSave(f); close() }} onCancel={close} />}
    </Popover>
  )
}

function Picker({ me, onSave, onCancel }: { me: Participant; onSave: (face: Face) => void; onCancel: () => void }) {
  const current = me.face ?? defaultFace(me.initials, me.color)
  const [face, setFace] = useState<Face>(current)
  const dirty = !sameFace(face, current)

  // the same small pop the profile preview gives, so a tap reads as a change
  const preview = useRef<HTMLDivElement>(null)
  const look = `${face.shape}.${face.eyes}.${face.mouth}.${face.hair}.${face.accessory}`
  const first = useRef(look)
  useGSAP(() => {
    if (look === first.current || reducedMotion() || !preview.current) return
    gsap.fromTo(preview.current, { scale: 0.92 }, { scale: 1, duration: 0.45, ease: 'back.out(2.4)' })
  }, { dependencies: [look] })

  return (
    // a phone may not have room for every row: the panel scrolls inside itself
    <div className="overflow-y-auto" style={{ maxHeight: 'calc(var(--radix-popover-content-available-height, 100dvh) - 16px)' }}>
      <PopoverTitle>Your face</PopoverTitle>
      <div className="flex flex-col gap-3 px-2 pb-1.5 pt-1">
        <div className="flex items-center gap-3">
          <div ref={preview} role="img" aria-label="Your face">
            <FaceSvg face={face} color={me.color} size={64} />
          </div>
          <button
            type="button" onClick={() => setFace(shuffleFace(face, `${me.id}:${Date.now()}`))}
            className="flex h-11 items-center gap-1.5 rounded-[10px] border border-border2 bg-s1 px-3.5 text-[13px] font-semibold text-text hover:bg-s2 sm:h-9"
          >
            <Shuffle size={15} /> Shuffle
          </button>
        </div>
        <FaceParts face={face} color={me.color} onPick={setFace} layout="compact" />
        <div className="flex items-center gap-2 border-t border-border pt-3">
          <button
            type="button" onClick={() => onSave(face)} disabled={!dirty}
            className="flex h-11 items-center gap-1.5 rounded-[10px] bg-accent px-4 text-[13.5px] font-semibold text-on-accent disabled:opacity-40 sm:h-9"
          >
            <Check size={15} /> Save
          </button>
          <button type="button" onClick={onCancel} className="flex h-11 items-center rounded-[10px] border border-border2 px-4 text-[13.5px] font-semibold text-dim hover:bg-s2 sm:h-9">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
