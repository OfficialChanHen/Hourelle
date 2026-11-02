'use client'

/* Your face, picked inside the Account card's editor: a large preview, one row of
   small faces per part, and a shuffle. Every option is drawn as your face with that
   one part swapped, so the rows show what a tap does without words. Colour is the
   profile colour, picked here too.

   Nothing is kept until the card's Save: a tap only changes the draft. Saving writes
   the face to the account (the auth user's metadata; this browser alone with no
   backend) and puts it on your entry in every event this device holds, which then
   syncs. */

import { useId, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { Check, Shuffle } from 'lucide-react'
import { FaceSvg } from '@/components/ui/FaceSvg'
import { FaceParts } from '@/components/ui/FaceParts'
import { personColors, personVar, type PersonColor } from '@/lib/colors'
import { defaultFace, sameFace, shuffleFace, type Face } from '@/lib/faces'
import { initialsOf, restampMe, stampMyFace } from '@/lib/events'
import { updateFace, updateProfile, type Account } from '@/lib/session'
import { reducedMotion } from '@/lib/prefs'

const COLORS = Object.keys(personColors) as PersonColor[]

export type FaceDraft = ReturnType<typeof useFaceDraft>

/** The face and colour being picked, and how to keep or drop them. */
export function useFaceDraft(account: Account) {
  const current = account.face ?? defaultFace(initialsOf(account.name), account.color)
  // null means untouched: the preview follows the account until the first tap
  const [draft, setDraft] = useState<Face | null>(null)
  const [draftColor, setDraftColor] = useState<PersonColor | null>(null)
  const face = draft ?? current
  const color = draftColor ?? account.color
  const faceDirty = !!draft && !sameFace(draft, current)
  const colorDirty = !!draftColor && draftColor !== account.color

  // returns an error message, or null once kept
  async function save(): Promise<string | null> {
    if (colorDirty) {
      const e = await updateProfile({ color })
      if (e) return e
      restampMe({ color })
    }
    // a colour change alone still keeps the face: one that was only drawn from the
    // old colour would otherwise be redrawn from the new one
    if (faceDirty || (colorDirty && !account.face)) {
      const e = await updateFace(face)
      if (e) return e
      stampMyFace()
    }
    setDraft(null); setDraftColor(null)
    return null
  }
  function reset() { setDraft(null); setDraftColor(null) }

  return { face, color, dirty: faceDirty || colorDirty, setFace: setDraft, setColor: setDraftColor, save, reset }
}

export function FacePicker({ account, draft }: { account: Account; draft: FaceDraft }) {
  const { face, color } = draft
  const ids = useId()

  // a small pop on the preview when it changes, so a tap reads as a change
  const preview = useRef<HTMLDivElement>(null)
  const mounted = useRef(false)
  const look = `${face.shape}.${face.eyes}.${face.mouth}.${face.hair}.${face.accessory}.${color}`
  useGSAP(() => {
    if (!mounted.current) { mounted.current = true; return }
    if (reducedMotion() || !preview.current) return
    gsap.fromTo(preview.current, { scale: 0.94 }, { scale: 1, duration: 0.45, ease: 'back.out(2.4)' })
  }, { dependencies: [look] })

  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-7">
      <div className="flex flex-none flex-col items-center gap-3 sm:w-[160px]">
        <div ref={preview} role="img" aria-label="Your face">
          <FaceSvg face={face} color={color} size={150} className="h-[120px] w-[120px] sm:h-[150px] sm:w-[150px]" />
        </div>
        <button
          type="button" onClick={() => draft.setFace(shuffleFace(face, String(Date.now())))}
          className="flex h-11 items-center gap-1.5 rounded-full border border-border2 bg-s1 px-4 text-[13.5px] font-semibold text-text hover:bg-s2 sm:h-9"
        >
          <Shuffle size={15} /> Shuffle
        </button>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-3.5">
        <FaceParts face={face} color={color} onPick={draft.setFace} />
        {/* the colour is the account's, so it needs an account to keep it */}
        {account.signedIn && (
          <div role="group" aria-labelledby={`${ids}-color`} className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
            <span id={`${ids}-color`} className="text-[12.5px] font-semibold text-dim sm:w-[52px] sm:flex-none">Colour</span>
            <div className="flex flex-wrap gap-1.5">
              {COLORS.map((c) => (
                <button
                  key={c} type="button" onClick={() => draft.setColor(c)} aria-label={c} aria-pressed={color === c}
                  className={`grid h-11 w-11 place-items-center rounded-full border-2 sm:h-9 sm:w-9 ${color === c ? 'border-accent' : 'border-transparent hover:border-border2'}`}
                  style={{ background: personVar(c).bg, color: personVar(c).text }}
                >
                  {color === c && <Check size={16} />}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
